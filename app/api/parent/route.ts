import { NextRequest,NextResponse } from 'next/server';
import { requireParent,parentRest,ParentAuthError } from '@/lib/server/requireParent';

export const dynamic='force-dynamic';
export const revalidate=0;
type Row=Record<string,any>;

function errorResponse(error:unknown,fallback='Parent action failed.'){
 const status=error instanceof ParentAuthError?error.status:400;
 return NextResponse.json({error:error instanceof Error?error.message:fallback},{status});
}

export async function GET(request:NextRequest){
 try{
  const actor=await requireParent(request);
  const requested=request.nextUrl.searchParams.get('family');
  const familyId=requested||actor.familyIds[0]||'';
  if(requested&&!actor.familyIds.includes(requested))throw new ParentAuthError('Family access denied.',403);
  if(!familyId)return NextResponse.json({family:null,members:[],athletes:[],tasks:[],messages:[],invoices:[],documents:[],trips:[],custody:[],volunteer:[],memberships:[],membershipRequests:[],metrics:{},source:'LS1SportsEAM Supabase',setupRequired:true});
  const [hub,memberships,membershipRequests]=await Promise.all([
   parentRest<Row>(actor,'rpc/parent_get_family_os',{method:'POST',body:JSON.stringify({p_family_id:familyId})}),
   parentRest<Row[]>(actor,'rpc/parent_membership_options',{method:'POST',body:JSON.stringify({p_family_id:familyId})}),
   parentRest<Row[]>(actor,'rpc/parent_urws_request_status',{method:'POST',body:JSON.stringify({p_family_id:familyId})}),
  ]);
  return NextResponse.json({...hub,memberships:memberships||[],membershipRequests:membershipRequests||[],source:'LS1SportsEAM Supabase'},{headers:{'Cache-Control':'no-store, max-age=0'}});
 }catch(error){return errorResponse(error,'Parent data unavailable.');}
}

export async function POST(request:NextRequest){
 try{
  const actor=await requireParent(request);
  const b=await request.json() as Row;
  const action=String(b.action||'');
  const familyId=String(b.family_id||actor.familyIds[0]||'');
  if(!familyId||!actor.familyIds.includes(familyId))throw new ParentAuthError('Family access denied.',403);
  if(action==='complete-task'){
   const id=String(b.id||'');if(!id)throw new Error('Task is required.');
   const row=await parentRest<Row[]>(actor,`family_tasks?id=eq.${encodeURIComponent(id)}&family_id=eq.${encodeURIComponent(familyId)}`,{method:'PATCH',body:JSON.stringify({status:'COMPLETED',completed_at:new Date().toISOString()})});
   if(!row?.[0])throw new Error('Task not found or not accessible.');return NextResponse.json(row[0]);
  }
  if(action==='ack-message'){
   const id=String(b.id||'');if(!id)throw new Error('Message is required.');
   const row=await parentRest<Row[]>(actor,`family_messages?id=eq.${encodeURIComponent(id)}&family_id=eq.${encodeURIComponent(familyId)}`,{method:'PATCH',body:JSON.stringify({acknowledged_at:new Date().toISOString()})});
   if(!row?.[0])throw new Error('Message not found or not accessible.');return NextResponse.json(row[0]);
  }
  if(action==='submit-membership-request'){
   const result=await parentRest<Row>(actor,'rpc/parent_submit_membership_request',{method:'POST',body:JSON.stringify({p_family_id:familyId,p_membership_id:String(b.membership_id||''),p_request_kind:String(b.request_kind||''),p_parent_summary:String(b.parent_summary||''),p_amount:b.amount===''||b.amount==null?null:Number(b.amount),p_requested_start_on:b.requested_start_on||null,p_requested_end_on:b.requested_end_on||null,p_acknowledged:Boolean(b.acknowledged),p_acknowledgement_text:String(b.acknowledgement_text||'')})});
   return NextResponse.json(result);
  }
  throw new Error('Unsupported Parent action.');
 }catch(error){return errorResponse(error);}
}
