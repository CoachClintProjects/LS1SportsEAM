'use client';

import { FormEvent, useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';

const SECURITY_VIEWS = new Set(['identity','roles','permissions','raci','delegation','sod','privileged-access']);

type Props = { view: string };

function Input({ name, label, required = false, placeholder = '' }: { name: string; label: string; required?: boolean; placeholder?: string }) {
  return <label className="block text-[10px] font-bold uppercase tracking-[.12em] text-neutral-500">{label}<input name={name} required={required} placeholder={placeholder} className="mt-2 w-full rounded-lg border border-neutral-700 bg-black px-3 py-2.5 text-xs normal-case tracking-normal text-white outline-none focus:border-emerald-500/60" /></label>;
}

export default function SuperUserSecurityActions({ view }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  if (!SECURITY_VIEWS.has(view)) return null;

  async function submit(event: FormEvent<HTMLFormElement>, action: string, transform?: (data: Record<string, FormDataEntryValue>) => Record<string, unknown>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const raw = Object.fromEntries(new FormData(event.currentTarget).entries());
      const payload = transform ? transform(raw) : raw;
      const response = await fetch('/api/superuser-security-action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...payload }) });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Security action failed.');
      setMessage(`${action.replaceAll('-', ' ')} completed and audited.`);
      event.currentTarget.reset();
      window.dispatchEvent(new CustomEvent('ls1sports:data-changed'));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Security action failed.'); }
    finally { setBusy(false); }
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-[#090b0b] p-5 lg:p-6">
      <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-400"/><div><div className="text-[9px] font-black uppercase tracking-[.2em] text-emerald-400">PRIVILEGED OPERATING CONTROLS</div><h2 className="mt-1 text-xl font-black text-white">Identity, authority & access</h2><p className="mt-2 text-xs leading-5 text-neutral-500">Every mutation requires an authorized Super User and writes both audit and security evidence.</p></div></div>
      {error && <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs text-red-200"><AlertTriangle className="h-4 w-4"/>{error}</div>}
      {message && <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-200"><CheckCircle2 className="h-4 w-4"/>{message}</div>}

      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        <form onSubmit={event => void submit(event,'create-role')} className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4"><div className="mb-4 text-sm font-black text-white">Create role</div><div className="space-y-3"><Input name="code" label="Role code" required/><Input name="name" label="Role name" required/><Input name="description" label="Description"/><Input name="privilege_level" label="Privilege level" placeholder="0"/></div><button disabled={busy} className="mt-4 w-full rounded-lg bg-emerald-400 px-3 py-2.5 text-xs font-black text-black disabled:opacity-50">Create role</button></form>

        <form onSubmit={event => void submit(event,'create-permission')} className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4"><div className="mb-4 text-sm font-black text-white">Create permission</div><div className="space-y-3"><Input name="code" label="Permission code" required/><Input name="name" label="Permission name" required/><Input name="resource" label="Resource"/><Input name="permission_action" label="Action"/><Input name="field_scope" label="Field scope"/></div><button disabled={busy} className="mt-4 w-full rounded-lg bg-emerald-400 px-3 py-2.5 text-xs font-black text-black disabled:opacity-50">Create permission</button></form>

        <form onSubmit={event => void submit(event,String(new FormData(event.currentTarget).get('mode')||'grant-role-permission'))} className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4"><div className="mb-4 text-sm font-black text-white">Role permission</div><div className="space-y-3"><Input name="role_id" label="Role ID" required/><Input name="permission_id" label="Permission ID" required/><label className="block text-[10px] font-bold uppercase tracking-[.12em] text-neutral-500">Operation<select name="mode" className="mt-2 w-full rounded-lg border border-neutral-700 bg-black px-3 py-2.5 text-xs normal-case tracking-normal text-white"><option value="grant-role-permission">Grant</option><option value="revoke-role-permission">Revoke</option></select></label></div><button disabled={busy} className="mt-4 w-full rounded-lg border border-neutral-700 px-3 py-2.5 text-xs font-black text-white disabled:opacity-50">Apply permission</button></form>

        <form onSubmit={event => void submit(event,'assign-person-role')} className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4 xl:col-span-2"><div className="mb-4 text-sm font-black text-white">Assign scoped role</div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Input name="person_id" label="Person ID" required/><Input name="role_id" label="Role ID" required/><Input name="organization_id" label="Organization ID"/><Input name="sport_id" label="Sport ID"/><Input name="site_id" label="Site ID"/><Input name="team_id" label="Team ID"/></div><button disabled={busy} className="mt-4 rounded-lg bg-emerald-400 px-4 py-2.5 text-xs font-black text-black disabled:opacity-50">Assign role</button></form>

        <form onSubmit={event => void submit(event,'end-person-role')} className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4"><div className="mb-4 text-sm font-black text-white">End role assignment</div><Input name="id" label="Assignment ID" required/><button disabled={busy} className="mt-4 w-full rounded-lg border border-red-900/60 px-3 py-2.5 text-xs font-black text-red-200 disabled:opacity-50">End assignment</button></form>

        <form onSubmit={event => void submit(event,'create-raci-assignment')} className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4 xl:col-span-2"><div className="mb-4 text-sm font-black text-white">Create RACI authority</div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Input name="task_id" label="Task ID"/><Input name="project_id" label="Project ID"/><Input name="person_id" label="Person ID"/><Input name="role_id" label="Role ID"/><Input name="responsibility" label="Responsibility R/A/C/I" required/><Input name="notes" label="Notes"/></div><button disabled={busy} className="mt-4 rounded-lg bg-emerald-400 px-4 py-2.5 text-xs font-black text-black disabled:opacity-50">Create RACI assignment</button></form>

        <form onSubmit={event => void submit(event,'end-raci-assignment')} className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4"><div className="mb-4 text-sm font-black text-white">End RACI authority</div><Input name="id" label="RACI assignment ID" required/><button disabled={busy} className="mt-4 w-full rounded-lg border border-neutral-700 px-3 py-2.5 text-xs font-black text-white disabled:opacity-50">End authority</button></form>

        <form onSubmit={event => void submit(event,'decide-approval')} className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4 xl:col-span-3"><div className="mb-4 text-sm font-black text-white">Privileged approval decision</div><div className="grid gap-3 sm:grid-cols-[1fr_180px_1.5fr]"><Input name="id" label="Approval ID" required/><label className="block text-[10px] font-bold uppercase tracking-[.12em] text-neutral-500">Decision<select name="decision" className="mt-2 w-full rounded-lg border border-neutral-700 bg-black px-3 py-2.5 text-xs normal-case tracking-normal text-white"><option value="approved">Approve</option><option value="rejected">Reject</option></select></label><Input name="decision_note" label="Decision note"/></div><button disabled={busy} className="mt-4 rounded-lg border border-neutral-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">Record decision</button></form>
      </div>
    </section>
  );
}
