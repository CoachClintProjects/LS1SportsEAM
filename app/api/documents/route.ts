import { NextRequest, NextResponse } from 'next/server';

const URL=process.env.NEXT_PUBLIC_SUPABASE_URL??'https://xedfstgwotzxnztpembv.supabase.co';
const KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
const jsonHeaders={apikey:KEY??'',Authorization:`Bearer ${KEY??''}`,'Content-Type':'application/json',Accept:'application/json',Prefer:'return=representation'};
const safe=(v:string)=>v.replace(/[^a-zA-Z0-9._-]/g,'_');

async function ensureBucket(){
 const r=await fetch(`${URL}/storage/v1/bucket/ls1-documents`,{headers:{apikey:KEY??'',Authorization:`Bearer ${KEY??''}`}});
 if(r.ok)return;
 const c=await fetch(`${URL}/storage/v1/bucket`,{method:'POST',headers:{apikey:KEY??'',Authorization:`Bearer ${KEY??''}`,'Content-Type':'application/json'},body:JSON.stringify({id:'ls1-documents',name:'ls1-documents',public:false})});
 if(!c.ok && c.status!==409)throw new Error('Unable to initialize secure document repository.');
}
async function rest(path:string,init:RequestInit){const r=await fetch(`${URL}/rest/v1/${path}`,{...init,headers:{...jsonHeaders,...(init.headers||{})},cache:'no-store'});const t=await r.text();if(!r.ok)throw new Error(`Document metadata write returned ${r.status}: ${t.slice(0,400)}`);return t?JSON.parse(t):null;}

export async function POST(request:NextRequest){
 try{
  if(!KEY)throw new Error('Supabase server credentials are not configured.');
  const form=await request.formData(); const file=form.get('file');
  if(!(file instanceof File))throw new Error('A file is required.');
  const title=String(form.get('title')||file.name).trim(); const athleteId=String(form.get('athleteId')||''); let personId=String(form.get('personId')||'');
  if(!title)throw new Error('Document title is required.');
  if(!personId&&athleteId){const people=await rest(`athletes?id=eq.${encodeURIComponent(athleteId)}&select=person_id`,{method:'GET'});personId=people?.[0]?.person_id||'';}
  if(!personId)throw new Error('A document owner is required.');
  await ensureBucket();
  const path=`private/${safe(athleteId||personId)}/${crypto.randomUUID()}-${safe(file.name)}`;
  const bytes=await file.arrayBuffer();
  const upload=await fetch(`${URL}/storage/v1/object/ls1-documents/${path}`,{method:'POST',headers:{apikey:KEY,Authorization:`Bearer ${KEY}`,'Content-Type':file.type||'application/octet-stream','x-upsert':'false'},body:bytes});
  if(!upload.ok)throw new Error(`Document upload failed: ${(await upload.text()).slice(0,400)}`);
  const docs=await rest('documents',{method:'POST',body:JSON.stringify({owner_person_id:personId,title,storage_path:path,mime_type:file.type||null,classification:String(form.get('classification')||'restricted'),verification_status:'unverified',current_version:1})});
  const doc=docs?.[0]; if(!doc?.id)throw new Error('Document record was not created.');
  await rest('document_versions',{method:'POST',body:JSON.stringify({document_id:doc.id,version_no:1,storage_path:path})});
  return NextResponse.json({ok:true,document:doc});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Unable to upload document'},{status:400});}
}