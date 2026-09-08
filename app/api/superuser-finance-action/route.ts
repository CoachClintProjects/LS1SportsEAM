import { NextRequest, NextResponse } from 'next/server';
import { requireSuperUser, SuperUserAuthError } from '@/lib/server/requireSuperUser';
import { superUserRest } from '@/lib/server/superUserRest';
import { writeAuditEvent } from '@/lib/server/writeAuditEvent';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type JsonRow = Record<string, unknown>;

function req(value: unknown, label: string, max = 160) { const s = String(value || '').trim(); if (!s) throw new Error(`${label} is required.`); if (s.length > max) throw new Error(`${label} is too long.`); return s; }
function opt(value: unknown, max = 500) { const s = String(value || '').trim(); if (!s) return null; if (s.length > max) throw new Error('Value is too long.'); return s; }
function money(value: unknown, label: string) { const n = Number(value); if (!Number.isFinite(n)) throw new Error(`${label} must be numeric.`); return Math.round(n * 100) / 100; }
function positive(value: unknown, label: string) { const n = money(value, label); if (n <= 0) throw new Error(`${label} must be greater than zero.`); return n; }
function currency(value: unknown) { const c = String(value || 'CAD').trim().toUpperCase(); if (!/^[A-Z]{3}$/.test(c)) throw new Error('Currency must be a 3-letter code.'); return c; }
function jsonArray(value: unknown, label: string): JsonRow[] { if (Array.isArray(value)) return value as JsonRow[]; try { const parsed = JSON.parse(String(value || '[]')); if (!Array.isArray(parsed)) throw new Error(); return parsed; } catch { throw new Error(`${label} must be a JSON array.`); } }

