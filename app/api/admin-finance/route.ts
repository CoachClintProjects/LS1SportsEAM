import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AdminAuthError, type AdminIdentity } from '@/lib/server/requireAdmin';
import { adminRest } from '@/lib/server/adminRest';
import { writeAdminAuditEvent } from '@/lib/server/writeAdminAuditEvent';

export const dynamic='force-dynamic';
export const revalidate=0;
type Row=Record<string,any>;

function canWrite(actor:AdminIdentity){return actor.isSuperUser||actor.roles.includes('org_admin')||actor.roles.includes('treasurer')}
function assertWrite(actor:AdminIdentity){if(!canWrite(actor))throw new AdminAuthError('Your Admin role does not allow finance changes.',403)}
function text(v:unknown){const s=String(v??'').trim();return s||null}
function num(v:unknown){const n=Number(v);return Number.isFinite(n)?n:0}

async function resolveTenant(actor:AdminIdentity){if(actor.tenantIds[0])return actor.tenantIds[0];const orgs=await adminRest<Array<{tenant_id:string}>>(actor,'organizations?select=tenant_id&order=created_at.asc&limit=1');if(orgs?.[0]?.tenant_id)return orgs[0].tenant_id;const tenants=await adminRest<Array<{id:string}>>(actor,'tenants?select=id&order=created_at.asc&limit=1');if(!tenants?.[0]?.id)throw new Error('No tenant is available for finance operations.');return tenants[0].id}

async function snapshot(actor:AdminIdentity){
  const [customers,billingAccounts,invoices,payments,vendorBills,organizations,legalEntities]=await Promise.all([
    adminRest<Row[]>(actor,'customers?select=id,organization_id,person_id,family_id,customer_code,display_name,status&order=display_name.asc&limit=500').catch(()=>[]),
    adminRest<Row[]>(actor,'billing_accounts?select=id,customer_id,currency,payment_terms_days,credit_limit,status&limit=500').catch(()=>[]),
    adminRest<Row[]>(actor,'invoices?select=id,legal_entity_id,customer_id,invoice_number,invoice_date,due_date,currency,subtotal,tax_total,total,balance_due,status&order=invoice_date.desc&limit=1000').catch(()=>[]),
    adminRest<Row[]>(actor,'payments?select=id,customer_id,invoice_id,payment_date,amount,currency,method,processor_reference,status&order=payment_date.desc&limit=1000').catch(()=>[]),
    adminRest<Row[]>(actor,'vendor_bills?select=id,legal_entity_id,vendor_id,bill_number,bill_date,due_date,currency,total,balance_due,status&order=bill_date.desc&limit=1000').catch(()=>[]),
    adminRest<Row[]>(actor,'organizations?select=id,name,status&order=name.asc&limit=250').catch(()=>[]),
    adminRest<Row[]>(actor,'legal_entities?select=id,organization_id,legal_name&order=legal_name.asc&limit=250').catch(()=>[]),
  ]);
  const arBalance=invoices.reduce((s,r)=>s+num(r.balance_due),0);
  const apBalance=vendorBills.reduce((s,r)=>s+num(r.balance_due),0);
  const today=new Date().toISOString().slice(0,10);
  const openInvoices=invoices.filter(r=>!['paid','void','cancelled'].includes(String(r.status||'').toLowerCase())).length;
  const pastDue=invoices.filter(r=>r.due_date&&String(r.due_date)<today&&!['paid','void','cancelled'].includes(String(r.status||'').toLowerCase())).length;
  return {customers,billingAccounts,invoices,payments,vendorBills,organizations,legalEntities,metrics:{arBalance,apBalance,openInvoices,pastDue},canWrite:canWrite(actor)};
}

export async function GET(request:NextRequest){try{const actor=await requireAdmin(request);return NextResponse.json(await snapshot(actor))}catch(error){const status=error instanceof AdminAuthError?error.status:500;return NextResponse.json({error:error instanceof Error?error.message:'Admin finance unavailable.'},{status})}}

