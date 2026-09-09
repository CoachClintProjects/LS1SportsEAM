'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ChevronLeft, ChevronRight, Search, Users, X } from 'lucide-react';

type Row = Record<string, any>;
type MembershipRecord = Row & {
  person?: Row;
  sport?: Row;
  governingBody?: Row;
  athlete?: Row;
  groups: Row[];
  teams: Row[];
  coaches: Row[];
  family?: Row;
  familyMembers: Row[];
  emergencyContacts: Row[];
};

let client: SupabaseClient | null = null;
function db() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase browser configuration is missing.');
  client = createClient(url, key);
  return client;
}

const PAGE_SIZE = 25;
const text = (value: any) => value === null || value === undefined || value === '' ? '—' : String(value).replaceAll('_', ' ');
const formatDate = (value: any) => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
const personName = (person: any) => person ? [person.preferred_name || person.first_name, person.last_name].filter(Boolean).join(' ') || '—' : '—';
const unique = <T,>(items: T[]) => Array.from(new Set(items));

function ageFromDob(value: any) {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  const today = new Date();
  let age = today.getFullYear() - year;
  const birthdayPassed = today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!birthdayPassed) age -= 1;
  return age;
}

function ageBand(age: number | null) {
  if (age === null) return 'DOB missing';
  if (age < 8) return 'U8';
  if (age < 10) return 'U10';
  if (age < 12) return 'U12';
  if (age < 14) return 'U14';
  if (age < 16) return 'U16';
  if (age < 18) return 'U18';
  return '18+';
}

function activeStatus(value: any) {
  const status = String(value || '').toLowerCase();
  return !status || status === 'active' || status === 'current' || status === 'approved';
}

async function optionalRows(table: string, select: string, column?: string, values?: string[]) {
  try {
    let query = db().from(table).select(select).limit(1000);
    if (column && values?.length) query = query.in(column, values);
    if (column && !values?.length) return [] as Row[];
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Row[];
  } catch (error) {
    console.warn(`[Membership] optional ${table} enrichment unavailable`, error);
    return [] as Row[];
  }
}