function invoiceLines(raw: JsonRow[]) {
  if (!raw.length) throw new Error('At least one invoice line is required.');
  return raw.map((line, index) => {
    const quantity = positive(line.quantity ?? 1, `Line ${index + 1} quantity`);
    const unitPrice = money(line.unit_price ?? 0, `Line ${index + 1} unit price`);
    const tax = money(line.tax_amount ?? 0, `Line ${index + 1} tax`);
    const lineTotal = Math.round((quantity * unitPrice + tax) * 100) / 100;
    return { line_no: index + 1, description: req(line.description, `Line ${index + 1} description`, 300), quantity, unit_price: unitPrice, tax_amount: tax, line_total: lineTotal, account_id: line.account_id || null, entity_type: line.entity_type || null, entity_id: line.entity_id || null };
  });
}
function billLines(raw: JsonRow[]) {
  if (!raw.length) throw new Error('At least one vendor-bill line is required.');
  return raw.map((line, index) => {
    const quantity = positive(line.quantity ?? 1, `Line ${index + 1} quantity`);
    const unitPrice = money(line.unit_price ?? 0, `Line ${index + 1} unit price`);
    return { line_no: index + 1, description: req(line.description, `Line ${index + 1} description`, 300), quantity, unit_price: unitPrice, line_total: Math.round(quantity * unitPrice * 100) / 100, account_id: line.account_id || null, cost_center_id: line.cost_center_id || null, tax_code_id: line.tax_code_id || null };
  });
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperUser(request);
    if (!actor.canManagePlatformSettings) throw new SuperUserAuthError('Platform-management permission required.', 403);
    const rest = (path: string, init: RequestInit = {}) => superUserRest<any>(actor, path, init);
    const one = async (table: string, id: string) => (await rest(`${table}?id=eq.${encodeURIComponent(id)}&select=*&limit=1`))?.[0] || null;
    const tenantId = async () => (await rest('tenants?select=id&limit=1'))?.[0]?.id || null;
    const body = await request.json();
    const action = String(body.action || '');
    const tenant = await tenantId();

    if (action === 'create-account') {
      const item = (await rest('chart_of_accounts', { method: 'POST', body: JSON.stringify({ legal_entity_id: req(body.legal_entity_id,'Legal entity ID',80), account_code: req(body.account_code,'Account code',80), account_name: req(body.account_name,'Account name'), account_type: req(body.account_type,'Account type',80), parent_account_id: body.parent_account_id || null, active: body.active !== false }) }))?.[0];
      await writeAuditEvent(actor,{ action:'GL_ACCOUNT_CREATED',entityType:'chart_of_accounts',entityId:item?.id||null,tenantId:tenant,afterData:item||body,reason:'Super User created chart-of-accounts record' }); return NextResponse.json(item);
    }
    if (action === 'create-ledger') {
      const item = (await rest('accounting_ledgers',{method:'POST',body:JSON.stringify({legal_entity_id:req(body.legal_entity_id,'Legal entity ID',80),code:req(body.code,'Ledger code',80),name:req(body.name,'Ledger name'),accounting_basis:opt(body.accounting_basis,80),currency:currency(body.currency),is_primary:Boolean(body.is_primary)})}))?.[0];
      await writeAuditEvent(actor,{action:'ACCOUNTING_LEDGER_CREATED',entityType:'accounting_ledgers',entityId:item?.id||null,tenantId:tenant,afterData:item||body,reason:'Super User created accounting ledger'}); return NextResponse.json(item);
    }
    if (action === 'create-journal') {
      const lines = jsonArray(body.lines,'Journal lines').map((line,index)=>({account_id:req(line.account_id,`Line ${index+1} account ID`,80),debit:money(line.debit??0,`Line ${index+1} debit`),credit:money(line.credit??0,`Line ${index+1} credit`),currency:currency(line.currency||body.currency),entity_type:line.entity_type||null,entity_id:line.entity_id||null,description:opt(line.description,300)}));
      if (lines.length < 2) throw new Error('A journal requires at least two lines.');
      const debits = Math.round(lines.reduce((s,l)=>s+l.debit,0)*100)/100, credits = Math.round(lines.reduce((s,l)=>s+l.credit,0)*100)/100;
      if (debits <= 0 || Math.abs(debits-credits) > 0.001) throw new Error(`Journal is not balanced. Debits ${debits.toFixed(2)} must equal credits ${credits.toFixed(2)}.`);
      const journal = (await rest('gl_journals',{method:'POST',body:JSON.stringify({legal_entity_id:req(body.legal_entity_id,'Legal entity ID',80),journal_number:req(body.journal_number,'Journal number',100),journal_date:body.journal_date||new Date().toISOString().slice(0,10),source:opt(body.source,80)||'SUPERUSER',status:'draft',description:opt(body.description)})}))?.[0];
      if (!journal?.id) throw new Error('Journal creation failed.');
      const inserted = await rest('gl_lines',{method:'POST',body:JSON.stringify(lines.map(line=>({...line,journal_id:journal.id})))});
      await writeAuditEvent(actor,{action:'GL_JOURNAL_CREATED',entityType:'gl_journals',entityId:journal.id,tenantId:tenant,afterData:{journal,lines:inserted,debits,credits},reason:'Super User created balanced GL journal'}); return NextResponse.json({journal,lines:inserted,debits,credits});
    }
    if (action === 'post-journal') {
      const id=req(body.id,'Journal ID',80), before=await one('gl_journals',id); if(!before) return NextResponse.json({error:'Journal not found.'},{status:404}); if(before.status==='posted') return NextResponse.json(before);
      const lines=await rest(`gl_lines?journal_id=eq.${encodeURIComponent(id)}&select=*`); const debits=Math.round((lines||[]).reduce((s:number,l:JsonRow)=>s+Number(l.debit||0),0)*100)/100, credits=Math.round((lines||[]).reduce((s:number,l:JsonRow)=>s+Number(l.credit||0),0)*100)/100;
      if(!lines?.length||debits<=0||Math.abs(debits-credits)>0.001) throw new Error('Journal cannot post until its lines are balanced.');
      const posting=(await rest('journal_postings',{method:'POST',body:JSON.stringify({journal_id:id,period_id:body.period_id||null,ledger_id:body.ledger_id||null,cost_center_id:body.cost_center_id||null,profit_center_id:body.profit_center_id||null,posted_at:new Date().toISOString(),posting_status:'posted'})}))?.[0];
      const after=(await rest(`gl_journals?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status:'posted'})}))?.[0]||await one('gl_journals',id);
      await writeAuditEvent(actor,{action:'GL_JOURNAL_POSTED',entityType:'gl_journals',entityId:id,tenantId:tenant,beforeData:before,afterData:{journal:after,posting},reason:'Balanced journal posted by Super User'}); return NextResponse.json({journal:after,posting});
    }
    if (action === 'create-customer') {
      const item=(await rest('customers',{method:'POST',body:JSON.stringify({organization_id:req(body.organization_id,'Organization ID',80),person_id:body.person_id||null,family_id:body.family_id||null,customer_code:req(body.customer_code,'Customer code',80),display_name:req(body.display_name,'Display name'),status:'active'})}))?.[0];
      await writeAuditEvent(actor,{action:'CUSTOMER_CREATED',entityType:'customers',entityId:item?.id||null,tenantId:tenant,afterData:item||body,reason:'Super User created AR customer'}); return NextResponse.json(item);
    }
    if (action === 'create-invoice') {
      const lines=invoiceLines(jsonArray(body.lines,'Invoice lines')); const subtotal=Math.round(lines.reduce((s,l)=>s+(l.quantity*l.unit_price),0)*100)/100, tax=Math.round(lines.reduce((s,l)=>s+l.tax_amount,0)*100)/100, total=Math.round((subtotal+tax)*100)/100;
      const invoice=(await rest('invoices',{method:'POST',body:JSON.stringify({legal_entity_id:body.legal_entity_id||null,customer_id:body.customer_id||null,invoice_number:req(body.invoice_number,'Invoice number',100),invoice_date:body.invoice_date||new Date().toISOString().slice(0,10),due_date:body.due_date||null,currency:currency(body.currency),subtotal,tax_total:tax,total,balance_due:total,status:'draft'})}))?.[0]; if(!invoice?.id) throw new Error('Invoice creation failed.');
      const inserted=await rest('invoice_lines',{method:'POST',body:JSON.stringify(lines.map(line=>({...line,invoice_id:invoice.id})))});
      await writeAuditEvent(actor,{action:'INVOICE_CREATED',entityType:'invoices',entityId:invoice.id,tenantId:tenant,afterData:{invoice,lines:inserted},reason:'Super User created invoice from calculated lines'}); return NextResponse.json({invoice,lines:inserted});
    }
    if (action === 'issue-invoice') {
      const id=req(body.id,'Invoice ID',80),before=await one('invoices',id); if(!before)return NextResponse.json({error:'Invoice not found.'},{status:404}); if(Number(before.total||0)<=0) throw new Error('Invoice must have a positive total before issue.');
      const after=(await rest(`invoices?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status:'issued'})}))?.[0]||await one('invoices',id); await writeAuditEvent(actor,{action:'INVOICE_ISSUED',entityType:'invoices',entityId:id,tenantId:tenant,beforeData:before,afterData:after,reason:'Super User issued invoice'}); return NextResponse.json(after);
    }
    if (action === 'record-payment') {
      const amount=positive(body.amount,'Payment amount'), invoiceId=String(body.invoice_id||'').trim()||null; let invoice=null; if(invoiceId){invoice=await one('invoices',invoiceId);if(!invoice)return NextResponse.json({error:'Invoice not found.'},{status:404});if(amount>Number(invoice.balance_due||0)+0.001)throw new Error('Payment exceeds invoice balance. Record unapplied credit separately.');}
      const payment=(await rest('payments',{method:'POST',body:JSON.stringify({customer_id:body.customer_id||invoice?.customer_id||null,invoice_id:invoiceId,payment_date:body.payment_date||new Date().toISOString().slice(0,10),amount,currency:currency(body.currency||invoice?.currency),method:opt(body.method,80),processor_reference:opt(body.reference,160),status:'posted'})}))?.[0];
      let updatedInvoice=null,allocation=null;if(invoiceId&&payment?.id){allocation=(await rest('payment_allocations',{method:'POST',body:JSON.stringify({payment_id:payment.id,invoice_id:invoiceId,amount})}))?.[0];const balance=Math.round(Math.max(0,Number(invoice.balance_due||0)-amount)*100)/100;updatedInvoice=(await rest(`invoices?id=eq.${encodeURIComponent(invoiceId)}`,{method:'PATCH',body:JSON.stringify({balance_due:balance,status:balance===0?'paid':'partially_paid'})}))?.[0];}
      await writeAuditEvent(actor,{action:'PAYMENT_RECORDED',entityType:'payments',entityId:payment?.id||null,tenantId:tenant,afterData:{payment,allocation,invoice:updatedInvoice},reason:'Super User recorded customer payment and allocation'});return NextResponse.json({payment,allocation,invoice:updatedInvoice});
    }
    if (action === 'create-ar-adjustment') {
      const item=(await rest('ar_adjustments',{method:'POST',body:JSON.stringify({invoice_id:body.invoice_id||null,customer_id:body.customer_id||null,adjustment_type:req(body.adjustment_type,'Adjustment type',80),amount:positive(body.amount,'Adjustment amount'),reason:opt(body.reason),status:'pending'})}))?.[0];await writeAuditEvent(actor,{action:'AR_ADJUSTMENT_CREATED',entityType:'ar_adjustments',entityId:item?.id||null,tenantId:tenant,afterData:item||body,reason:'Super User created AR adjustment'});return NextResponse.json(item);
    }
    if (action === 'approve-ar-adjustment') {
      const id=req(body.id,'Adjustment ID',80),before=await one('ar_adjustments',id);if(!before)return NextResponse.json({error:'AR adjustment not found.'},{status:404});const after=(await rest(`ar_adjustments?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status:'approved',approved_by:null})}))?.[0];await writeAuditEvent(actor,{action:'AR_ADJUSTMENT_APPROVED',entityType:'ar_adjustments',entityId:id,tenantId:tenant,beforeData:before,afterData:after,reason:'Super User approved AR adjustment'});return NextResponse.json(after);
    }
    if (action === 'create-vendor') {
      const item=(await rest('vendors',{method:'POST',body:JSON.stringify({organization_id:body.organization_id||null,vendor_code:req(body.vendor_code,'Vendor code',80),name:req(body.name,'Vendor name'),tax_id:opt(body.tax_id,120),status:'active'})}))?.[0];await writeAuditEvent(actor,{action:'VENDOR_CREATED',entityType:'vendors',entityId:item?.id||null,tenantId:tenant,afterData:item||body,reason:'Super User created AP vendor'});return NextResponse.json(item);
    }
    if (action === 'create-vendor-bill') {
      const lines=billLines(jsonArray(body.lines,'Vendor bill lines'));const subtotal=Math.round(lines.reduce((s,l)=>s+l.line_total,0)*100)/100,tax=money(body.tax_total||0,'Tax total'),total=Math.round((subtotal+tax)*100)/100;
      const bill=(await rest('vendor_bills',{method:'POST',body:JSON.stringify({legal_entity_id:body.legal_entity_id||null,vendor_id:body.vendor_id||null,bill_number:req(body.bill_number,'Bill number',100),bill_date:body.bill_date||new Date().toISOString().slice(0,10),due_date:body.due_date||null,currency:currency(body.currency),subtotal,tax_total:tax,total,balance_due:total,status:'draft'})}))?.[0];if(!bill?.id)throw new Error('Vendor bill creation failed.');const inserted=await rest('vendor_bill_lines',{method:'POST',body:JSON.stringify(lines.map(line=>({...line,vendor_bill_id:bill.id})))});await writeAuditEvent(actor,{action:'VENDOR_BILL_CREATED',entityType:'vendor_bills',entityId:bill.id,tenantId:tenant,afterData:{bill,lines:inserted},reason:'Super User created AP vendor bill'});return NextResponse.json({bill,lines:inserted});
    }
    if (action === 'post-vendor-bill') {
      const id=req(body.id,'Vendor bill ID',80),before=await one('vendor_bills',id);if(!before)return NextResponse.json({error:'Vendor bill not found.'},{status:404});if(Number(before.total||0)<=0)throw new Error('Vendor bill must have a positive total before posting.');const after=(await rest(`vendor_bills?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status:'posted'})}))?.[0];await writeAuditEvent(actor,{action:'VENDOR_BILL_POSTED',entityType:'vendor_bills',entityId:id,tenantId:tenant,beforeData:before,afterData:after,reason:'Super User posted vendor bill'});return NextResponse.json(after);
    }
    if (action === 'record-ap-payment') {
      const billId=String(body.vendor_bill_id||'').trim()||null, amount=positive(body.amount,'AP payment amount');let bill=null;if(billId){bill=await one('vendor_bills',billId);if(!bill)return NextResponse.json({error:'Vendor bill not found.'},{status:404});if(amount>Number(bill.balance_due||0)+0.001)throw new Error('AP payment exceeds vendor-bill balance.');}
      const payment=(await rest('ap_payments',{method:'POST',body:JSON.stringify({vendor_id:body.vendor_id||bill?.vendor_id||null,vendor_bill_id:billId,payment_date:body.payment_date||new Date().toISOString().slice(0,10),amount,currency:currency(body.currency||bill?.currency),method:opt(body.method,80),reference:opt(body.reference,160),status:'posted'})}))?.[0];let updatedBill=null;if(billId){const balance=Math.round(Math.max(0,Number(bill.balance_due||0)-amount)*100)/100;updatedBill=(await rest(`vendor_bills?id=eq.${encodeURIComponent(billId)}`,{method:'PATCH',body:JSON.stringify({balance_due:balance,status:balance===0?'paid':'partially_paid'})}))?.[0];}await writeAuditEvent(actor,{action:'AP_PAYMENT_RECORDED',entityType:'ap_payments',entityId:payment?.id||null,tenantId:tenant,afterData:{payment,vendor_bill:updatedBill},reason:'Super User recorded vendor payment'});return NextResponse.json({payment,vendor_bill:updatedBill});
    }
    if (action === 'create-budget') {
      const budget=(await rest('budgets',{method:'POST',body:JSON.stringify({legal_entity_id:body.legal_entity_id||null,name:req(body.name,'Budget name'),fiscal_year:Number(body.fiscal_year),currency:currency(body.currency),status:'draft'})}))?.[0];if(!budget?.id)throw new Error('Budget creation failed.');const raw=jsonArray(body.lines||[],'Budget lines');let lines:JsonRow[]=[];if(raw.length){lines=await rest('budget_lines',{method:'POST',body:JSON.stringify(raw.map(line=>({budget_id:budget.id,account_id:line.account_id||null,period_start:line.period_start||null,period_end:line.period_end||null,budget_amount:money(line.budget_amount,'Budget amount')})))})}await writeAuditEvent(actor,{action:'BUDGET_CREATED',entityType:'budgets',entityId:budget.id,tenantId:tenant,afterData:{budget,lines},reason:'Super User created budget'});return NextResponse.json({budget,lines});
    }
    if (action === 'set-budget-status') {
      const id=req(body.id,'Budget ID',80),status=req(body.status,'Budget status',40).toLowerCase(),before=await one('budgets',id);if(!before)return NextResponse.json({error:'Budget not found.'},{status:404});const after=(await rest(`budgets?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status})}))?.[0];await writeAuditEvent(actor,{action:'BUDGET_STATUS_CHANGED',entityType:'budgets',entityId:id,tenantId:tenant,beforeData:before,afterData:after,reason:`Super User set budget status to ${status}`});return NextResponse.json(after);
    }
    if (action === 'create-cost-center' || action === 'create-profit-center') {
      const table=action==='create-cost-center'?'cost_centers':'profit_centers';const payload:JsonRow={legal_entity_id:body.legal_entity_id||null,code:req(body.code,'Code',80),name:req(body.name,'Name'),active:true};if(table==='cost_centers')payload.parent_id=body.parent_id||null;const item=(await rest(table,{method:'POST',body:JSON.stringify(payload)}))?.[0];await writeAuditEvent(actor,{action:action==='create-cost-center'?'COST_CENTER_CREATED':'PROFIT_CENTER_CREATED',entityType:table,entityId:item?.id||null,tenantId:tenant,afterData:item||payload,reason:'Super User created finance dimension'});return NextResponse.json(item);
    }
    if (action === 'submit-expense') {
      const item=(await rest('expenses',{method:'POST',body:JSON.stringify({legal_entity_id:body.legal_entity_id||null,submitted_by:body.submitted_by||null,expense_date:body.expense_date||new Date().toISOString().slice(0,10),amount:positive(body.amount,'Expense amount'),currency:currency(body.currency),category:opt(body.category,120),account_id:body.account_id||null,status:'submitted',receipt_document_id:body.receipt_document_id||null})}))?.[0];await writeAuditEvent(actor,{action:'EXPENSE_SUBMITTED',entityType:'expenses',entityId:item?.id||null,tenantId:tenant,afterData:item||body,reason:'Super User submitted expense'});return NextResponse.json(item);
    }
    if (action === 'set-expense-status') {
      const id=req(body.id,'Expense ID',80),status=req(body.status,'Expense status',40).toLowerCase(),before=await one('expenses',id);if(!before)return NextResponse.json({error:'Expense not found.'},{status:404});const after=(await rest(`expenses?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status})}))?.[0];await writeAuditEvent(actor,{action:'EXPENSE_STATUS_CHANGED',entityType:'expenses',entityId:id,tenantId:tenant,beforeData:before,afterData:after,reason:`Super User set expense status to ${status}`});return NextResponse.json(after);
    }
    if (action === 'record-bank-transaction') {
      const item=(await rest('bank_transactions',{method:'POST',body:JSON.stringify({bank_account_id:req(body.bank_account_id,'Bank account ID',80),transaction_date:body.transaction_date||new Date().toISOString().slice(0,10),amount:money(body.amount,'Transaction amount'),description:opt(body.description),external_reference:opt(body.external_reference,160),reconciliation_status:'unmatched'})}))?.[0];await writeAuditEvent(actor,{action:'BANK_TRANSACTION_RECORDED',entityType:'bank_transactions',entityId:item?.id||null,tenantId:tenant,afterData:item||body,reason:'Super User recorded bank transaction'});return NextResponse.json(item);
    }
    if (action === 'set-bank-reconciliation') {
      const id=req(body.id,'Bank transaction ID',80),status=req(body.status,'Reconciliation status',40).toLowerCase(),before=await one('bank_transactions',id);if(!before)return NextResponse.json({error:'Bank transaction not found.'},{status:404});const after=(await rest(`bank_transactions?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({reconciliation_status:status})}))?.[0];await writeAuditEvent(actor,{action:'BANK_RECONCILIATION_CHANGED',entityType:'bank_transactions',entityId:id,tenantId:tenant,beforeData:before,afterData:after,reason:`Super User changed bank reconciliation to ${status}`});return NextResponse.json(after);
    }

    return NextResponse.json({error:'Unsupported finance action.'},{status:400});
  } catch (error) {
    if (error instanceof SuperUserAuthError) return NextResponse.json({error:error.message},{status:error.status});
    return NextResponse.json({error:error instanceof Error?error.message:'Finance action failed.'},{status:400});
  }
}
