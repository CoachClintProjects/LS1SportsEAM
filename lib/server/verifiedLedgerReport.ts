import { recordRest as rest } from "./adminRecordAccess";
import { PersonRecordError } from "./adminPersonRecord";
import { cents } from "@/lib/client/ledgerAmounts";
export async function verifiedLedgerReport(values: {
  p_tenant: string;
  p_org: string;
  p_ledger: string;
  p_from: string;
  p_to: string;
}) {
  const report = await rest("rpc/admin_ledger_report", {
    method: "POST",
    body: JSON.stringify(values),
  });
  for (let offset = 0; offset < 10000; offset += 500) {
    const journals = await rest(
      `gl_journals?select=id,gl_lines(debit,credit,currency)&ledger_id=eq.${report.ledger.id}&status=eq.posted&journal_date=lte.${values.p_to}&order=id.asc&limit=500&offset=${offset}`,
    );
    for (const journal of journals) {
      const lines: { debit: string; credit: string; currency: string }[] =
        journal.gl_lines || [];
      let debit = BigInt(0),
        credit = BigInt(0);
      for (const line of lines) {
        if (
          String(line.currency).trim() !== String(report.ledger.currency).trim()
        )
          throw new PersonRecordError(
            409,
            "Posted journal currency mismatch. Resolve it before reporting.",
          );
        debit += cents(line.debit);
        credit += cents(line.credit);
      }
      if (
        lines.length < 2 ||
        lines.length >= 1000 ||
        debit !== credit ||
        debit <= BigInt(0)
      )
        throw new PersonRecordError(
          409,
          "An invalid posted journal prevents reliable financial reporting.",
        );
    }
    if (journals.length < 500) return report;
  }
  throw new PersonRecordError(
    409,
    "The ledger exceeds the report verification limit. A complete validated report is required.",
  );
}
