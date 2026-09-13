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
  const rows=await adminRest<Row[]>(actor,`urws_financial_dispositions?select=id,case_id,decision_id,remedy_id,disposition_type,amount,currency,status,invoice_id,payment_id,refund_id,external_reference,execution_note,authorized_at,execution_started_at,completed_at,failed_at,created_at,updated_at&case_id=eq.${encodeURIComponent(caseId)}&order=created_at.desc`).catch(()=>[] as Row[]);
  return NextResponse.json({dispositions:rows,canExecute:canExecute(actor)});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'URWS execution unavailable.'},{status:e instanceof AdminAuthError?e.status:500})}
}
export async function POST(request:NextRequest){
 try{
  const actor=await requireAdmin(request); if(!canExecute(actor)) throw new AdminAuthError('Your Admin role cannot execute financial remedies.',403);
  const body=await request.json() as Row; const action=String(body.action||'');
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