export async function POST(request:NextRequest){
  try{
    const actor=await requireAdmin(request);assertWrite(actor);const body=(await request.json()) as Row;const action=String(body.action||'');const tenantId=await resolveTenant(actor);
    if(action==='create-customer'){
      const organization_id=String(body.organization_id||'');const display_name=String(body.display_name||'').trim();if(!organization_id||!display_name)throw new Error('Organization and customer name are required.');
      const customer_code=String(body.customer_code||'').trim()||`C-${Date.now().toString(36).toUpperCase()}`;
      const rows=await adminRest<Row[]>(actor,'customers',{method:'POST',body:JSON.stringify({organization_id,person_id:text(body.person_id),family_id:text(body.family_id),customer_code,display_name,status:'active'})});
      await writeAdminAuditEvent(actor,{action:'FINANCE_CUSTOMER_CREATED',entityType:'customer',entityId:rows?.[0]?.id,tenantId,afterData:rows?.[0]});return NextResponse.json({ok:true,record:rows?.[0]});
    }
    if(action==='create-billing-account'){
      const customer_id=String(body.customer_id||'');if(!customer_id)throw new Error('Customer is required.');
      const rows=await adminRest<Row[]>(actor,'billing_accounts',{method:'POST',body:JSON.stringify({customer_id,currency:text(body.currency)||'CAD',payment_terms_days:num(body.payment_terms_days)||30,credit_limit:body.credit_limit===''?null:num(body.credit_limit),status:'active'})});
      await writeAdminAuditEvent(actor,{action:'BILLING_ACCOUNT_CREATED',entityType:'billing_account',entityId:rows?.[0]?.id,tenantId,afterData:rows?.[0]});return NextResponse.json({ok:true,record:rows?.[0]});
    }
    if(action==='create-invoice'){
      const customer_id=String(body.customer_id||'');const invoice_number=String(body.invoice_number||'').trim();const subtotal=num(body.subtotal);const tax_total=num(body.tax_total);const total=subtotal+tax_total;if(!customer_id||!invoice_number)throw new Error('Customer and invoice number are required.');if(subtotal<0||tax_total<0)throw new Error('Invoice amounts cannot be negative.');
      const rows=await adminRest<Row[]>(actor,'invoices',{method:'POST',body:JSON.stringify({legal_entity_id:text(body.legal_entity_id),customer_id,invoice_number,invoice_date:text(body.invoice_date)||new Date().toISOString().slice(0,10),due_date:text(body.due_date),currency:text(body.currency)||'CAD',subtotal,tax_total,total,balance_due:total,status:'draft'})});
      await writeAdminAuditEvent(actor,{action:'INVOICE_CREATED',entityType:'invoice',entityId:rows?.[0]?.id,tenantId,afterData:rows?.[0]});return NextResponse.json({ok:true,record:rows?.[0]});
    }
    if(action==='set-invoice-status'){
      const id=String(body.id||'');const status=String(body.status||'').toLowerCase();if(!id||!['draft','issued','void'].includes(status))throw new Error('Valid invoice and status are required.');const before=(await adminRest<Row[]>(actor,`invoices?select=*&id=eq.${encodeURIComponent(id)}&limit=1`))?.[0];if(!before)throw new Error('Invoice not found.');const allowed=String(before.status||'').toLowerCase()==='draft'?['issued','void']:String(before.status||'').toLowerCase()==='issued'?['void']:[];if(!allowed.includes(status))throw new Error(`Invoice transition ${before.status} → ${status} is not allowed.`);const rows=await adminRest<Row[]>(actor,`invoices?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status})});await writeAdminAuditEvent(actor,{action:'INVOICE_STATUS_CHANGED',entityType:'invoice',entityId:id,tenantId,beforeData:before,afterData:rows?.[0],reason:text(body.reason)});return NextResponse.json({ok:true,record:rows?.[0]});
    }
    if(action==='record-payment'){
      const invoice_id=String(body.invoice_id||'');const amount=num(body.amount);if(!invoice_id||amount<=0)throw new Error('Invoice and positive payment amount are required.');const invoice=(await adminRest<Row[]>(actor,`invoices?select=*&id=eq.${encodeURIComponent(invoice_id)}&limit=1`))?.[0];if(!invoice)throw new Error('Invoice not found.');if(amount>num(invoice.balance_due))throw new Error('Payment cannot exceed the outstanding invoice balance.');
      const payments=await adminRest<Row[]>(actor,'payments',{method:'POST',body:JSON.stringify({customer_id:invoice.customer_id,invoice_id,payment_date:text(body.payment_date)||new Date().toISOString().slice(0,10),amount,currency:invoice.currency||'CAD',method:text(body.method),processor_reference:text(body.processor_reference),status:'posted'})});
      const balance_due=Math.max(0,num(invoice.balance_due)-amount);const invoiceStatus=balance_due===0?'paid':invoice.status==='draft'?'issued':invoice.status;const updated=await adminRest<Row[]>(actor,`invoices?id=eq.${encodeURIComponent(invoice_id)}`,{method:'PATCH',body:JSON.stringify({balance_due,status:invoiceStatus})});
      await writeAdminAuditEvent(actor,{action:'PAYMENT_POSTED',entityType:'invoice',entityId:invoice_id,tenantId,beforeData:invoice,afterData:{invoice:updated?.[0],payment:payments?.[0]}});return NextResponse.json({ok:true,record:payments?.[0]});
    }
    throw new Error('Unsupported finance action.');
  }catch(error){const status=error instanceof AdminAuthError?error.status:400;return NextResponse.json({error:error instanceof Error?error.message:'Finance action failed.'},{status})}
}