function Status({ value }: { value: any }) {
  const status = String(value || 'unknown').toLowerCase();
  const tone = status === 'active' || status === 'current' || status === 'approved'
    ? 'ls1-status-success'
    : status.includes('pending') || status.includes('review')
      ? 'ls1-status-warning'
      : status.includes('expired') || status.includes('inactive') || status.includes('cancel')
        ? 'ls1-status-danger'
        : 'ls1-status-info';
  return <span className={`${tone} rounded-full border border-current/20 px-2.5 py-1 text-sm font-bold capitalize`}>{text(status)}</span>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><div className="text-[11px] font-black uppercase tracking-[.13em] text-neutral-500">{label}</div><div className="mt-1 text-sm font-semibold text-neutral-100">{value || '—'}</div></div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-neutral-800 bg-[#0a0c0c] p-4"><h3 className="mb-4 text-xs font-black uppercase tracking-[.16em] text-[#FA4616]">{title}</h3>{children}</section>;
}

function MembershipDrawer({ record, onClose }: { record: MembershipRecord; onClose: () => void }) {
  const age = ageFromDob(record.person?.birth_date);
  const familyContacts = record.familyMembers.filter(member => member.person_id !== record.person_id);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return <div className="fixed inset-0 z-[180] flex justify-end bg-black/65" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="h-full w-full max-w-[620px] overflow-y-auto border-l border-neutral-800 bg-[#070909] shadow-2xl">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-neutral-800 bg-[#070909]/95 p-5 backdrop-blur">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[.16em] text-[#FA4616]">Member profile</div>
          <h2 className="mt-1 text-2xl font-black text-white">{personName(record.person)}</h2>
          <div className="mt-1 text-sm text-neutral-500">{record.membership_number || 'No membership number'} · {record.sport?.name || 'Sport not assigned'}</div>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg border border-neutral-800 p-2 text-neutral-400 hover:bg-neutral-900 hover:text-white" aria-label="Close member details"><X className="h-5 w-5" /></button>
      </div>

      <div className="space-y-4 p-5 pb-10">
        <Section title="Athlete / member">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date of birth" value={formatDate(record.person?.birth_date)} />
            <Field label="Age" value={age === null ? '—' : `${age}`} />
            <Field label="Email" value={record.person?.email || '—'} />
            <Field label="Phone" value={record.person?.phone || '—'} />
            <Field label="Sex" value={text(record.person?.sex)} />
            <Field label="Person status" value={text(record.person?.status)} />
            <Field label="Athlete #" value={record.athlete?.athlete_number || '—'} />
            <Field label="Athlete status" value={text(record.athlete?.athlete_status || record.athlete?.status)} />
          </div>
        </Section>

        <Section title="Membership">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Membership #" value={record.membership_number || '—'} />
            <Field label="Status" value={<Status value={record.status} />} />
            <Field label="Type" value={text(record.membership_type)} />
            <Field label="Sport" value={record.sport?.name || '—'} />
            <Field label="Governing body" value={record.governingBody?.name || '—'} />
            <Field label="Governing body code" value={record.governingBody?.code || '—'} />
            <Field label="Starts" value={formatDate(record.starts_on)} />
            <Field label="Ends" value={formatDate(record.ends_on)} />
          </div>
        </Section>

        <Section title="Sport placement">
          <div className="space-y-4">
            <div><div className="text-[11px] font-black uppercase tracking-[.13em] text-neutral-500">Groups / teams</div><div className="mt-2 flex flex-wrap gap-2">{record.groups.length || record.teams.length ? unique([...record.groups.map(group => group.name), ...record.teams.map(team => team.name)].filter(Boolean)).map(name => <span key={name} className="rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-sm font-semibold text-neutral-200">{name}</span>) : <span className="text-sm text-neutral-500">No current group or team assignment.</span>}</div></div>
            <div><div className="text-[11px] font-black uppercase tracking-[.13em] text-neutral-500">Coaches</div><div className="mt-2 space-y-2">{record.coaches.length ? record.coaches.map((coach, index) => <div key={`${coach.id || coach.person_id}-${index}`} className="rounded-lg border border-neutral-800 p-3"><div className="font-bold text-white">{personName(coach.person)}</div><div className="mt-0.5 text-xs text-neutral-500">{text(coach.role_code)}{coach.team?.name ? ` · ${coach.team.name}` : ''}</div></div>) : <div className="text-sm text-neutral-500">No coach assignment found.</div>}</div></div>
          </div>
        </Section>

        <Section title="Parents / guardians / family">
          {record.family && <div className="mb-3 text-sm font-bold text-neutral-300">{record.family.name || 'Family record'}</div>}
          <div className="space-y-2">{familyContacts.length ? familyContacts.map((member, index) => <div key={`${member.person_id}-${index}`} className="rounded-lg border border-neutral-800 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-bold text-white">{personName(member.person)}</div>{member.is_primary_guardian ? <span className="rounded-full border border-[#FA4616]/30 bg-[#FA4616]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[.08em] text-[#FA4616]">Primary guardian</span> : null}</div><div className="mt-1 text-xs capitalize text-neutral-500">{text(member.relationship_type)}</div><div className="mt-2 text-xs text-neutral-400">{[member.person?.email, member.person?.phone].filter(Boolean).join(' · ') || 'No contact details'}</div></div>) : <div className="text-sm text-neutral-500">No linked parent or guardian records found.</div>}</div>
        </Section>

        <Section title="Emergency contacts">
          <div className="space-y-2">{record.emergencyContacts.length ? record.emergencyContacts.map((contact, index) => <div key={`${contact.contact_id || contact.name}-${index}`} className="rounded-lg border border-neutral-800 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-bold text-white">{contact.name || 'Emergency contact'}</div>{contact.is_primary ? <span className="text-xs font-bold text-emerald-400">Primary</span> : null}</div><div className="mt-1 text-xs text-neutral-500">{text(contact.relationship)}</div><div className="mt-2 text-xs text-neutral-400">{[contact.phone_primary, contact.email].filter(Boolean).join(' · ') || 'No contact details'}</div></div>) : <div className="text-sm text-neutral-500">No emergency contacts found.</div>}</div>
        </Section>
      </div>
    </aside>
  </div>;
}

function useMembershipRecords() {
  const [rows, setRows] = useState<MembershipRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data: membershipData, error: membershipError } = await db().from('memberships').select('id,organization_id,person_id,sport_id,membership_number,membership_type,starts_on,ends_on,status,governing_body_id').limit(1000);
      if (membershipError) throw membershipError;
      const memberships = (membershipData || []) as Row[];
      const personIds = unique(memberships.map(row => row.person_id).filter(Boolean));
      const sportIds = unique(memberships.map(row => row.sport_id).filter(Boolean));
      const governingBodyIds = unique(memberships.map(row => row.governing_body_id).filter(Boolean));

      const [memberPeople, sports, governingBodies, athletes] = await Promise.all([
        optionalRows('people', 'id,first_name,middle_name,last_name,preferred_name,birth_date,sex,pronouns,email,phone,status', 'id', personIds),
        optionalRows('sports', 'id,code,name,status', 'id', sportIds),
        optionalRows('governing_bodies', 'id,code,name,country_code,level', 'id', governingBodyIds),
        optionalRows('athletes', 'id,person_id,athlete_number,athlete_status,primary_family_id,status', 'person_id', personIds),
      ]);

      const athleteIds = unique(athletes.map(row => row.id).filter(Boolean));
      const familyIds = unique(athletes.map(row => row.primary_family_id).filter(Boolean));
      const [teamMemberships, groupMemberships, familyMembers, families, emergencyContacts] = await Promise.all([
        optionalRows('team_memberships', 'id,team_id,athlete_id,person_id,membership_type,status,jersey_number,starts_on,ends_on', 'athlete_id', athleteIds),
        optionalRows('group_memberships', 'group_id,athlete_id,starts_on,ends_on,status', 'athlete_id', athleteIds),
        optionalRows('family_members', 'family_id,person_id,relationship_type,is_primary_guardian,can_view_minor_data,created_at', 'family_id', familyIds),
        optionalRows('families', 'id,name,status', 'id', familyIds),
        optionalRows('emergency_contacts', 'contact_id,athlete_id,person_id,name,relationship,phone_primary,phone_secondary,email,is_primary,can_pickup,has_custody,notes', 'athlete_id', athleteIds),
      ]);

      const groupIds = unique(groupMemberships.map(row => row.group_id).filter(Boolean));
      const groups = await optionalRows('groups', 'id,team_id,program_id,code,name,group_type,status', 'id', groupIds);
      const teamIds = unique([...teamMemberships.map(row => row.team_id), ...groups.map(row => row.team_id)].filter(Boolean));
      const [teams, staffAssignments] = await Promise.all([
        optionalRows('teams', 'id,sport_id,program_id,season_id,code,name,competitive_level,status', 'id', teamIds),
        optionalRows('staff_assignments', 'id,team_id,person_id,role_code,starts_on,ends_on,status', 'team_id', teamIds),
      ]);

      const familyPersonIds = familyMembers.map(row => row.person_id).filter(Boolean);
      const staffPersonIds = staffAssignments.map(row => row.person_id).filter(Boolean);
      const relatedPersonIds = unique([...familyPersonIds, ...staffPersonIds]);
      const relatedPeople = await optionalRows('people', 'id,first_name,last_name,preferred_name,email,phone,status', 'id', relatedPersonIds);

      const personById = new Map([...memberPeople, ...relatedPeople].map(row => [row.id, row]));
      const sportById = new Map(sports.map(row => [row.id, row]));
      const governingBodyById = new Map(governingBodies.map(row => [row.id, row]));
      const athleteByPersonId = new Map(athletes.map(row => [row.person_id, row]));
      const familyById = new Map(families.map(row => [row.id, row]));
      const groupById = new Map(groups.map(row => [row.id, row]));
      const teamById = new Map(teams.map(row => [row.id, row]));

      const enriched = memberships.map(membership => {
        const athlete = athleteByPersonId.get(membership.person_id);
        const athleteTeamMemberships = teamMemberships.filter(row => row.athlete_id === athlete?.id || row.person_id === membership.person_id).filter(row => activeStatus(row.status));
        const athleteGroupMemberships = groupMemberships.filter(row => row.athlete_id === athlete?.id).filter(row => activeStatus(row.status));
        const memberGroups = athleteGroupMemberships.map(row => groupById.get(row.group_id)).filter(Boolean) as Row[];
        const relevantTeamIds = unique([...athleteTeamMemberships.map(row => row.team_id), ...memberGroups.map(row => row.team_id)].filter(Boolean));
        const memberTeams = relevantTeamIds.map(id => teamById.get(id)).filter(Boolean) as Row[];
        const coaches = staffAssignments
          .filter(row => relevantTeamIds.includes(row.team_id) && activeStatus(row.status) && String(row.role_code || '').toLowerCase().includes('coach'))
          .map(row => ({ ...row, person: personById.get(row.person_id), team: teamById.get(row.team_id) }));
        const members = familyMembers
          .filter(row => row.family_id === athlete?.primary_family_id)
          .map(row => ({ ...row, person: personById.get(row.person_id) }));
        return {
          ...membership,
          person: personById.get(membership.person_id),
          sport: sportById.get(membership.sport_id),
          governingBody: governingBodyById.get(membership.governing_body_id),
          athlete,
          groups: memberGroups,
          teams: memberTeams,
          coaches,
          family: familyById.get(athlete?.primary_family_id),
          familyMembers: members,
          emergencyContacts: emergencyContacts.filter(row => row.athlete_id === athlete?.id),
        } as MembershipRecord;
      });
      setRows(enriched);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load membership records.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);
  return { rows, loading, error, load };
}

