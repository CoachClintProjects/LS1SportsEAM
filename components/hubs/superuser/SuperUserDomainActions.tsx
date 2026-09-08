'use client';

import { FormEvent, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Plus, Save, ShieldCheck } from 'lucide-react';

type Props = { view: string; onChanged?: () => void | Promise<void> };
type FormShape = Record<string, string | boolean>;

const RULE_VIEWS = new Set(['rules','business-rules','eligibility-rules','validation-rules','data-quality-rules']);
const INTEGRATION_VIEWS = new Set(['integrations','integration-connections','integration-mappings','integration-runs','integration-dead-letters']);

function Field({ label, name, value, onChange, required = false, type = 'text', placeholder = '' }: { label: string; name: string; value: string; onChange: (name: string, value: string) => void; required?: boolean; type?: string; placeholder?: string }) {
  return <label className="block text-[10px] font-bold uppercase tracking-[.12em] text-neutral-500">{label}<input name={name} value={value} required={required} type={type} placeholder={placeholder} onChange={event => onChange(name, event.target.value)} className="mt-2 w-full rounded-lg border border-neutral-700 bg-black px-3 py-2.5 text-xs normal-case tracking-normal text-white outline-none focus:border-emerald-500/60" /></label>;
}

function JsonField({ label, name, value, onChange }: { label: string; name: string; value: string; onChange: (name: string, value: string) => void }) {
  return <label className="block text-[10px] font-bold uppercase tracking-[.12em] text-neutral-500">{label}<textarea name={name} value={value} rows={5} onChange={event => onChange(name, event.target.value)} className="mt-2 w-full rounded-lg border border-neutral-700 bg-black px-3 py-2.5 font-mono text-[11px] normal-case tracking-normal text-white outline-none focus:border-emerald-500/60" /></label>;
}

