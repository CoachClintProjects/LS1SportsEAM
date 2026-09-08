'use client';

import { FormEvent, useState } from 'react';
import { AlertTriangle, CheckCircle2, Landmark } from 'lucide-react';

const FINANCE_VIEWS = new Set(['financial-overview','general-ledger','receivables','payables','revenue','costs','budgets','forecasting','profitability','cash-flow']);

type Props = { view: string };

function Input({ name, label, required = false, placeholder = '', type = 'text' }: { name: string; label: string; required?: boolean; placeholder?: string; type?: string }) {
  return <label className="block text-[10px] font-bold uppercase tracking-[.12em] text-neutral-500">{label}<input name={name} required={required} placeholder={placeholder} type={type} className="mt-2 w-full rounded-lg border border-neutral-700 bg-black px-3 py-2.5 text-xs normal-case tracking-normal text-white outline-none focus:border-emerald-500/60" /></label>;
}

function TextArea({ name, label, placeholder = '' }: { name: string; label: string; placeholder?: string }) {
  return <label className="block text-[10px] font-bold uppercase tracking-[.12em] text-neutral-500">{label}<textarea name={name} placeholder={placeholder} rows={5} className="mt-2 w-full rounded-lg border border-neutral-700 bg-black px-3 py-2.5 font-mono text-[11px] normal-case tracking-normal text-white outline-none focus:border-emerald-500/60" /></label>;
}

