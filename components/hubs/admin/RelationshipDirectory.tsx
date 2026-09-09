'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  FileText,
  Landmark,
  ListTodo,
  Mail,
  Pencil,
  Phone,
  Plus,
  Receipt,
  RefreshCw,
  Save,
  Search,
  UserPlus,
  X,
} from 'lucide-react';
import { authenticatedFetch } from '@/lib/client/authenticatedFetch';
import { RecordPanel, RecordSectionHeader, ThreeColumnRecordWorkspace } from '@/components/records/ThreeColumnRecordWorkspace';

type Row = Record<string, any>;
type RecordType = 'vendor' | 'external-organization';

const typeConfig = {
  vendor: {
    singular: 'Vendor',
    plural: 'Vendors',
    apiType: 'vendor',
    createAction: 'create-vendor',
    updateAction: 'update-vendor',
    icon: Building2,
    subtitle: 'Suppliers, safety providers, service partners and operational vendors',
  },
  'external-organization': {
    singular: 'External Organization',
    plural: 'External Organizations',
    apiType: 'external-organization',
    createAction: 'create-external-organization',
    updateAction: 'update-external-organization',
    icon: Landmark,
    subtitle: 'Municipalities, recreation departments, councils, facilities and community partners',
  },
} as const;

function text(value: unknown) {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

function formatDate(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function ContactName({ contact }: { contact: Row }) {
  const person = contact.person || {};
  return <>{[person.preferred_name || person.first_name, person.last_name].filter(Boolean).join(' ') || 'Unnamed contact'}</>;
}

function EditableField({
  label,
  value,
  field,
  canWrite,
  onSave,
  multiline = false,
  type = 'text',
}: {
  label: string;
  value: unknown;
  field: string;
  canWrite: boolean;
  onSave: (field: string, value: string) => Promise<void>;
  multiline?: boolean;
  type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ''));
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(String(value ?? '')), [value]);

  async function save() {
    setSaving(true);
    try {
      await onSave(field, draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="group border-b border-neutral-800/70 px-4 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-neutral-500">{label}</div>
          {editing ? (
            multiline ? (
              <textarea
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="mt-2 min-h-24 w-full rounded-lg border border-neutral-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#FA4616]"
              />
            ) : (
              <input
                autoFocus
                type={type}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void save();
                  if (event.key === 'Escape') setEditing(false);
                }}
                className="mt-2 w-full rounded-lg border border-neutral-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#FA4616]"
              />
            )
          ) : (
            <div className="mt-1 break-words text-sm font-semibold text-white">{text(value)}</div>
          )}
        </div>
        {canWrite && (
          editing ? (
            <div className="flex gap-1">
              <button type="button" disabled={saving} onClick={() => void save()} className="rounded-md p-1.5 text-emerald-300 hover:bg-neutral-800" aria-label={`Save ${label}`}>
                <Save className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setEditing(false)} className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-white" aria-label={`Cancel ${label}`}>
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="rounded-md p-1.5 text-neutral-600 opacity-0 transition group-hover:opacity-100 hover:bg-neutral-800 hover:text-white" aria-label={`Edit ${label}`}>
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )
        )}
      </div>
    </div>
  );
}

