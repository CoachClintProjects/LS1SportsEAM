import { verifiedLedgerReport } from "@/lib/server/verifiedLedgerReport";
import { NextRequest, NextResponse } from "next/server";
import { financeScope } from "@/lib/server/adminFinanceScope";
import { recordRest as rest } from "@/lib/server/adminRecordAccess";
import { PersonRecordError } from "@/lib/server/adminPersonRecord";
import { cents, decimal } from "@/lib/client/ledgerAmounts";
export const dynamic = "force-dynamic";
type Row = Record<string, any>;
async function all(path: string): Promise<Row[]> {
  const result: Row[] = [];
  for (let offset = 0; offset < 10000; offset += 500) {
    const page = await rest(`${path}&order=id.asc&limit=500&offset=${offset}`);
    result.push(...page);
    if (page.length < 500) return result;
  }
  throw new PersonRecordError(
    409,
    "This report exceeds the safe record limit. Narrow the reporting scope.",
  );
}
async function related(
  path: string,
  key: string,
  ids: string[],
): Promise<Row[]> {
  const result: Row[] = [];
  for (let i = 0; i < ids.length; i += 100)
    result.push(
      ...(await all(`${path}&${key}=in.(${ids.slice(i, i + 100).join(",")})`)),
    );
  return result;
}
const sum = (rows: Row[], field: string) =>
  decimal(rows.reduce((n, r) => n + cents(r[field] ?? "0"), BigInt(0)));
