import { NextRequest,NextResponse } from 'next/server';
import { requireAdmin,AdminAuthError,type AdminIdentity } from '@/lib/server/requireAdmin';
import { adminRest } from '@/lib/server/adminRest';
import { writeAdminAuditEvent } from '@/lib/server/writeAdminAuditEvent';
export const dynamic='force-dynamic'; export const revalidate=0;
type Row=Record<string,any>;
function canExecute(actor:AdminIdentity){return actor.isSuperUser||actor.roles.some(r=>['org_admin','treasurer'].includes(r))}
export async function GET(request:NextRequest){
 try{
  const actor=await requireAdmin(request); const caseId=request.nextUrl.searchParams.get('case_id'); if(!caseId) throw new Error('case_id is required.');
  const c=(await adminRest<Row[]>(actor,`urws_cases?select=id,organization_id,subject_type,subject_id&id=eq.${encodeURIComponent(caseId)}&limit=1`))?.[0]; if(!c)throw new Error('URWS case not found.');
  const dispositions=await adminRest<Row[]>(actor,`urws_financial_dispositions?select=id,case_id,decision_id,remedy_id,disposition_type,amount,currency,status,invoice_id,payment_id,refund_id,external_reference,execution_note,authorized_at,execution_started_at,completed_at,failed_at,created_at,updated_at&case_id=eq.${encodeURIComponent(caseId)}&order=created_at.desc`).catch(()=>[] as Row[]);
  let refundRequests:Row[]=[]; let payments:Row[]=[];
  if(c.subject_type==='membership'&&c.subject_id){
   refundRequests=await adminRest<Row[]>(actor,`refund_requests?select=id,membership_id,amount,currency,requested_at,status,policy_eligibility,recommended_disposition,resulting_refund_id&membership_id=eq.${encodeURIComponent(String(c.subject_id))}&status=eq.approved&order=requested_at.desc`).catch(()=>[] as Row[]);
   const lines=await adminRest<Row[]>(actor,`invoice_lines?select=invoice_id&entity_type=ilike.membership&entity_id=eq.${encodeURIComponent(String(c.subject_id))}`).catch(()=>[] as Row[]);
   const invoiceIds=[...new Set(lines.map(x=>String(x.invoice_id||'')).filter(Boolean))];
   if(invoiceIds.length){const q=invoiceIds.map(encodeURIComponent).join(',');payments=await adminRest<Row[]>(actor,`payments?select=id,invoice_id,payment_date,amount,currency,method,processor_reference,status&invoice_id=in.(${q})&order=payment_date.desc`).catch(()=>[] as Row[]);}
  }
  return NextResponse.json({dispositions,refundRequests,payments,canExecute:canExecute(actor)});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'URWS execution unavailable.'},{status:e instanceof AdminAuthError?e.status:500})}
}
export async function POST(request:NextRequest){
 try{
  const actor=await requireAdmin(request); if(!canExecute(actor)) throw new AdminAuthError('Your Admin role cannot execute financial remedies.',403);
  const body=await request.json() as Row; const action=String(body.action||'');
  if(action==='prepare-refund'){
   const requestId=String(body.refund_request_id||''),paymentId=String(body.payment_id||''); if(!requestId||!paymentId)throw new Error('Approved refund request and source payment are required.');
   const refundId=await adminRest<string>(actor,'rpc/urws_prepare_refund_from_request',{method:'POST',body:JSON.stringify({p_refund_request_id:requestId,p_payment_id:paymentId})});
   await writeAdminAuditEvent(actor,{action:'URWS_CANONICAL_REFUND_PREPARED',entityType:'refund',entityId:String(refundId||''),afterData:{refund_request_id:requestId,payment_id:paymentId,status:'pending'}});
   return NextResponse.json({ok:true,refundId});
  }
  if(action==='begin'){
   const remedyId=String(body.remedy_id||''); if(!remedyId) throw new Error('remedy_id is required.');
   const id=await adminRest<string>(actor,'rpc/urws_begin_financial_execution',{method:'POST',body:JSON.stringify({p_remedy_id:remedyId,p_invoice_id:body.invoice_id||null,p_payment_id:body.payment_id||null,p_refund_id:body.refund_id||null,p_external_reference:String(body.external_reference||'')||null,p_note:String(body.note||'')||null})});
   await writeAdminAuditEvent(actor,{action:'URWS_FINANCIAL_EXECUTION_STARTED',entityType:'urws_financial_disposition',entityId:String(id||''),afterData:{remedy_id:remedyId,refund_id:body.refund_id||null}});
   return NextResponse.json({ok:true,dispositionId:id});
  }
  if(action==='complete'){
   const dispositionId=String(body.disposition_id||''); if(!dispositionId) throw new Error('disposition_id is required.');
   await adminRest(actor,'rpc/urws_complete_financial_execution',{method:'POST',body:JSON.stringify({p_disposition_id:dispositionId,p_success:Boolean(body.success),p_external_reference:String(body.external_reference||'')||null,p_note:String(body.note||'')||null})});
   await writeAdminAuditEvent(actor,{action:Boolean(body.success)?'URWS_FINANCIAL_EXECUTION_COMPLETED':'URWS_FINANCIAL_EXECUTION_FAILED',entityType:'urws_financial_disposition',entityId:dispositionId,afterData:{success:Boolean(body.success)}});
   return NextResponse.json({ok:true});
  }
  throw new Error('Unsupported URWS execution action.');
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'URWS execution action failed.'},{status:e instanceof AdminAuthError?e.status:400})}
}