export default function SuperUserFinanceActions({ view }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  if (!FINANCE_VIEWS.has(view)) return null;

  async function submit(event: FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
      const response = await fetch('/api/superuser-finance-action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...payload }) });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Finance action failed.');
      setMessage(`${action.replaceAll('-', ' ')} completed and audited.`);
      event.currentTarget.reset();
      window.dispatchEvent(new CustomEvent('ls1sports:data-changed'));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Finance action failed.'); }
    finally { setBusy(false); }
  }

  const card = 'rounded-xl border border-neutral-800 bg-[#0d1010] p-4';
  const button = 'mt-4 w-full rounded-lg bg-emerald-400 px-3 py-2.5 text-xs font-black text-black disabled:opacity-50';
  const secondary = 'mt-4 w-full rounded-lg border border-neutral-700 px-3 py-2.5 text-xs font-black text-white disabled:opacity-50';

  return <section className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-5 lg:p-6">
    <div className="flex items-start gap-3"><Landmark className="mt-0.5 h-5 w-5 text-emerald-400"/><div><div className="text-[9px] font-black uppercase tracking-[.2em] text-emerald-400">FINANCIAL OPERATING CONTROLS</div><h2 className="mt-1 text-xl font-black text-white">ERP accounting lifecycle</h2><p className="mt-2 text-xs leading-5 text-neutral-500">Balanced journals, AR/AP lifecycle, budgeting and reconciliation write through the privileged server API and canonical audit trail.</p></div></div>
    {error && <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs text-red-200"><AlertTriangle className="h-4 w-4"/>{error}</div>}
    {message && <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-200"><CheckCircle2 className="h-4 w-4"/>{message}</div>}

    <div className="mt-6 grid gap-5 xl:grid-cols-3">
      <form onSubmit={e=>void submit(e,'create-account')} className={card}><div className="mb-4 text-sm font-black text-white">Chart of accounts</div><div className="space-y-3"><Input name="legal_entity_id" label="Legal entity ID" required/><Input name="account_code" label="Account code" required/><Input name="account_name" label="Account name" required/><Input name="account_type" label="Account type" required/><Input name="parent_account_id" label="Parent account ID"/></div><button disabled={busy} className={button}>Create account</button></form>
      <form onSubmit={e=>void submit(e,'create-ledger')} className={card}><div className="mb-4 text-sm font-black text-white">Accounting ledger</div><div className="space-y-3"><Input name="legal_entity_id" label="Legal entity ID" required/><Input name="code" label="Ledger code" required/><Input name="name" label="Ledger name" required/><Input name="accounting_basis" label="Accounting basis" placeholder="accrual"/><Input name="currency" label="Currency" placeholder="CAD"/></div><button disabled={busy} className={button}>Create ledger</button></form>
      <form onSubmit={e=>void submit(e,'create-journal')} className={card}><div className="mb-4 text-sm font-black text-white">Balanced GL journal</div><div className="space-y-3"><Input name="legal_entity_id" label="Legal entity ID" required/><Input name="journal_number" label="Journal number" required/><Input name="journal_date" label="Journal date" type="date"/><Input name="source" label="Source" placeholder="SUPERUSER"/><Input name="description" label="Description"/><TextArea name="lines" label="Journal lines JSON" placeholder='[{"account_id":"...","debit":100,"credit":0},{"account_id":"...","debit":0,"credit":100}]'/></div><button disabled={busy} className={button}>Create balanced journal</button></form>

      <form onSubmit={e=>void submit(e,'post-journal')} className={card}><div className="mb-4 text-sm font-black text-white">Post journal</div><div className="space-y-3"><Input name="id" label="Journal ID" required/><Input name="period_id" label="Fiscal period ID"/><Input name="ledger_id" label="Ledger ID"/><Input name="cost_center_id" label="Cost center ID"/><Input name="profit_center_id" label="Profit center ID"/></div><button disabled={busy} className={secondary}>Validate balance & post</button></form>
      <form onSubmit={e=>void submit(e,'create-customer')} className={card}><div className="mb-4 text-sm font-black text-white">AR customer</div><div className="space-y-3"><Input name="organization_id" label="Organization ID" required/><Input name="person_id" label="Person ID"/><Input name="family_id" label="Family ID"/><Input name="customer_code" label="Customer code" required/><Input name="display_name" label="Display name" required/></div><button disabled={busy} className={button}>Create customer</button></form>
      <form onSubmit={e=>void submit(e,'create-invoice')} className={card}><div className="mb-4 text-sm font-black text-white">AR invoice</div><div className="space-y-3"><Input name="legal_entity_id" label="Legal entity ID"/><Input name="customer_id" label="Customer ID"/><Input name="invoice_number" label="Invoice number" required/><Input name="invoice_date" label="Invoice date" type="date"/><Input name="due_date" label="Due date" type="date"/><Input name="currency" label="Currency" placeholder="CAD"/><TextArea name="lines" label="Invoice lines JSON" placeholder='[{"description":"Registration","quantity":1,"unit_price":100,"tax_amount":5}]'/></div><button disabled={busy} className={button}>Create calculated invoice</button></form>

      <form onSubmit={e=>void submit(e,'issue-invoice')} className={card}><div className="mb-4 text-sm font-black text-white">Issue invoice</div><Input name="id" label="Invoice ID" required/><button disabled={busy} className={secondary}>Issue invoice</button></form>
      <form onSubmit={e=>void submit(e,'record-payment')} className={card}><div className="mb-4 text-sm font-black text-white">Record AR payment</div><div className="space-y-3"><Input name="invoice_id" label="Invoice ID"/><Input name="customer_id" label="Customer ID"/><Input name="amount" label="Amount" required type="number"/><Input name="payment_date" label="Payment date" type="date"/><Input name="currency" label="Currency" placeholder="CAD"/><Input name="method" label="Method"/><Input name="reference" label="Reference"/></div><button disabled={busy} className={button}>Record & allocate payment</button></form>
      <form onSubmit={e=>void submit(e,'create-ar-adjustment')} className={card}><div className="mb-4 text-sm font-black text-white">AR adjustment</div><div className="space-y-3"><Input name="invoice_id" label="Invoice ID"/><Input name="customer_id" label="Customer ID"/><Input name="adjustment_type" label="Adjustment type" required/><Input name="amount" label="Amount" required type="number"/><Input name="reason" label="Reason"/></div><button disabled={busy} className={button}>Create pending adjustment</button></form>

      <form onSubmit={e=>void submit(e,'approve-ar-adjustment')} className={card}><div className="mb-4 text-sm font-black text-white">Approve AR adjustment</div><Input name="id" label="Adjustment ID" required/><button disabled={busy} className={secondary}>Approve adjustment</button></form>
      <form onSubmit={e=>void submit(e,'create-vendor')} className={card}><div className="mb-4 text-sm font-black text-white">AP vendor</div><div className="space-y-3"><Input name="organization_id" label="Organization ID"/><Input name="vendor_code" label="Vendor code" required/><Input name="name" label="Vendor name" required/><Input name="tax_id" label="Tax ID"/></div><button disabled={busy} className={button}>Create vendor</button></form>
      <form onSubmit={e=>void submit(e,'create-vendor-bill')} className={card}><div className="mb-4 text-sm font-black text-white">Vendor bill</div><div className="space-y-3"><Input name="legal_entity_id" label="Legal entity ID"/><Input name="vendor_id" label="Vendor ID"/><Input name="bill_number" label="Bill number" required/><Input name="bill_date" label="Bill date" type="date"/><Input name="due_date" label="Due date" type="date"/><Input name="currency" label="Currency" placeholder="CAD"/><Input name="tax_total" label="Tax total" type="number"/><TextArea name="lines" label="Bill lines JSON" placeholder='[{"description":"Timing equipment","quantity":1,"unit_price":500}]'/></div><button disabled={busy} className={button}>Create vendor bill</button></form>

      <form onSubmit={e=>void submit(e,'post-vendor-bill')} className={card}><div className="mb-4 text-sm font-black text-white">Post vendor bill</div><Input name="id" label="Vendor bill ID" required/><button disabled={busy} className={secondary}>Post bill</button></form>
      <form onSubmit={e=>void submit(e,'record-ap-payment')} className={card}><div className="mb-4 text-sm font-black text-white">Record AP payment</div><div className="space-y-3"><Input name="vendor_bill_id" label="Vendor bill ID"/><Input name="vendor_id" label="Vendor ID"/><Input name="amount" label="Amount" required type="number"/><Input name="payment_date" label="Payment date" type="date"/><Input name="currency" label="Currency" placeholder="CAD"/><Input name="method" label="Method"/><Input name="reference" label="Reference"/></div><button disabled={busy} className={button}>Record vendor payment</button></form>
      <form onSubmit={e=>void submit(e,'create-budget')} className={card}><div className="mb-4 text-sm font-black text-white">Budget</div><div className="space-y-3"><Input name="legal_entity_id" label="Legal entity ID"/><Input name="name" label="Budget name" required/><Input name="fiscal_year" label="Fiscal year" required type="number"/><Input name="currency" label="Currency" placeholder="CAD"/><TextArea name="lines" label="Budget lines JSON" placeholder='[{"account_id":"...","period_start":"2026-01-01","period_end":"2026-12-31","budget_amount":10000}]'/></div><button disabled={busy} className={button}>Create budget</button></form>

      <form onSubmit={e=>void submit(e,'set-budget-status')} className={card}><div className="mb-4 text-sm font-black text-white">Budget lifecycle</div><div className="space-y-3"><Input name="id" label="Budget ID" required/><Input name="status" label="Status" required placeholder="approved, locked, closed"/></div><button disabled={busy} className={secondary}>Apply budget status</button></form>
      <form onSubmit={e=>void submit(e,'create-cost-center')} className={card}><div className="mb-4 text-sm font-black text-white">Cost center</div><div className="space-y-3"><Input name="legal_entity_id" label="Legal entity ID"/><Input name="code" label="Code" required/><Input name="name" label="Name" required/><Input name="parent_id" label="Parent cost center ID"/></div><button disabled={busy} className={button}>Create cost center</button></form>
      <form onSubmit={e=>void submit(e,'create-profit-center')} className={card}><div className="mb-4 text-sm font-black text-white">Profit center</div><div className="space-y-3"><Input name="legal_entity_id" label="Legal entity ID"/><Input name="code" label="Code" required/><Input name="name" label="Name" required/></div><button disabled={busy} className={button}>Create profit center</button></form>

      <form onSubmit={e=>void submit(e,'submit-expense')} className={card}><div className="mb-4 text-sm font-black text-white">Expense</div><div className="space-y-3"><Input name="legal_entity_id" label="Legal entity ID"/><Input name="submitted_by" label="Submitted by person ID"/><Input name="expense_date" label="Expense date" type="date"/><Input name="amount" label="Amount" required type="number"/><Input name="currency" label="Currency" placeholder="CAD"/><Input name="category" label="Category"/><Input name="account_id" label="Account ID"/><Input name="receipt_document_id" label="Receipt document ID"/></div><button disabled={busy} className={button}>Submit expense</button></form>
      <form onSubmit={e=>void submit(e,'set-expense-status')} className={card}><div className="mb-4 text-sm font-black text-white">Expense lifecycle</div><div className="space-y-3"><Input name="id" label="Expense ID" required/><Input name="status" label="Status" required placeholder="approved, rejected, paid"/></div><button disabled={busy} className={secondary}>Apply expense status</button></form>
      <form onSubmit={e=>void submit(e,'record-bank-transaction')} className={card}><div className="mb-4 text-sm font-black text-white">Bank transaction</div><div className="space-y-3"><Input name="bank_account_id" label="Bank account ID" required/><Input name="transaction_date" label="Transaction date" type="date"/><Input name="amount" label="Amount" required type="number"/><Input name="description" label="Description"/><Input name="external_reference" label="External reference"/></div><button disabled={busy} className={button}>Record bank transaction</button></form>
      <form onSubmit={e=>void submit(e,'set-bank-reconciliation')} className={card}><div className="mb-4 text-sm font-black text-white">Bank reconciliation</div><div className="space-y-3"><Input name="id" label="Bank transaction ID" required/><Input name="status" label="Reconciliation status" required placeholder="matched, reconciled, exception"/></div><button disabled={busy} className={secondary}>Apply reconciliation</button></form>
    </div>
  </section>;
}