export default function SuperUserDomainActions({ view, onChanged }: Props) {
  const kind = useMemo(() => RULE_VIEWS.has(view) ? 'rules' : INTEGRATION_VIEWS.has(view) ? 'integrations' : null, [view]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState<FormShape>({
    code: '', name: '', domain: '', trigger_event: '', priority: '100', rule_definition: '{}',
    entity_type: '', field_name: '', severity: 'error', rule_type: 'expression', message_template: '', expression: '{}',
    integration_type: 'api', direction: 'inbound', transport: 'https', source_system: '', contract_definition: '{}',
    system_code: '', provider: '', auth_method: 'managed_secret', configuration: '{}', status: 'configured',
    connection_id: '', source_field: '', target_field: '', transform_definition: '{}', record_id: '', lifecycle_status: 'disabled',
  });

  if (!kind) return null;

  function change(name: string, value: string) { setForm(current => ({ ...current, [name]: value })); }

  async function run(action: string, payload: Record<string, unknown>) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/superuser-domain-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Action failed.');
      setMessage(`${action.replaceAll('-', ' ')} completed.`);
      await onChanged?.();
      return json;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Action failed.');
      return null;
    } finally { setBusy(false); }
  }

  function payloadFrom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    return Object.fromEntries(new FormData(event.currentTarget).entries());
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-5 lg:p-6">
      <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-400" /><div><div className="text-[9px] font-black uppercase tracking-[.2em] text-emerald-400">OPERATING CONTROLS</div><h2 className="mt-1 text-xl font-black text-white">{kind === 'rules' ? 'Rules lifecycle' : 'Integration lifecycle'}</h2><p className="mt-2 text-xs leading-5 text-neutral-500">These controls write canonical records through the authorized Super User server API and create privileged audit evidence for every mutation.</p></div></div>

      {error && <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs text-red-200"><AlertTriangle className="h-4 w-4" />{error}</div>}
      {message && <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-200"><CheckCircle2 className="h-4 w-4" />{message}</div>}

      {kind === 'rules' ? (
        <div className="mt-6 grid gap-5 xl:grid-cols-3">
          <form onSubmit={event => { const p = payloadFrom(event); void run('create-business-rule', p); }} className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4">
            <div className="mb-4 flex items-center gap-2 text-sm font-black text-white"><Plus className="h-4 w-4 text-emerald-400" />Business rule</div>
            <div className="space-y-3"><Field label="Code" name="code" value={String(form.code)} onChange={change} required /><Field label="Name" name="name" value={String(form.name)} onChange={change} required /><Field label="Domain" name="domain" value={String(form.domain)} onChange={change} required placeholder="membership, finance, competition…" /><Field label="Trigger event" name="trigger_event" value={String(form.trigger_event)} onChange={change} /><Field label="Priority" name="priority" type="number" value={String(form.priority)} onChange={change} /><JsonField label="Rule definition JSON" name="rule_definition" value={String(form.rule_definition)} onChange={change} /></div>
            <button disabled={busy} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-3 py-2.5 text-xs font-black text-black disabled:opacity-50"><Save className="h-4 w-4" />Create business rule</button>
          </form>

          <form onSubmit={event => { const p = payloadFrom(event); void run('create-validation-rule', p); }} className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4">
            <div className="mb-4 flex items-center gap-2 text-sm font-black text-white"><Plus className="h-4 w-4 text-emerald-400" />Validation rule</div>
            <div className="space-y-3"><Field label="Code" name="code" value={String(form.code)} onChange={change} required /><Field label="Name" name="name" value={String(form.name)} onChange={change} required /><Field label="Entity type" name="entity_type" value={String(form.entity_type)} onChange={change} /><Field label="Field name" name="field_name" value={String(form.field_name)} onChange={change} /><Field label="Severity" name="severity" value={String(form.severity)} onChange={change} /><Field label="Rule type" name="rule_type" value={String(form.rule_type)} onChange={change} required /><Field label="Message template" name="message_template" value={String(form.message_template)} onChange={change} /><JsonField label="Rule definition JSON" name="rule_definition" value={String(form.rule_definition)} onChange={change} /></div>
            <button disabled={busy} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-3 py-2.5 text-xs font-black text-black disabled:opacity-50"><Save className="h-4 w-4" />Create validation rule</button>
          </form>

          <form onSubmit={event => { const p = payloadFrom(event); void run('create-data-quality-rule', p); }} className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4">
            <div className="mb-4 flex items-center gap-2 text-sm font-black text-white"><Plus className="h-4 w-4 text-emerald-400" />Data-quality rule</div>
            <div className="space-y-3"><Field label="Rule code" name="rule_code" value={String(form.code)} onChange={(_n,v)=>change('code',v)} required /><Field label="Entity type" name="entity_type" value={String(form.entity_type)} onChange={change} required /><Field label="Description" name="description" value={String(form.message_template)} onChange={(_n,v)=>change('message_template',v)} required /><Field label="Severity" name="severity" value={String(form.severity)} onChange={change} /><JsonField label="Expression JSON" name="expression" value={String(form.expression)} onChange={change} /></div>
            <button disabled={busy} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-3 py-2.5 text-xs font-black text-black disabled:opacity-50"><Save className="h-4 w-4" />Create data-quality rule</button>
          </form>

          <form onSubmit={event => { const p = payloadFrom(event); void run('set-business-rule-active', { id: p.record_id, active: p.lifecycle_status === 'active' }); }} className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4 xl:col-span-3">
            <div className="text-sm font-black text-white">Rule lifecycle by record ID</div><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_180px_auto]"><Field label="Business rule ID" name="record_id" value={String(form.record_id)} onChange={change} required /><label className="block text-[10px] font-bold uppercase tracking-[.12em] text-neutral-500">State<select name="lifecycle_status" value={String(form.lifecycle_status)} onChange={event=>change('lifecycle_status',event.target.value)} className="mt-2 w-full rounded-lg border border-neutral-700 bg-black px-3 py-2.5 text-xs text-white"><option value="active">Active</option><option value="disabled">Disabled</option></select></label><button disabled={busy} className="self-end rounded-lg border border-neutral-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">Apply state</button></div>
          </form>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 xl:grid-cols-3">
          <form onSubmit={event => { const p = payloadFrom(event); void run('create-integration-definition', p); }} className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4">
            <div className="mb-4 text-sm font-black text-white">Integration definition</div><div className="space-y-3"><Field label="Code" name="code" value={String(form.code)} onChange={change} required /><Field label="Name" name="name" value={String(form.name)} onChange={change} required /><Field label="Type" name="integration_type" value={String(form.integration_type)} onChange={change} /><Field label="Direction" name="direction" value={String(form.direction)} onChange={change} /><Field label="Transport" name="transport" value={String(form.transport)} onChange={change} /><Field label="Source system" name="source_system" value={String(form.source_system)} onChange={change} /><JsonField label="Contract JSON (no secrets)" name="contract_definition" value={String(form.contract_definition)} onChange={change} /></div><button disabled={busy} className="mt-4 w-full rounded-lg bg-emerald-400 px-3 py-2.5 text-xs font-black text-black disabled:opacity-50">Create definition</button>
          </form>

          <form onSubmit={event => { const p = payloadFrom(event); void run('create-integration-connection', p); }} className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4">
            <div className="mb-4 text-sm font-black text-white">Connection</div><div className="space-y-3"><Field label="System code" name="system_code" value={String(form.system_code)} onChange={change} required /><Field label="Name" name="name" value={String(form.name)} onChange={change} required /><Field label="Provider" name="provider" value={String(form.provider)} onChange={change} /><Field label="Auth method" name="auth_method" value={String(form.auth_method)} onChange={change} /><Field label="Status" name="status" value={String(form.status)} onChange={change} /><JsonField label="Configuration JSON (no secrets)" name="configuration" value={String(form.configuration)} onChange={change} /></div><button disabled={busy} className="mt-4 w-full rounded-lg bg-emerald-400 px-3 py-2.5 text-xs font-black text-black disabled:opacity-50">Create connection</button>
          </form>

          <form onSubmit={event => { const p = payloadFrom(event); void run('create-integration-mapping', p); }} className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4">
            <div className="mb-4 text-sm font-black text-white">Mapping</div><div className="space-y-3"><Field label="Connection ID" name="connection_id" value={String(form.connection_id)} onChange={change} /><Field label="Entity type" name="entity_type" value={String(form.entity_type)} onChange={change} required /><Field label="Source field" name="source_field" value={String(form.source_field)} onChange={change} required /><Field label="Target field" name="target_field" value={String(form.target_field)} onChange={change} required /><JsonField label="Transform JSON" name="transform_definition" value={String(form.transform_definition)} onChange={change} /></div><button disabled={busy} className="mt-4 w-full rounded-lg bg-emerald-400 px-3 py-2.5 text-xs font-black text-black disabled:opacity-50">Create mapping</button>
          </form>

          <form onSubmit={event => { const p = payloadFrom(event); void run('set-integration-connection-status', { id: p.record_id, status: p.lifecycle_status }); }} className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4 xl:col-span-2">
            <div className="text-sm font-black text-white">Connection lifecycle</div><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_220px_auto]"><Field label="Connection ID" name="record_id" value={String(form.record_id)} onChange={change} required /><Field label="Status" name="lifecycle_status" value={String(form.lifecycle_status)} onChange={change} required placeholder="configured, active, disabled…" /><button disabled={busy} className="self-end rounded-lg border border-neutral-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">Apply status</button></div>
          </form>

          <form onSubmit={event => { const p = payloadFrom(event); void run('set-dead-letter-status', { id: p.record_id, status: p.lifecycle_status }); }} className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4">
            <div className="text-sm font-black text-white">Dead-letter remediation</div><div className="mt-3 space-y-3"><Field label="Dead-letter ID" name="record_id" value={String(form.record_id)} onChange={change} required /><Field label="Status" name="lifecycle_status" value={String(form.lifecycle_status)} onChange={change} required placeholder="open, resolved…" /></div><button disabled={busy} className="mt-4 w-full rounded-lg border border-neutral-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">Apply status</button>
          </form>
        </div>
      )}
    </section>
  );
}