const validDate = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
export async function GET(request: NextRequest) {
  try {
    const { tenant, org } = await financeScope(request, "treasurer");
    const q = request.nextUrl.searchParams;
    const [entities, customers, organizations] = await Promise.all([
      all(
        `legal_entities?select=id,legal_name,base_currency&organization_id=eq.${org}`,
      ),
      all(
        `customers?select=id,person_id,display_name,customer_code,status,people(id,first_name,last_name,preferred_name,email)&organization_id=eq.${org}`,
      ),
      all(`organizations?select=id,name&tenant_id=eq.${tenant}&id=eq.${org}`),
    ]);
    const entity = q.get("entity") || entities[0]?.id || null;
    if (entity && !entities.some((e) => e.id === entity))
      throw new PersonRecordError(404, "Legal entity outside club.");
    const customerIds = customers.map((c) => c.id);
    if (q.get("mode") === "billing") {
      const [invoices, billingAccounts, paymentMethods] = await Promise.all([
        related(
          "invoices?select=*,customers(id,person_id,display_name,customer_code)",
          "customer_id",
          customerIds,
        ),
        related("billing_accounts?select=*", "customer_id", customerIds),
        all(
          `payment_methods?select=id,code,name,method_type,status&tenant_id=eq.${tenant}&organization_id=eq.${org}`,
        ),
      ]);
      const vendorBills = await related(
        "vendor_bills?select=id,bill_number,currency,balance_due,status",
        "legal_entity_id",
        entities.map((e) => e.id),
      );
      const members = await all(
        `memberships?select=id,people(id,first_name,last_name,preferred_name,email)&organization_id=eq.${org}`,
      );
      const people = [
        ...new Map(
          members.filter((m) => m.people).map((m) => [m.people.id, m.people]),
        ).values(),
      ];
      const invoiceIds = invoices.map((i) => i.id);
      const [invoiceLines, payments, credits, refunds] = await Promise.all([
        related("invoice_lines?select=*", "invoice_id", invoiceIds),
        related("payments?select=*", "invoice_id", invoiceIds),
        related("credits?select=*", "invoice_id", invoiceIds),
        related("refunds?select=*", "invoice_id", invoiceIds),
      ]);
      const paymentAllocations = await related(
        "payment_allocations?select=*",
        "payment_id",
        payments.map((p) => p.id),
      );
      return NextResponse.json({
        invoices,
        invoiceLines,
        payments,
        paymentAllocations,
        credits,
        refunds,
        vendorBills,
        metrics: {
          arCurrency: invoices[0]?.currency || null,
          apCurrency: vendorBills[0]?.currency || null,
          arBalance:
            new Set(invoices.map((i) => String(i.currency).trim())).size <= 1
              ? sum(
                  invoices.filter(
                    (i) => !["void", "cancelled"].includes(i.status),
                  ),
                  "balance_due",
                )
              : null,
          apBalance:
            new Set(vendorBills.map((b) => String(b.currency).trim())).size <= 1
              ? sum(
                  vendorBills.filter(
                    (b) =>
                      !["draft", "void", "cancelled", "rejected"].includes(
                        b.status,
                      ),
                  ),
                  "balance_due",
                )
              : null,
          pastDue: invoices.filter(
            (i) =>
              i.due_date &&
              i.due_date < new Date().toISOString().slice(0, 10) &&
              cents(i.balance_due) > BigInt(0),
          ).length,
        },
        authorization: { finance: true },
        financeContext: {
          customers,
          billingAccounts,
          paymentMethods,
          legalEntities: entities,
          organizations,
          people,
          currency: entities.length === 1 ? entities[0].base_currency : null,
        },
        generatedAt: new Date().toISOString(),
      });
    }
    const ledgers = entity
      ? await all(
          `accounting_ledgers?select=id,name,currency,legal_entity_id&legal_entity_id=eq.${entity}`,
        )
      : [];
    const ledger = q.get("ledger") || ledgers[0]?.id || null;
    if (ledger && !ledgers.some((l) => l.id === ledger))
      throw new PersonRecordError(404, "Ledger outside selected legal entity.");
    const from = q.get("from") || new Date().getUTCFullYear() + "-01-01",
      to = q.get("to") || new Date().toISOString().slice(0, 10);
    if (!validDate(from) || !validDate(to) || from > to)
      throw new PersonRecordError(400, "Choose valid report dates.");
    const [bills, bankAccounts, budgets, holdings, journals, invoices] =
      await Promise.all([
        entity
          ? all(
              `vendor_bills?select=id,bill_number,currency,total,tax_total,balance_due,status,approval_required_role,bill_date&legal_entity_id=eq.${entity}`,
            )
          : [],
        entity
          ? all(
              `bank_accounts?select=id,institution_name,account_mask,currency,status&legal_entity_id=eq.${entity}`,
            )
          : [],
        entity ? all(`budgets?select=*&legal_entity_id=eq.${entity}`) : [],
        all(
          `work_items?select=id,status,payload&tenant_id=eq.${tenant}&work_type=eq.DECK_CASH&payload->>organization_id=eq.${org}&status=eq.open`,
        ),
        entity
          ? all(
              `gl_journals?select=id,journal_number,status,journal_date&legal_entity_id=eq.${entity}&status=in.(draft,review)`,
            )
          : [],
        entity
          ? all(
              `invoices?select=id,invoice_number,invoice_date,currency,subtotal,tax_total,total,status&legal_entity_id=eq.${entity}&invoice_date=gte.${from}&invoice_date=lte.${to}`,
            )
          : [],
      ]);
    let report: Row | null = null,
      cash: string | null = null,
      reserve: string | null = null;
    if (ledger) {
      report = await verifiedLedgerReport({
        p_tenant: tenant,
        p_org: org,
        p_ledger: ledger,
        p_from: from,
        p_to: to,
      });
      const configs = await rest(
        `system_configurations?select=config_value&tenant_id=eq.${tenant}&config_namespace=eq.admin.overwatch&config_key=eq.${ledger}&active=eq.true&order=version.desc&limit=1`,
      );
      const cfg = configs[0]?.config_value;
      cash =
        report?.accounts.find((a: Row) => a.id === cfg?.bank_account)
          ?.closing ?? null;
      reserve =
        report?.accounts.find((a: Row) => a.id === cfg?.reserve_account)
          ?.closing ?? null;
    }
    const bankTransactions = await related(
      `bank_transactions?select=*&transaction_date=gte.${from}&transaction_date=lte.${to}`,
      "bank_account_id",
      bankAccounts.map((b) => b.id),
    );
    const payableByCurrency = Object.fromEntries(
      [...new Set(bills.map((b) => String(b.currency).trim()))].map(
        (currency) => [
          currency,
          sum(
            bills.filter(
              (b) =>
                String(b.currency).trim() === currency &&
                !["void", "cancelled", "draft", "rejected"].includes(b.status),
            ),
            "balance_due",
          ),
        ],
      ),
    );
    const variance: Row[] = [];
    const budgetId = q.get("budget");
    if (budgetId) {
      const budget = budgets.find((b) => b.id === budgetId);
      if (!budget)
        throw new PersonRecordError(
          404,
          "Budget outside selected legal entity.",
        );
      if (
        !ledger ||
        String(budget.currency).trim() !==
          String(report?.ledger.currency).trim()
      )
        throw new PersonRecordError(
          409,
          "Select a ledger in the budget currency.",
        );
      const lines = await all(`budget_lines?select=*&budget_id=eq.${budgetId}`);
      const ranges = new Map<string, Row>();
      for (const line of lines) {
        const key = `${line.period_start}:${line.period_end}`;
        if (!ranges.has(key))
          ranges.set(
            key,
            await verifiedLedgerReport({
              p_tenant: tenant,
              p_org: org,
              p_ledger: ledger,
              p_from: line.period_start,
              p_to: line.period_end,
            }),
          );
        const account = ranges
          .get(key)!
          .accounts.find((a: Row) => a.id === line.account_id);
        if (!account)
          throw new PersonRecordError(
            409,
            "A budget account is missing from this ledger.",
          );
        const actual = ["revenue", "liability", "equity"].includes(
          String(account.account_type).toLowerCase(),
        )
          ? cents(account.credit) - cents(account.debit)
          : cents(account.debit) - cents(account.credit);
        variance.push({
          ...line,
          account_name: account.account_name,
          account_type: account.account_type,
          actual: decimal(actual),
          variance: decimal(actual - cents(line.budget_amount)),
        });
      }
    }
    return NextResponse.json({
      entities,
      entity,
      ledgers,
      ledger,
      from,
      to,
      cash,
      reserve,
      payableByCurrency,
      bills,
      bankAccounts,
      bankTransactions,
      budgets,
      variance,
      holdings,
      journals,
      invoices,
      report,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Treasurer records unavailable.",
      },
      { status: e instanceof PersonRecordError ? e.status : 500 },
    );
  }
}