export function MembershipView() {
  const { rows, loading, error } = useMembershipRecords();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [sport, setSport] = useState('all');
  const [group, setGroup] = useState('all');
  const [coach, setCoach] = useState('all');
  const [age, setAge] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MembershipRecord | null>(null);

  const statuses = useMemo(() => unique(rows.map(row => String(row.status || 'unknown'))).sort(), [rows]);
  const sports = useMemo(() => unique(rows.map(row => row.sport?.name).filter(Boolean)).sort(), [rows]);
  const groups = useMemo(() => unique(rows.flatMap(row => [...row.groups.map(item => item.name), ...row.teams.map(item => item.name)]).filter(Boolean)).sort(), [rows]);
  const coaches = useMemo(() => unique(rows.flatMap(row => row.coaches.map(item => personName(item.person))).filter(name => name && name !== '—')).sort(), [rows]);

  const filtered = useMemo(() => rows.filter(row => {
    const rowAge = ageFromDob(row.person?.birth_date);
    const names = [...row.groups.map(item => item.name), ...row.teams.map(item => item.name)].filter(Boolean);
    const coachNames = row.coaches.map(item => personName(item.person));
    const haystack = [personName(row.person), row.person?.email, row.membership_number, row.sport?.name, ...names, ...coachNames].filter(Boolean).join(' ').toLowerCase();
    return (!query.trim() || haystack.includes(query.trim().toLowerCase()))
      && (status === 'all' || String(row.status || 'unknown') === status)
      && (sport === 'all' || row.sport?.name === sport)
      && (group === 'all' || names.includes(group))
      && (coach === 'all' || coachNames.includes(coach))
      && (age === 'all' || ageBand(rowAge) === age);
  }), [rows, query, status, sport, group, coach, age]);

  useEffect(() => { setPage(1); }, [query, status, sport, group, coach, age]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const firstRecord = filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastRecord = Math.min(page * PAGE_SIZE, filtered.length);

  return <main className="space-y-5 p-5 text-white lg:p-7">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-800 pb-5">
      <div><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-[var(--ls1-brand)]"><Users className="h-4 w-4" />Admin records</div><h1 className="mt-2 text-3xl font-black">Membership</h1><p className="mt-1 max-w-3xl text-base leading-7 text-neutral-400">Operational member directory with athlete identity, sport placement, coaching and family context. Select any member to open the complete record.</p></div>
      <div className="rounded-xl border border-neutral-800 bg-[var(--ls1-surface-2)] px-5 py-3"><div className="text-2xl font-black">{rows.length}</div><div className="text-sm text-neutral-400">records</div></div>
    </header>

    {loading ? <div className="rounded-xl border border-neutral-800 p-6 text-neutral-400">Loading authorized membership records…</div> : error ? <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-red-200">{error}</div> : <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-[var(--ls1-surface-1)]">
      <div className="space-y-3 border-b border-neutral-800 p-4">
        <label className="flex max-w-xl items-center gap-2 rounded-xl border border-neutral-700 bg-black px-3 py-3"><Search className="h-4 w-4 text-neutral-500" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search member, membership #, group, coach…" className="w-full bg-transparent text-base text-white outline-none placeholder:text-neutral-600" /></label>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <select value={status} onChange={event => setStatus(event.target.value)} className="rounded-lg border border-neutral-700 bg-[#0b0d0d] px-3 py-2.5 text-sm text-neutral-200"><option value="all">All statuses</option>{statuses.map(value => <option key={value} value={value}>{text(value)}</option>)}</select>
          <select value={sport} onChange={event => setSport(event.target.value)} className="rounded-lg border border-neutral-700 bg-[#0b0d0d] px-3 py-2.5 text-sm text-neutral-200"><option value="all">All sports</option>{sports.map(value => <option key={value} value={value}>{value}</option>)}</select>
          <select value={group} onChange={event => setGroup(event.target.value)} className="rounded-lg border border-neutral-700 bg-[#0b0d0d] px-3 py-2.5 text-sm text-neutral-200"><option value="all">All groups / teams</option>{groups.map(value => <option key={value} value={value}>{value}</option>)}</select>
          <select value={coach} onChange={event => setCoach(event.target.value)} className="rounded-lg border border-neutral-700 bg-[#0b0d0d] px-3 py-2.5 text-sm text-neutral-200"><option value="all">All coaches</option>{coaches.map(value => <option key={value} value={value}>{value}</option>)}</select>
          <select value={age} onChange={event => setAge(event.target.value)} className="rounded-lg border border-neutral-700 bg-[#0b0d0d] px-3 py-2.5 text-sm text-neutral-200"><option value="all">All age groups</option>{['U8','U10','U12','U14','U16','U18','18+','DOB missing'].map(value => <option key={value} value={value}>{value}</option>)}</select>
        </div>
      </div>

      {pageRows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1060px] text-left text-base"><thead className="bg-[var(--ls1-surface-2)] text-sm uppercase tracking-[.08em] text-neutral-400"><tr><th className="px-4 py-3 font-bold">Member</th><th className="px-4 py-3 font-bold">Membership #</th><th className="px-4 py-3 font-bold">Age</th><th className="px-4 py-3 font-bold">DOB</th><th className="px-4 py-3 font-bold">Group / Team</th><th className="px-4 py-3 font-bold">Coach</th><th className="px-4 py-3 font-bold">Status</th></tr></thead><tbody className="divide-y divide-neutral-800">{pageRows.map(row => {
        const names = unique([...row.groups.map(item => item.name), ...row.teams.map(item => item.name)].filter(Boolean));
        const coachNames = unique(row.coaches.map(item => personName(item.person)).filter(Boolean));
        const memberAge = ageFromDob(row.person?.birth_date);
        return <tr key={row.id} tabIndex={0} role="button" aria-label={`Open ${personName(row.person)} membership details`} onClick={() => setSelected(row)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(row); } }} className="cursor-pointer transition hover:bg-white/[.045] focus:bg-white/[.045] focus:outline-none"><td className="px-4 py-3"><div className="font-bold text-white">{personName(row.person)}</div><div className="mt-0.5 text-sm text-neutral-500">{row.sport?.name || row.person?.email || 'Member record'}</div></td><td className="px-4 py-3 font-mono text-sm text-neutral-200">{row.membership_number || '—'}</td><td className="px-4 py-3 text-neutral-200">{memberAge === null ? '—' : memberAge}</td><td className="px-4 py-3 text-neutral-200">{formatDate(row.person?.birth_date)}</td><td className="px-4 py-3"><div className="font-semibold text-neutral-100">{names[0] || '—'}</div>{names.length > 1 ? <div className="mt-0.5 text-xs text-neutral-500">+{names.length - 1} more</div> : null}</td><td className="px-4 py-3"><div className="font-semibold text-neutral-100">{coachNames[0] || '—'}</div>{coachNames.length > 1 ? <div className="mt-0.5 text-xs text-neutral-500">+{coachNames.length - 1} more</div> : null}</td><td className="px-4 py-3"><Status value={row.status} /></td></tr>;
      })}</tbody></table></div> : <div className="p-10 text-center"><div className="text-lg font-bold text-white">No memberships match these filters</div><div className="mt-2 text-base text-neutral-500">Adjust search or filters to widen the member list.</div></div>}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-800 px-4 py-3"><div className="text-sm text-neutral-500">Showing {firstRecord}–{lastRecord} of {filtered.length} · 25 per page</div><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))} className="rounded-lg border border-neutral-700 p-2 text-neutral-300 hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button><span className="min-w-[96px] text-center text-sm font-bold text-neutral-300">Page {page} of {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage(value => Math.min(pageCount, value + 1))} className="rounded-lg border border-neutral-700 p-2 text-neutral-300 hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button></div></div>
    </section>}

    {selected ? <MembershipDrawer record={selected} onClose={() => setSelected(null)} /> : null}
  </main>;
}