function CreateRecordModal({ type, onClose, onCreated }: { type: RecordType; onClose: () => void; onCreated: (row: Row) => void }) {
  const cfg = typeConfig[type];
  const [name, setName] = useState('');
  const [category, setCategory] = useState(type === 'vendor' ? '' : 'municipality');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setSaving(true);
    setError('');
    try {
      const response = await authenticatedFetch('/api/admin-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: cfg.createAction,
          name,
          ...(type === 'vendor' ? { vendor_category: category } : { organization_type: category }),
          email,
          phone,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || `Unable to create ${cfg.singular.toLowerCase()}.`);
      onCreated(json.record);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create record.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4" onMouseDown={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-neutral-700 bg-[#0b0d0d] p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[.18em] text-[#FA4616]">Create record</div>
            <h2 className="mt-1 text-2xl font-black text-white">Add {cfg.singular}</h2>
            <p className="mt-1 text-sm text-neutral-400">Start with the essentials. Everything else can be updated directly on the record.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-neutral-700 p-2 text-neutral-400 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        {error && <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-200">{error}</div>}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="text-xs font-bold text-neutral-400">Name</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-700 bg-black px-3 py-2.5 text-white outline-none focus:border-[#FA4616]" />
          </label>
          <label>
            <span className="text-xs font-bold text-neutral-400">{type === 'vendor' ? 'Category' : 'Organization type'}</span>
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={type === 'vendor' ? 'EMS, lifeguards, boats…' : 'Municipality, recreation department…'} className="mt-1 w-full rounded-lg border border-neutral-700 bg-black px-3 py-2.5 text-white outline-none focus:border-[#FA4616]" />
          </label>
          <label>
            <span className="text-xs font-bold text-neutral-400">Phone</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-700 bg-black px-3 py-2.5 text-white outline-none focus:border-[#FA4616]" />
          </label>
          <label className="sm:col-span-2">
            <span className="text-xs font-bold text-neutral-400">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-700 bg-black px-3 py-2.5 text-white outline-none focus:border-[#FA4616]" />
          </label>
        </div>
        <button type="button" disabled={saving || !name.trim()} onClick={() => void submit()} className="mt-6 w-full rounded-xl bg-[#FA4616] px-4 py-3 text-sm font-black text-black disabled:opacity-40">
          {saving ? 'Creating…' : `Create ${cfg.singular}`}
        </button>
      </div>
    </div>
  );
}

function AddContactModal({ type, parentId, onClose, onSaved }: { type: RecordType; parentId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', job_title: '', department: '', relationship_type: 'contact', is_primary: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const patch = (key: string, value: unknown) => setForm((current) => ({ ...current, [key]: value }));

  async function submit() {
    setSaving(true);
    setError('');
    try {
      const response = await authenticatedFetch('/api/admin-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add-contact', parentType: type, parentId, ...form }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to add contact.');
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to add contact.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 p-4" onMouseDown={onClose}>
      <div className="w-full max-w-xl rounded-2xl border border-neutral-700 bg-[#0b0d0d] p-6" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div><div className="text-xs font-black uppercase tracking-[.18em] text-[#FA4616]">Relationship</div><h2 className="mt-1 text-2xl font-black">Add Contact</h2></div>
          <button type="button" onClick={onClose} className="rounded-lg border border-neutral-700 p-2 text-neutral-400"><X className="h-4 w-4" /></button>
        </div>
        {error && <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-200">{error}</div>}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {[
            ['first_name', 'First name'], ['last_name', 'Last name'], ['email', 'Email'], ['phone', 'Phone'], ['job_title', 'Job title'], ['department', 'Department'], ['relationship_type', 'Relationship'],
          ].map(([key, label]) => (
            <label key={key} className={key === 'relationship_type' ? 'sm:col-span-2' : ''}>
              <span className="text-xs font-bold text-neutral-400">{label}</span>
              <input value={(form as any)[key]} onChange={(e) => patch(key, e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-700 bg-black px-3 py-2.5 text-white outline-none focus:border-[#FA4616]" />
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm text-neutral-300 sm:col-span-2"><input type="checkbox" checked={form.is_primary} onChange={(e) => patch('is_primary', e.target.checked)} /> Primary contact</label>
        </div>
        <button type="button" disabled={saving || !form.first_name.trim() || !form.last_name.trim()} onClick={() => void submit()} className="mt-6 w-full rounded-xl bg-[#FA4616] px-4 py-3 text-sm font-black text-black disabled:opacity-40">{saving ? 'Adding…' : 'Add contact'}</button>
      </div>
    </div>
  );
}

function DirectoryList({ type, records, loading, canWrite, onOpen, onAdd, onRefresh }: { type: RecordType; records: Row[]; loading: boolean; canWrite: boolean; onOpen: (id: string) => void; onAdd: () => void; onRefresh: () => void }) {
  const cfg = typeConfig[type];
  const Icon = cfg.icon;
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter((row) => [row.name, row.vendor_category, row.organization_type, row.email, row.phone, row.city, row.region].some((value) => String(value || '').toLowerCase().includes(q)));
  }, [records, query]);

  return (
    <main className="min-h-full bg-[#060707] p-5 text-white lg:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-[#FA4616]"><Icon className="h-4 w-4" /> Admin records</div>
          <h1 className="mt-1 text-3xl font-black">{cfg.plural}</h1>
          <p className="mt-2 text-sm text-neutral-400">{cfg.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onRefresh} className="rounded-xl border border-neutral-700 p-3 text-neutral-400 hover:text-white" aria-label="Refresh"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
          {canWrite && <button type="button" onClick={onAdd} className="inline-flex items-center gap-2 rounded-xl bg-[#FA4616] px-4 py-3 text-sm font-black text-black"><Plus className="h-4 w-4" /> Add {cfg.singular}</button>}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3 rounded-xl border border-neutral-800 bg-[#0b0d0d] px-4 py-3">
        <Search className="h-4 w-4 text-neutral-500" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${cfg.plural.toLowerCase()}…`} className="w-full bg-transparent text-sm text-white outline-none placeholder:text-neutral-600" />
        <span className="text-xs font-bold text-neutral-500">{filtered.length}</span>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-neutral-800 bg-[#0b0d0d]">
        <div className="grid grid-cols-[minmax(220px,1.5fr)_1fr_1fr_130px] gap-3 border-b border-neutral-800 px-4 py-3 text-xs font-black uppercase tracking-[.12em] text-neutral-500">
          <span>Name</span><span>Type / Category</span><span>Contact</span><span>Status</span>
        </div>
        {loading && !records.length ? (
          <div className="p-10 text-center text-sm text-neutral-500">Loading {cfg.plural.toLowerCase()}…</div>
        ) : filtered.length ? filtered.map((row) => (
          <button key={row.id} type="button" onClick={() => onOpen(row.id)} className="grid w-full grid-cols-[minmax(220px,1.5fr)_1fr_1fr_130px] gap-3 border-b border-neutral-800/70 px-4 py-4 text-left last:border-b-0 hover:bg-neutral-900/70">
            <span className="min-w-0"><span className="block truncate text-sm font-black text-white">{row.name}</span><span className="mt-1 block truncate text-xs text-neutral-500">{[row.city, row.region].filter(Boolean).join(', ') || 'Location not set'}</span></span>
            <span className="text-sm text-neutral-300">{row.vendor_category || row.organization_type || '—'}</span>
            <span className="min-w-0"><span className="block truncate text-sm text-neutral-300">{row.email || row.phone || 'No contact info yet'}</span></span>
            <span><span className="inline-flex rounded-full bg-neutral-800 px-2.5 py-1 text-xs font-bold text-neutral-200">{row.status || 'active'}</span></span>
          </button>
        )) : (
          <div className="p-10 text-center"><div className="text-sm font-bold text-white">No {cfg.plural.toLowerCase()} found.</div><div className="mt-1 text-sm text-neutral-500">{canWrite ? `Use “Add ${cfg.singular}” to create the first record.` : 'No records are available in your current organization scope.'}</div></div>
        )}
      </div>
    </main>
  );
}

function RecordView({ type, record, canWrite, onBack, onRefresh }: { type: RecordType; record: Row; canWrite: boolean; onBack: () => void; onRefresh: () => void }) {
  const cfg = typeConfig[type];
  const Icon = cfg.icon;
  const [tab, setTab] = useState<'overview' | 'activity' | 'finance'>('overview');
  const [showContact, setShowContact] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const contacts = record.contacts || [];
  const bills = record.bills || [];
  const tasks = record.tasks || [];
  const activity = record.activity || [];
  const primary = contacts.find((contact: Row) => contact.is_primary) || contacts[0];

  async function saveField(field: string, value: string) {
    setSaving(true);
    setError('');
    try {
      const response = await authenticatedFetch('/api/admin-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: cfg.updateAction, id: record.id, [field]: value }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to update record.');
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update record.');
      throw cause;
    } finally {
      setSaving(false);
    }
  }

  const leftFields = type === 'vendor'
    ? [
        ['Vendor code', 'vendor_code'], ['Category', 'vendor_category'], ['Status', 'status'], ['Compliance', 'compliance_status'], ['Insurance expires', 'insurance_expires_on'], ['Phone', 'phone'], ['Email', 'email'], ['Website', 'website'], ['City', 'city'], ['Region', 'region'],
      ]
    : [
        ['Organization type', 'organization_type'], ['Status', 'status'], ['Phone', 'phone'], ['Email', 'email'], ['Website', 'website'], ['City', 'city'], ['Region', 'region'], ['Postal code', 'postal_code'],
      ];

  return (
    <>
      <ThreeColumnRecordWorkspace
        left={
          <>
            <RecordPanel>
              <div className="p-4">
                <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm font-bold text-neutral-400 hover:text-white"><ChevronLeft className="h-4 w-4" /> {cfg.plural}</button>
                <div className="mt-5 flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neutral-800"><Icon className="h-6 w-6 text-[#FA4616]" /></div>
                  <div className="min-w-0"><h1 className="break-words text-xl font-black text-white">{record.name}</h1><div className="mt-1 text-xs font-bold uppercase tracking-[.12em] text-neutral-500">{cfg.singular}</div></div>
                </div>
                <div className="mt-5 grid grid-cols-4 gap-2">
                  <a href={record.email ? `mailto:${record.email}` : undefined} className={`flex flex-col items-center gap-1 rounded-lg border border-neutral-800 py-2 text-[11px] font-semibold ${record.email ? 'text-neutral-300 hover:border-neutral-600 hover:text-white' : 'pointer-events-none text-neutral-700'}`}><Mail className="h-4 w-4" /> Email</a>
                  <a href={record.phone ? `tel:${record.phone}` : undefined} className={`flex flex-col items-center gap-1 rounded-lg border border-neutral-800 py-2 text-[11px] font-semibold ${record.phone ? 'text-neutral-300 hover:border-neutral-600 hover:text-white' : 'pointer-events-none text-neutral-700'}`}><Phone className="h-4 w-4" /> Call</a>
                  <button type="button" onClick={() => setShowContact(true)} disabled={!canWrite} className="flex flex-col items-center gap-1 rounded-lg border border-neutral-800 py-2 text-[11px] font-semibold text-neutral-300 hover:border-neutral-600 hover:text-white disabled:opacity-30"><UserPlus className="h-4 w-4" /> Contact</button>
                  <button type="button" onClick={() => setTab('activity')} className="flex flex-col items-center gap-1 rounded-lg border border-neutral-800 py-2 text-[11px] font-semibold text-neutral-300 hover:border-neutral-600 hover:text-white"><Activity className="h-4 w-4" /> Activity</button>
                </div>
              </div>
            </RecordPanel>

            <RecordPanel>
              <RecordSectionHeader title="Key information" />
              {leftFields.map(([label, field]) => <EditableField key={field} label={label} field={field} value={record[field]} canWrite={canWrite && field !== 'vendor_code'} onSave={saveField} type={field.includes('expires') ? 'date' : field === 'email' ? 'email' : 'text'} />)}
            </RecordPanel>
          </>
        }
        center={
          <>
            <RecordPanel>
              <div className="flex min-h-14 items-center overflow-x-auto px-2">
                {(['overview', 'activity', ...(type === 'vendor' ? ['finance'] : [])] as const).map((value) => (
                  <button key={value} type="button" onClick={() => setTab(value as any)} className={`border-b-2 px-5 py-4 text-sm font-black capitalize ${tab === value ? 'border-[#FA4616] text-white' : 'border-transparent text-neutral-500 hover:text-white'}`}>{value}</button>
                ))}
                <div className="ml-auto flex items-center gap-2 px-3 text-xs text-neutral-600">{saving && 'Saving…'}</div>
              </div>
            </RecordPanel>

            {error && <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-200"><AlertTriangle className="mr-2 inline h-4 w-4" />{error}</div>}

            {tab === 'overview' && (
              <>
                <RecordPanel>
                  <RecordSectionHeader title="About" />
                  <div className="grid sm:grid-cols-2">
                    <EditableField label="Address line 1" field="address_line1" value={record.address_line1} canWrite={canWrite} onSave={saveField} />
                    <EditableField label="Address line 2" field="address_line2" value={record.address_line2} canWrite={canWrite} onSave={saveField} />
                    <EditableField label="City" field="city" value={record.city} canWrite={canWrite} onSave={saveField} />
                    <EditableField label="Region / Province / State" field="region" value={record.region} canWrite={canWrite} onSave={saveField} />
                    <EditableField label="Postal code" field="postal_code" value={record.postal_code} canWrite={canWrite} onSave={saveField} />
                    <EditableField label="Country" field="country_code" value={record.country_code} canWrite={canWrite} onSave={saveField} />
                  </div>
                </RecordPanel>
                <RecordPanel>
                  <RecordSectionHeader title="Notes" />
                  <EditableField label="Record notes" field="notes" value={record.notes} canWrite={canWrite} onSave={saveField} multiline />
                </RecordPanel>
                <RecordPanel>
                  <RecordSectionHeader title="Relationship summary" />
                  <div className="grid gap-3 p-4 sm:grid-cols-3">
                    <div className="rounded-lg bg-neutral-900 p-4"><div className="text-xs font-bold text-neutral-500">Contacts</div><div className="mt-1 text-2xl font-black">{contacts.length}</div></div>
                    <div className="rounded-lg bg-neutral-900 p-4"><div className="text-xs font-bold text-neutral-500">Open tasks</div><div className="mt-1 text-2xl font-black">{tasks.filter((task: Row) => task.status !== 'completed').length}</div></div>
                    <div className="rounded-lg bg-neutral-900 p-4"><div className="text-xs font-bold text-neutral-500">{type === 'vendor' ? 'Bills' : 'Activity'}</div><div className="mt-1 text-2xl font-black">{type === 'vendor' ? bills.length : activity.length}</div></div>
                  </div>
                </RecordPanel>
              </>
            )}

            {tab === 'activity' && (
              <RecordPanel>
                <RecordSectionHeader title="Activity" />
                <div className="divide-y divide-neutral-800">
                  {activity.length ? activity.map((item: Row) => (
                    <div key={item.id} className="flex gap-3 p-4"><Activity className="mt-0.5 h-4 w-4 shrink-0 text-[#FA4616]" /><div><div className="text-sm font-bold text-white">{String(item.action || '').replaceAll('_', ' ')}</div><div className="mt-1 text-xs text-neutral-500">{formatDate(item.occurred_at)}{item.reason ? ` · ${item.reason}` : ''}</div></div></div>
                  )) : <div className="p-8 text-center text-sm text-neutral-500">No recorded activity yet.</div>}
                </div>
              </RecordPanel>
            )}

            {tab === 'finance' && type === 'vendor' && (
              <RecordPanel>
                <RecordSectionHeader title="Vendor bills" />
                <div className="divide-y divide-neutral-800">
                  {bills.length ? bills.map((bill: Row) => (
                    <div key={bill.id} className="grid grid-cols-[1fr_auto] gap-4 p-4"><div><div className="text-sm font-black">{bill.bill_number}</div><div className="mt-1 text-xs text-neutral-500">{formatDate(bill.bill_date)} · {bill.status || 'unknown'}</div></div><div className="text-right"><div className="text-sm font-black">{Number(bill.total || 0).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}</div><div className="text-xs text-neutral-500">Due {Number(bill.balance_due || 0).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}</div></div></div>
                  )) : <div className="p-8 text-center text-sm text-neutral-500">No vendor bills are visible in your current role scope.</div>}
                </div>
              </RecordPanel>
            )}
          </>
        }
        right={
          <>
            <RecordPanel>
              <RecordSectionHeader title={`Contacts (${contacts.length})`} action={canWrite ? <button type="button" onClick={() => setShowContact(true)} className="inline-flex items-center gap-1 text-xs font-black text-neutral-300 hover:text-white"><Plus className="h-3.5 w-3.5" /> Add</button> : undefined} />
              <div className="divide-y divide-neutral-800">
                {contacts.length ? contacts.slice(0, 8).map((contact: Row) => (
                  <div key={contact.id} className="p-4"><div className="flex items-start gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-xs font-black text-[#FA4616]"><ContactName contact={contact} /></div><div className="min-w-0"><div className="truncate text-sm font-black"><ContactName contact={contact} />{contact.is_primary && <span className="ml-2 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-300">PRIMARY</span>}</div><div className="mt-1 truncate text-xs text-neutral-500">{contact.job_title || contact.relationship_type || 'Contact'}</div><div className="mt-1 truncate text-xs text-neutral-500">{contact.person?.email || contact.person?.phone || 'Contact details not set'}</div></div></div></div>
                )) : <div className="p-6 text-center text-sm text-neutral-500">No contacts yet.{canWrite ? ' Add the first contact.' : ''}</div>}
              </div>
            </RecordPanel>

            <RecordPanel>
              <RecordSectionHeader title={`Tasks (${tasks.length})`} />
              <div className="divide-y divide-neutral-800">
                {tasks.length ? tasks.slice(0, 6).map((task: Row) => <div key={task.id} className="flex gap-3 p-4"><ListTodo className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" /><div><div className="text-sm font-bold">{task.payload?.title || task.work_type}</div><div className="mt-1 text-xs text-neutral-500">{task.status} · {task.priority || 'normal'}</div></div></div>) : <div className="p-6 text-center text-sm text-neutral-500">No linked tasks.</div>}
              </div>
            </RecordPanel>

            {type === 'vendor' && <RecordPanel><RecordSectionHeader title={`Bills (${bills.length})`} /><div className="p-4"><div className="flex items-center gap-3"><Receipt className="h-5 w-5 text-neutral-500" /><div><div className="text-sm font-black">{bills.length} visible bill{bills.length === 1 ? '' : 's'}</div><div className="text-xs text-neutral-500">Finance visibility follows your Admin authority.</div></div></div></div></RecordPanel>}

            <RecordPanel>
              <RecordSectionHeader title="Record health" />
              <div className="space-y-3 p-4 text-sm">
                <div className="flex items-center gap-2">{primary ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <AlertTriangle className="h-4 w-4 text-amber-300" />}<span>{primary ? 'Primary contact available' : 'Primary contact missing'}</span></div>
                <div className="flex items-center gap-2">{record.email || record.phone ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <AlertTriangle className="h-4 w-4 text-amber-300" />}<span>{record.email || record.phone ? 'Direct contact available' : 'Direct contact missing'}</span></div>
                {type === 'vendor' && <div className="flex items-center gap-2">{record.compliance_status && record.compliance_status !== 'unknown' ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <AlertTriangle className="h-4 w-4 text-amber-300" />}<span>Compliance: {record.compliance_status || 'unknown'}</span></div>}
              </div>
            </RecordPanel>
          </>
        }
      />
      {showContact && <AddContactModal type={type} parentId={record.id} onClose={() => setShowContact(false)} onSaved={() => { setShowContact(false); void onRefresh(); }} />}
    </>
  );
}

export function RelationshipDirectory({ type }: { type: RecordType }) {
  const [records, setRecords] = useState<Row[]>([]);
  const [record, setRecord] = useState<Row | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await authenticatedFetch(`/api/admin-records?type=${encodeURIComponent(type)}`, { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to load records.');
      setRecords(json.records || []);
      setCanWrite(Boolean(json.canWrite));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load records.');
    } finally {
      setLoading(false);
    }
  }, [type]);

  const loadRecord = useCallback(async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await authenticatedFetch(`/api/admin-records?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to load record.');
      if (!json.record) throw new Error('Record not found or outside your organization scope.');
      setRecord(json.record);
      setCanWrite(Boolean(json.canWrite));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load record.');
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => { if (selectedId) void loadRecord(selectedId); else setRecord(null); }, [selectedId, loadRecord]);

  if (selectedId && record) {
    return <RecordView type={type} record={record} canWrite={canWrite} onBack={() => setSelectedId(null)} onRefresh={async () => { await loadRecord(selectedId); await loadList(); }} />;
  }

  return (
    <>
      {error && <div className="m-5 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-200">{error}</div>}
      <DirectoryList type={type} records={records} loading={loading} canWrite={canWrite} onOpen={setSelectedId} onAdd={() => setShowCreate(true)} onRefresh={() => void loadList()} />
      {showCreate && <CreateRecordModal type={type} onClose={() => setShowCreate(false)} onCreated={(row) => { setShowCreate(false); void loadList(); if (row?.id) setSelectedId(row.id); }} />}
    </>
  );
}

export function VendorDirectory() {
  return <RelationshipDirectory type="vendor" />;
}

export function ExternalOrganizationDirectory() {
  return <RelationshipDirectory type="external-organization" />;
}
