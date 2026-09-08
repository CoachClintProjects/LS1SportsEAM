import { NextRequest, NextResponse } from 'next/server';
import { requireSuperUser, SuperUserAuthError } from '@/lib/server/requireSuperUser';
import { writeAuditEvent } from '@/lib/server/writeAuditEvent';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Row = Record<string, unknown>;

function headers() {
  if (!KEY) throw new Error('Supabase service credentials are not configured.');
  return { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
}
async function rest(path: string, init: RequestInit = {}) {
  if (!URL || !KEY) throw new Error('Supabase service credentials are not configured.');
  const response = await fetch(`${URL}/rest/v1/${path}`, { ...init, headers: { ...headers(), ...(init.headers || {}) }, cache: 'no-store' });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${path} returned ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}
function req(value: unknown, label: string, max = 200) { const s = String(value || '').trim(); if (!s) throw new Error(`${label} is required.`); if (s.length > max) throw new Error(`${label} is too long.`); return s; }
function opt(value: unknown, max = 1000) { const s = String(value || '').trim(); if (!s) return null; if (s.length > max) throw new Error('Value is too long.'); return s; }
function num(value: unknown, label: string, allowZero = true) { const n = Number(value); if (!Number.isFinite(n) || (!allowZero && n <= 0)) throw new Error(`${label} must be numeric${allowZero ? '' : ' and greater than zero'}.`); return Math.round(n * 100) / 100; }
function bool(value: unknown, fallback = false) { if (value === undefined || value === null || value === '') return fallback; return value === true || String(value).toLowerCase() === 'true' || String(value) === '1'; }
function json(value: unknown, label: string, fallback: unknown = {}) { if (value === undefined || value === null || value === '') return fallback; if (typeof value === 'object') return value; try { return JSON.parse(String(value)); } catch { throw new Error(`${label} must be valid JSON.`); } }
function jsonArray(value: unknown, label: string): Row[] { const parsed = json(value, label, []); if (!Array.isArray(parsed)) throw new Error(`${label} must be a JSON array.`); return parsed as Row[]; }
async function one(table: string, id: string) { return (await rest(`${table}?id=eq.${encodeURIComponent(id)}&select=*&limit=1`))?.[0] || null; }
async function tenantId() { return (await rest('tenants?select=id&limit=1'))?.[0]?.id || null; }
async function audited(actor: Awaited<ReturnType<typeof requireSuperUser>>, tenant: string | null, action: string, table: string, id: string | null, before: unknown, after: unknown, reason: string) {
  await writeAuditEvent(actor, { action, entityType: table, entityId: id, tenantId: tenant, beforeData: before ?? null, afterData: after ?? null, reason });
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperUser(request);
    if (!actor.canManagePlatformSettings) throw new SuperUserAuthError('Platform-management permission required.', 403);
    const body = await request.json() as Row;
    const action = String(body.action || '');
    const tenant = await tenantId();

    if (action === 'create-facility') {
      const item = (await rest('facilities', { method: 'POST', body: JSON.stringify({ site_id: req(body.site_id,'Site ID',80), code:req(body.code,'Facility code',80), name:req(body.name,'Facility name'), facility_type:opt(body.facility_type,100), capacity:body.capacity?Number(body.capacity):null, timezone:opt(body.timezone,100), status:'active' }) }))?.[0];
      await audited(actor,tenant,'FACILITY_CREATED','facilities',item?.id||null,null,item||body,'Super User created facility'); return NextResponse.json(item);
    }
    if (action === 'create-asset') {
      const item=(await rest('assets',{method:'POST',body:JSON.stringify({organization_id:body.organization_id||null,facility_id:body.facility_id||null,asset_number:req(body.asset_number,'Asset number',100),name:req(body.name,'Asset name'),asset_type:opt(body.asset_type,100),manufacturer:opt(body.manufacturer,160),model:opt(body.model,160),serial_number:opt(body.serial_number,160),acquisition_date:body.acquisition_date||null,status:'active',parent_asset_id:body.parent_asset_id||null})}))?.[0];
      await audited(actor,tenant,'ASSET_CREATED','assets',item?.id||null,null,item||body,'Super User created managed asset'); return NextResponse.json(item);
    }
    if (action === 'set-asset-status') {
      const id=req(body.id,'Asset ID',80),before=await one('assets',id); if(!before)return NextResponse.json({error:'Asset not found.'},{status:404}); const after=(await rest(`assets?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status:req(body.status,'Asset status',60)})}))?.[0]; await audited(actor,tenant,'ASSET_STATUS_CHANGED','assets',id,before,after,'Super User changed asset lifecycle state'); return NextResponse.json(after);
    }
    if (action === 'create-work-order') {
      const item=(await rest('maintenance_work_orders',{method:'POST',body:JSON.stringify({asset_id:body.asset_id||null,facility_id:body.facility_id||null,work_order_number:req(body.work_order_number,'Work order number',100),description:opt(body.description),priority:req(body.priority||'normal','Priority',40),status:'open',scheduled_start:body.scheduled_start||null,scheduled_end:body.scheduled_end||null})}))?.[0]; await audited(actor,tenant,'WORK_ORDER_CREATED','maintenance_work_orders',item?.id||null,null,item||body,'Super User created maintenance work order'); return NextResponse.json(item);
    }
    if (action === 'set-work-order-status') {
      const id=req(body.id,'Work order ID',80),before=await one('maintenance_work_orders',id); if(!before)return NextResponse.json({error:'Work order not found.'},{status:404}); const status=req(body.status,'Work order status',50).toLowerCase(); const after=(await rest(`maintenance_work_orders?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status,completed_at:status==='completed'?new Date().toISOString():null})}))?.[0]; await audited(actor,tenant,'WORK_ORDER_STATUS_CHANGED','maintenance_work_orders',id,before,after,'Super User changed work-order lifecycle'); return NextResponse.json(after);
    }

    if (action === 'create-purchase-request') {
      const lines=jsonArray(body.lines,'Purchase request lines').map((line,index)=>({line_no:index+1,item_id:line.item_id||null,description:req(line.description,`Line ${index+1} description`,300),quantity:num(line.quantity??1,`Line ${index+1} quantity`,false),unit_price:line.unit_price===undefined?null:num(line.unit_price,`Line ${index+1} unit price`),tax_code_id:line.tax_code_id||null,account_id:line.account_id||null,cost_center_id:line.cost_center_id||null,status:'requested',metadata:{}}));
      if(!lines.length)throw new Error('At least one purchase request line is required.'); const amount=Math.round(lines.reduce((s,l)=>s+(l.unit_price===null?0:l.quantity*l.unit_price),0)*100)/100;
      const requestRow=(await rest('purchase_requests',{method:'POST',body:JSON.stringify({organization_id:body.organization_id||null,requested_by:body.requested_by||null,vendor_id:body.vendor_id||null,request_date:body.request_date||new Date().toISOString().slice(0,10),amount,currency:req(body.currency||'CAD','Currency',3).toUpperCase(),purpose:opt(body.purpose),status:'draft'})}))?.[0]; if(!requestRow?.id)throw new Error('Purchase request creation failed.');
      const inserted=await rest('purchase_request_lines',{method:'POST',body:JSON.stringify(lines.map(line=>({...line,purchase_request_id:requestRow.id})))}); await audited(actor,tenant,'PURCHASE_REQUEST_CREATED','purchase_requests',requestRow.id,null,{request:requestRow,lines:inserted},'Super User created procurement requisition'); return NextResponse.json({request:requestRow,lines:inserted});
    }
    if (action === 'set-purchase-request-status') {
      const id=req(body.id,'Purchase request ID',80),before=await one('purchase_requests',id); if(!before)return NextResponse.json({error:'Purchase request not found.'},{status:404}); const after=(await rest(`purchase_requests?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status:req(body.status,'Status',50).toLowerCase()})}))?.[0]; await audited(actor,tenant,'PURCHASE_REQUEST_STATUS_CHANGED','purchase_requests',id,before,after,'Super User changed procurement request lifecycle'); return NextResponse.json(after);
    }
    if (action === 'convert-purchase-order') {
      const requestId=req(body.purchase_request_id,'Purchase request ID',80),requestRow=await one('purchase_requests',requestId); if(!requestRow)return NextResponse.json({error:'Purchase request not found.'},{status:404}); if(!['approved','authorized'].includes(String(requestRow.status).toLowerCase()))throw new Error('Purchase request must be approved before conversion to PO.');
      const requestLines=await rest(`purchase_request_lines?purchase_request_id=eq.${encodeURIComponent(requestId)}&select=*&order=line_no.asc`); if(!requestLines?.length)throw new Error('Purchase request has no lines.'); const total=Math.round(requestLines.reduce((s:number,l:Row)=>s+Number(l.quantity||0)*Number(l.unit_price||0),0)*100)/100;
      const po=(await rest('purchase_orders',{method:'POST',body:JSON.stringify({purchase_request_id:requestId,vendor_id:body.vendor_id||requestRow.vendor_id||null,po_number:req(body.po_number,'PO number',100),ordered_at:body.ordered_at||new Date().toISOString().slice(0,10),total,currency:req(body.currency||requestRow.currency||'CAD','Currency',3).toUpperCase(),status:'issued'})}))?.[0]; if(!po?.id)throw new Error('Purchase order creation failed.'); const poLines=await rest('purchase_order_lines',{method:'POST',body:JSON.stringify(requestLines.map((line:Row)=>({purchase_order_id:po.id,line_no:line.line_no,item_id:line.item_id||null,description:line.description,quantity:line.quantity,unit_price:line.unit_price,tax_code_id:line.tax_code_id||null,account_id:line.account_id||null,cost_center_id:line.cost_center_id||null,received_quantity:0,status:'open',metadata:line.metadata||{}})))}); await rest(`purchase_requests?id=eq.${encodeURIComponent(requestId)}`,{method:'PATCH',body:JSON.stringify({status:'ordered'})}); await audited(actor,tenant,'PURCHASE_ORDER_CREATED','purchase_orders',po.id,null,{po,lines:poLines},'Approved requisition converted to purchase order'); return NextResponse.json({po,lines:poLines});
    }
    if (action === 'receive-purchase-order-line') {
      const id=req(body.id,'PO line ID',80),before=await one('purchase_order_lines',id); if(!before)return NextResponse.json({error:'PO line not found.'},{status:404}); const received=num(body.received_quantity,'Received quantity'); if(received<0||received>Number(before.quantity||0))throw new Error('Received quantity must be between 0 and ordered quantity.'); const after=(await rest(`purchase_order_lines?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({received_quantity:received,status:received>=Number(before.quantity||0)?'received':'partial'})}))?.[0]; await audited(actor,tenant,'PURCHASE_ORDER_RECEIPT_UPDATED','purchase_order_lines',id,before,after,'Super User recorded receiving against PO line'); return NextResponse.json(after);
    }

    if (action === 'create-payroll-run') {
      const lines=jsonArray(body.lines,'Payroll lines').map((line,index)=>{const earnings=num(line.earnings??0,`Line ${index+1} earnings`),deductions=num(line.deductions??0,`Line ${index+1} deductions`); if(deductions>earnings)throw new Error(`Line ${index+1} deductions cannot exceed earnings.`); return {person_id:line.person_id||null,earnings,deductions,net_pay:Math.round((earnings-deductions)*100)/100};}); if(!lines.length)throw new Error('At least one payroll line is required.'); const gross=Math.round(lines.reduce((s,l)=>s+l.earnings,0)*100)/100,net=Math.round(lines.reduce((s,l)=>s+l.net_pay,0)*100)/100;
      const run=(await rest('payroll_runs',{method:'POST',body:JSON.stringify({legal_entity_id:body.legal_entity_id||null,period_start:req(body.period_start,'Period start',20),period_end:req(body.period_end,'Period end',20),pay_date:body.pay_date||null,status:'draft',gross_total:gross,net_total:net})}))?.[0]; if(!run?.id)throw new Error('Payroll run creation failed.'); const inserted=await rest('payroll_lines',{method:'POST',body:JSON.stringify(lines.map(line=>({...line,payroll_run_id:run.id})))}); await audited(actor,tenant,'PAYROLL_RUN_CREATED','payroll_runs',run.id,null,{run,lines:inserted},'Super User created payroll run'); return NextResponse.json({run,lines:inserted});
    }
    if (action === 'set-payroll-status') {
      const id=req(body.id,'Payroll run ID',80),before=await one('payroll_runs',id); if(!before)return NextResponse.json({error:'Payroll run not found.'},{status:404}); const status=req(body.status,'Payroll status',40).toLowerCase(); const allowed=['draft','review','approved','posted','paid','void']; if(!allowed.includes(status))throw new Error(`Payroll status must be one of ${allowed.join(', ')}.`); const after=(await rest(`payroll_runs?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status})}))?.[0]; await audited(actor,tenant,'PAYROLL_RUN_STATUS_CHANGED','payroll_runs',id,before,after,'Super User changed payroll lifecycle'); return NextResponse.json(after);
    }

    if (action === 'create-workflow-definition') {
      const item=(await rest('workflow_definitions',{method:'POST',body:JSON.stringify({tenant_id:tenant,code:req(body.code,'Workflow code',80),name:req(body.name,'Workflow name'),version:Number(body.version||1),definition:json(body.definition,'Workflow definition',{}),status:'draft'})}))?.[0]; await audited(actor,tenant,'WORKFLOW_DEFINITION_CREATED','workflow_definitions',item?.id||null,null,item||body,'Super User created workflow definition'); return NextResponse.json(item);
    }
    if (action === 'set-workflow-definition-status') {
      const id=req(body.id,'Workflow definition ID',80),before=await one('workflow_definitions',id); if(!before)return NextResponse.json({error:'Workflow definition not found.'},{status:404}); const after=(await rest(`workflow_definitions?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status:req(body.status,'Workflow status',40).toLowerCase()})}))?.[0]; await audited(actor,tenant,'WORKFLOW_DEFINITION_STATUS_CHANGED','workflow_definitions',id,before,after,'Super User changed workflow-definition lifecycle'); return NextResponse.json(after);
    }
    if (action === 'start-workflow') {
      const item=(await rest('workflow_instances',{method:'POST',body:JSON.stringify({workflow_definition_id:body.workflow_definition_id||null,entity_type:opt(body.entity_type,100),entity_id:body.entity_id||null,status:'running',started_at:new Date().toISOString(),context:json(body.context,'Workflow context',{})})}))?.[0]; await audited(actor,tenant,'WORKFLOW_STARTED','workflow_instances',item?.id||null,null,item||body,'Super User started workflow instance'); return NextResponse.json(item);
    }
    if (action === 'complete-workflow-task') {
      const id=req(body.id,'Workflow task ID',80),before=await one('workflow_tasks',id); if(!before)return NextResponse.json({error:'Workflow task not found.'},{status:404}); const decision=opt(body.decision,100); const after=(await rest(`workflow_tasks?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status:'completed',completed_at:new Date().toISOString(),decision,metadata:json(body.metadata,'Task metadata',before.metadata||{})})}))?.[0]; await audited(actor,tenant,'WORKFLOW_TASK_COMPLETED','workflow_tasks',id,before,after,'Super User completed workflow task'); return NextResponse.json(after);
    }

    if (action === 'create-compliance-requirement') {
      const item=(await rest('compliance_requirements',{method:'POST',body:JSON.stringify({code:req(body.code,'Requirement code',80),name:req(body.name,'Requirement name'),applies_to_role:opt(body.applies_to_role,100),applies_to_minor:bool(body.applies_to_minor),severity:req(body.severity||'required','Severity',40),validity_days:body.validity_days?Number(body.validity_days):null,rule_definition:json(body.rule_definition,'Rule definition',{})})}))?.[0]; await audited(actor,tenant,'COMPLIANCE_REQUIREMENT_CREATED','compliance_requirements',item?.id||null,null,item||body,'Super User created compliance requirement'); return NextResponse.json(item);
    }
    if (action === 'create-retention-policy') {
      const item=(await rest('data_retention_policies',{method:'POST',body:JSON.stringify({tenant_id:tenant,data_classification:req(body.data_classification,'Data classification',100),jurisdiction:req(body.jurisdiction||'CA','Jurisdiction',3).toUpperCase(),retention_days:Number(body.retention_days),legal_hold_allowed:bool(body.legal_hold_allowed,true),active:true})}))?.[0]; await audited(actor,tenant,'RETENTION_POLICY_CREATED','data_retention_policies',item?.id||null,null,item||body,'Super User created retention policy'); return NextResponse.json(item);
    }
    if (action === 'resolve-privacy-request') {
      const id=req(body.id,'Privacy request ID',80),before=await one('privacy_requests',id); if(!before)return NextResponse.json({error:'Privacy request not found.'},{status:404}); const status=req(body.status||'completed','Privacy request status',40).toLowerCase(); const after=(await rest(`privacy_requests?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status,completed_at:status==='completed'?new Date().toISOString():null,resolution:json(body.resolution,'Resolution',{})})}))?.[0]; await audited(actor,tenant,'PRIVACY_REQUEST_RESOLVED','privacy_requests',id,before,after,'Super User resolved privacy request'); return NextResponse.json(after);
    }

    if (action === 'create-ai-agent') {
      const config=json(body.configuration,'Agent configuration',{}); const item=(await rest('ai_agents',{method:'POST',body:JSON.stringify({code:req(body.code,'Agent code',80),name:req(body.name,'Agent name'),purpose:opt(body.purpose),risk_level:req(body.risk_level||'low','Risk level',40),requires_human_approval:bool(body.requires_human_approval,true),status:'active',configuration:config})}))?.[0]; await audited(actor,tenant,'AI_AGENT_CREATED','ai_agents',item?.id||null,null,item||body,'Super User registered governed AI agent'); return NextResponse.json(item);
    }
    if (action === 'set-ai-agent-status') {
      const id=req(body.id,'Agent ID',80),before=await one('ai_agents',id); if(!before)return NextResponse.json({error:'AI agent not found.'},{status:404}); const after=(await rest(`ai_agents?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status:req(body.status,'Agent status',40).toLowerCase()})}))?.[0]; await audited(actor,tenant,'AI_AGENT_STATUS_CHANGED','ai_agents',id,before,after,'Super User changed governed AI agent lifecycle'); return NextResponse.json(after);
    }
    if (action === 'queue-ai-agent-run') {
      const agent=await one('ai_agents',req(body.agent_id,'Agent ID',80)); if(!agent)return NextResponse.json({error:'AI agent not found.'},{status:404}); if(String(agent.status).toLowerCase()!=='active')throw new Error('AI agent must be active before a run can be queued.'); const item=(await rest('ai_agent_runs',{method:'POST',body:JSON.stringify({agent_id:agent.id,tenant_id:tenant,trigger_type:req(body.trigger_type||'manual','Trigger type',80),trigger_ref:json(body.trigger_ref,'Trigger reference',{}),status:'queued',input:json(body.input,'Agent input',{}),approval_required:Boolean(agent.requires_human_approval)})}))?.[0]; await audited(actor,tenant,'AI_AGENT_RUN_QUEUED','ai_agent_runs',item?.id||null,null,item||body,'Super User queued governed AI run'); return NextResponse.json(item);
    }
    if (action === 'create-automation') {
      const item=(await rest('automation_definitions',{method:'POST',body:JSON.stringify({tenant_id:tenant,code:req(body.code,'Automation code',80),name:req(body.name,'Automation name'),description:opt(body.description),trigger_definition:json(body.trigger_definition,'Trigger definition',{}),condition_definition:json(body.condition_definition,'Condition definition',{}),action_definition:json(body.action_definition,'Action definition',{}),retry_policy:json(body.retry_policy,'Retry policy',{}),concurrency_policy:json(body.concurrency_policy,'Concurrency policy',{}),enabled:bool(body.enabled,true),version:Number(body.version||1)})}))?.[0]; await audited(actor,tenant,'AUTOMATION_CREATED','automation_definitions',item?.id||null,null,item||body,'Super User created automation definition'); return NextResponse.json(item);
    }
    if (action === 'set-automation-enabled') {
      const id=req(body.id,'Automation ID',80),before=await one('automation_definitions',id); if(!before)return NextResponse.json({error:'Automation not found.'},{status:404}); const after=(await rest(`automation_definitions?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({enabled:bool(body.enabled)})}))?.[0]; await audited(actor,tenant,'AUTOMATION_STATE_CHANGED','automation_definitions',id,before,after,'Super User changed automation state'); return NextResponse.json(after);
    }

    if (action === 'set-system-configuration') {
      const namespace=req(body.config_namespace,'Configuration namespace',100),key=req(body.config_key,'Configuration key',100),value=json(body.config_value,'Configuration value',null); const existing=(await rest(`system_configurations?config_namespace=eq.${encodeURIComponent(namespace)}&config_key=eq.${encodeURIComponent(key)}&active=eq.true&select=*&limit=1`))?.[0]||null; let item;
      if(existing?.id){item=(await rest(`system_configurations?id=eq.${encodeURIComponent(existing.id)}`,{method:'PATCH',body:JSON.stringify({config_value:value,version:Number(existing.version||1)+1,updated_at:new Date().toISOString()})}))?.[0];} else {item=(await rest('system_configurations',{method:'POST',body:JSON.stringify({tenant_id:tenant,config_namespace:namespace,config_key:key,config_value:value,version:1,active:true,effective_from:new Date().toISOString()})}))?.[0];}
      await audited(actor,tenant,'SYSTEM_CONFIGURATION_SET','system_configurations',item?.id||existing?.id||null,existing,item||body,'Super User changed versioned system configuration'); return NextResponse.json(item);
    }
    if (action === 'set-platform-preference') {
      const item=(await rest('platform_preferences',{method:'POST',body:JSON.stringify({scope_type:req(body.scope_type,'Scope type',80),scope_id:body.scope_id||null,preference_namespace:req(body.preference_namespace,'Preference namespace',100),preference_key:req(body.preference_key,'Preference key',100),preference_value:json(body.preference_value,'Preference value',null),active:true})}))?.[0]; await audited(actor,tenant,'PLATFORM_PREFERENCE_SET','platform_preferences',item?.id||null,null,item||body,'Super User created platform preference'); return NextResponse.json(item);
    }

    return NextResponse.json({ error: 'Unsupported enterprise action.' }, { status: 400 });
  } catch (error) {
    if (error instanceof SuperUserAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Enterprise action failed.' }, { status: 400 });
  }
}
