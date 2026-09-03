import { NextRequest, NextResponse } from 'next/server';
const URL=process.env.NEXT_PUBLIC_SUPABASE_URL; const KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
export const dynamic='force-dynamic'; export const revalidate=0;
const h={get apikey(){return KEY||''},get Authorization(){return `Bearer ${KEY||''}`},'Content-Type':'application/json',Prefer:'return=representation'};
async function rest(path:string,init:RequestInit={}){if(!URL||!KEY)throw new Error('Supabase server credentials are not configured.');const r=await fetch(`${URL}/rest/v1/${path}`,{...init,headers:{...h,...(init.headers||{})},cache:'no-store'});const t=await r.text();if(!r.ok)throw new Error(`${r.status}: ${t.slice(0,500)}`);return t?JSON.parse(t):null;}
export async function POST(req:NextRequest){
 try{
  const fd=await req.formData(); const file=fd.get('file'); if(!(file instanceof File))throw new Error('A result export file is required.');
  const tenant=(await rest('tenants?select=id&limit=1'))?.[0]?.id||null;
  const sourceSystem=String(fd.get('source_system')||'UNKNOWN'); const format=String(fd.get('format')||file.name.split('.').pop()||'UNKNOWN').toUpperCase();
  const systems=await rest('competition_source_systems?select=id,name&limit=100'); const sourceId=systems?.find((x:any)=>String(x.name).toLowerCase()===sourceSystem.toLowerCase())?.id||null;
  const row=(await rest('competition_import_files',{method:'POST',body:JSON.stringify({tenant_id:tenant,source_system_id:sourceId,original_filename:file.name,detected_format:format,file_size_bytes:file.size,parse_status:'RECEIVED',parse_summary:{mime:file.type,received_via:'SuperUser live upload'}})}))?.[0];
  const textTypes=['text/plain','text/csv','application/json','application/xml','text/xml',''];
  let staged=0;
  if(textTypes.includes(file.type)||['CSV','JSON','TXT','XML'].includes(format)){
   const text=await file.text(); const lines=format==='JSON'?[text]:text.split(/\r?
/).filter(Boolean);
   const batch=lines.slice(0,20000).map((line,i)=>({import_file_id:row.id,record_type:'RAW',line_number:i+1,raw_record:{raw:line},validation_status:'PENDING',validation_errors:[]}));
   if(batch.length){await rest('competition_import_records',{method:'POST',body:JSON.stringify(batch)});staged=batch.length;}
   await rest(`competition_import_files?id=eq.${row.id}`,{method:'PATCH',body:JSON.stringify({parse_status:'STAGED',parse_summary:{mime:file.type,received_via:'SuperUser live upload',staged_records:staged}})});
  }else await rest(`competition_import_files?id=eq.${row.id}`,{method:'PATCH',body:JSON.stringify({parse_status:'QUEUED',parse_summary:{mime:file.type,received_via:'SuperUser live upload',message:'Binary format registered; parser adapter required'}})});
  return NextResponse.json({ok:true,import_file_id:row.id,filename:file.name,format,staged_records:staged});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Upload failed'},{status:400});}
}