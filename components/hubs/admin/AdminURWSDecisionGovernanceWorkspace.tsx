'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { authenticatedFetch } from '@/lib/client/authenticatedFetch';

type Row = Record<string, any>;
type Payload = {
  cases: Row[];
  decisions: Row[];
  proposals: Row[];
  approvals: Row[];
  canFinancialDecision: boolean;
  error?: string;
};

type ProposalDraft = {
  human_outcome: 'approved' | 'declined' | 'escalated' | 'partial' | 'no_action';
  rationale: string;
  financial_impact: string;
  currency: string;
};

const empty: Payload = { cases: [], decisions: [], proposals: [], approvals: [], canFinancialDecision: false };
const emptyProposal: ProposalDraft = { human_outcome: 'declined', rationale: '', financial_impact: '', currency: 'CAD' };
const money = (value: unknown, currency = 'CAD') => new Intl.NumberFormat('en-CA', { style: 'currency', currency: currency || 'CAD' }).format(Number.isFinite(Number(value)) ? Number(value) : 0);
const when = (value: unknown) => value ? new Date(String(value)).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function Status({ value }: { value: unknown }) {
  const status = String(value || 'unknown').replaceAll('_', ' ');
  return <span className="rounded-full border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-neutral-200">{status}</span>;
}

export function AdminURWSDecisionGovernanceWorkspace() {
  const [data, setData] = useState<Payload>(empty);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [approvalNote, setApprovalNote] = useState('');
  const [proposalDraft, setProposalDraft] = useState<ProposalDraft>(emptyProposal);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await authenticatedFetch('/api/admin-urws', { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to load governed URWS decisions.');
      const next: Payload = { ...empty, ...json };
      setData(next);
      setSelectedCaseId(current => current && next.cases.some(c => c.id === current) ? current : (next.cases[0]?.id || ''));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load governed URWS decisions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selectedCase = useMemo(() => data.cases.find(c => c.id === selectedCaseId) || null, [data.cases, selectedCaseId]);
  const proposals = useMemo(() => data.proposals.filter(p => p.case_id === selectedCaseId), [data.proposals, selectedCaseId]);
  const decisions = useMemo(() => data.decisions.filter(d => d.case_id === selectedCaseId), [data.decisions, selectedCaseId]);
  const latestProposal = proposals[0] || null;
  const approvals = useMemo(() => latestProposal ? data.approvals.filter(a => a.proposal_id === latestProposal.id) : [], [data.approvals, latestProposal]);
  const latestProposalIsActive = !!latestProposal && ['pending_second_approval', 'ready'].includes(String(latestProposal.status));
  const canCreateProposal = data.canFinancialDecision && !latestProposalIsActive;

  useEffect(() => {
    setProposalDraft({
      human_outcome: 'declined',
      rationale: '',
      financial_impact: selectedCase?.financial_impact == null ? '' : String(selectedCase.financial_impact),
      currency: String(selectedCase?.currency || 'CAD'),
    });
    setApprovalNote('');
  }, [selectedCase?.id, selectedCase?.financial_impact, selectedCase?.currency]);

  async function act(body: Row, successMessage: string) {
    setWorking(true);
    setError('');
    setNotice('');
    try {
      const response = await authenticatedFetch('/api/admin-urws', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Governed URWS decision action failed.');
      setNotice(successMessage);
      setApprovalNote('');
      await load();
      return json;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Governed URWS decision action failed.');
      return null;
    } finally {
      setWorking(false);
    }
  }

  async function propose() {
    if (!selectedCase) return;
    if (proposalDraft.rationale.trim().length < 8) {
      setError('Decision rationale must be at least 8 characters.');
      return;
    }
    const result = await act({
      action: 'propose-decision',
      case_id: selectedCase.id,
      human_outcome: proposalDraft.human_outcome,
      rationale: proposalDraft.rationale.trim(),
      financial_impact: proposalDraft.financial_impact === '' ? null : Number(proposalDraft.financial_impact),
      currency: proposalDraft.currency || 'CAD',
    }, 'Governed decision proposal recorded. Authority rules determine whether a second approval is required.');
    if (result) setProposalDraft(current => ({ ...current, rationale: '' }));
  }

  return (
    <main className="min-h-full bg-[#060707] p-5 text-white lg:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[.16em] text-[#FA4616]"><ShieldCheck className="h-5 w-5" />URWS Decision Governance</div>
          <h1 className="mt-2 text-3xl font-black">Proposal → second approval → immutable decision</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-neutral-300">Consequential decisions cannot skip the governed proposal path. Authority rules decide whether a second authorized person is required, and the proposer cannot approve their own proposal.</p>
        </div>
        <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 px-4 py-3 text-sm font-black"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
      </div>

      {error && <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-100">{error}</div>}
      {notice && <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-100">{notice}</div>}

      <div className="mt-6 grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-2xl border border-neutral-800 bg-[#0b0d0d]">
          <div className="border-b border-neutral-800 p-4"><div className="font-black">Canonical cases</div><div className="mt-1 text-sm text-neutral-500">{data.cases.length} tracked</div></div>
          <div className="divide-y divide-neutral-800">
            {data.cases.map(c => <button key={c.id} onClick={() => setSelectedCaseId(c.id)} className={`w-full p-4 text-left hover:bg-neutral-900 ${selectedCaseId === c.id ? 'bg-[#FA4616]/10' : ''}`}><div className="font-black">{c.public_summary || c.case_type_code}</div><div className="mt-1 text-xs text-neutral-500">{String(c.status || 'open').replaceAll('_', ' ')} · {money(c.financial_impact, c.currency)}</div></button>)}
            {!loading && !data.cases.length && <div className="p-6 text-sm text-neutral-500">No URWS cases exist. LS1 will not invent one.</div>}
          </div>
        </aside>

        <section className="space-y-5">
          {selectedCase ? <>
            <section className="rounded-2xl border border-neutral-800 bg-[#0b0d0d] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-wide text-neutral-500">Selected case</div><h2 className="mt-2 text-xl font-black">{selectedCase.public_summary || selectedCase.case_type_code}</h2><div className="mt-2 text-sm text-neutral-400">{String(selectedCase.case_type_code || '').replaceAll('_', ' ')} · opened {when(selectedCase.opened_at)}</div></div><Status value={selectedCase.status} /></div>
            </section>

            {canCreateProposal && <section className="rounded-2xl border border-[#FA4616]/30 bg-[#100c0a] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-black">Create governed proposal</h3><p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-400">Record the proposed human outcome and rationale here. The database resolves the matching authority rule and decides whether independent second approval is required.</p></div><div className="text-xs font-black uppercase tracking-wide text-[#FA4616]">Authority-gated</div></div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-bold">Proposed outcome<select value={proposalDraft.human_outcome} onChange={e => setProposalDraft(current => ({ ...current, human_outcome: e.target.value as ProposalDraft['human_outcome'] }))} className="mt-2 w-full rounded-xl border border-neutral-700 bg-black p-3"><option value="approved">Approved</option><option value="declined">Declined</option><option value="escalated">Escalated</option><option value="partial">Partial</option><option value="no_action">No action</option></select></label>
                <label className="text-sm font-bold">Financial impact<input value={proposalDraft.financial_impact} onChange={e => setProposalDraft(current => ({ ...current, financial_impact: e.target.value }))} inputMode="decimal" placeholder="0.00" className="mt-2 w-full rounded-xl border border-neutral-700 bg-black p-3" /></label>
                <label className="text-sm font-bold">Currency<input value={proposalDraft.currency} onChange={e => setProposalDraft(current => ({ ...current, currency: e.target.value.toUpperCase().slice(0, 3) }))} maxLength={3} className="mt-2 w-full rounded-xl border border-neutral-700 bg-black p-3 uppercase" /></label>
                <div className="hidden md:block" />
                <label className="text-sm font-bold md:col-span-2">Decision rationale<textarea value={proposalDraft.rationale} onChange={e => setProposalDraft(current => ({ ...current, rationale: e.target.value }))} placeholder="State the evidence-based reason for this proposed outcome…" className="mt-2 min-h-28 w-full rounded-xl border border-neutral-700 bg-black p-3" /><div className="mt-1 text-xs text-neutral-500">Minimum 8 characters. Do not place restricted medical or safeguarding detail in this standard rationale.</div></label>
              </div>
              <div className="mt-4 flex justify-end"><button disabled={working || proposalDraft.rationale.trim().length < 8} onClick={() => void propose()} className="rounded-xl bg-[#FA4616] px-5 py-3 text-sm font-black text-black disabled:opacity-40">Propose governed decision</button></div>
            </section>}

            {latestProposalIsActive && <section className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400">An active governed proposal already exists for this case. Resolve or execute it before creating another proposal.</section>}

            <section className="rounded-2xl border border-neutral-800 bg-[#0b0d0d] p-5">
              <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-black">Latest proposal</h3>{latestProposal && <Status value={latestProposal.status} />}</div>
              {!latestProposal && <p className="mt-3 text-sm text-neutral-500">No governed decision proposal exists for this case yet. Use the proposal form above to start the governed decision path.</p>}
              {latestProposal && <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-neutral-800 p-4"><div className="flex flex-wrap justify-between gap-3"><div><div className="font-black">{String(latestProposal.human_outcome || '').replaceAll('_', ' ')}</div><div className="mt-1 text-xs text-neutral-500">Proposed {when(latestProposal.proposed_at)} · {money(latestProposal.financial_impact, latestProposal.currency)}</div></div><div className="text-xs font-black uppercase text-neutral-500">{latestProposal.required_second_approval ? 'Second approval required' : 'Single-authority path'}</div></div><p className="mt-3 text-sm leading-6 text-neutral-300">{latestProposal.rationale}</p></div>

                {latestProposal.status === 'pending_second_approval' && data.canFinancialDecision && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"><div className="font-black text-amber-100">Second approval required</div><p className="mt-1 text-sm text-amber-100/80">The database rejects self-approval. A different authorized person must approve or reject this proposal.</p><textarea value={approvalNote} onChange={e => setApprovalNote(e.target.value)} placeholder="Second-approver note" className="mt-3 min-h-20 w-full rounded-lg border border-neutral-700 bg-black p-3 text-sm" /><div className="mt-3 flex flex-wrap gap-2"><button disabled={working} onClick={() => void act({ action: 'approve-proposal', proposal_id: latestProposal.id, decision: 'approve', note: approvalNote }, 'Second approval recorded. Proposal is ready for authorized execution.')} className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-black text-emerald-100"><CheckCircle2 className="h-4 w-4" />Approve</button><button disabled={working} onClick={() => void act({ action: 'approve-proposal', proposal_id: latestProposal.id, decision: 'reject', note: approvalNote }, 'Decision proposal rejected.')} className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-red-100"><XCircle className="h-4 w-4" />Reject</button></div></div>}

                {latestProposal.status === 'ready' && data.canFinancialDecision && <button disabled={working} onClick={() => void act({ action: 'execute-proposal', proposal_id: latestProposal.id }, 'Authorized decision executed and written to the immutable URWS decision ledger.')} className="rounded-lg bg-[#FA4616] px-4 py-3 text-sm font-black text-black disabled:opacity-40">Execute authorized decision</button>}

                {!!approvals.length && <div className="rounded-xl border border-neutral-800 p-4"><div className="text-xs font-black uppercase tracking-wide text-neutral-500">Approval ledger</div><div className="mt-3 space-y-2">{approvals.map(a => <div key={a.id} className="flex flex-wrap justify-between gap-3 border-b border-neutral-800 pb-2 text-sm last:border-b-0"><span>{String(a.decision).replaceAll('_', ' ')}</span><span className="text-neutral-500">{when(a.decided_at)}</span></div>)}</div></div>}
              </div>}
            </section>

            <section className="rounded-2xl border border-neutral-800 bg-[#0b0d0d] p-5"><h3 className="text-lg font-black">Immutable decisions</h3><div className="mt-4 space-y-3">{decisions.map(d => <div key={d.id} className="rounded-xl border border-neutral-800 p-4"><div className="flex flex-wrap justify-between gap-3"><div className="font-black">{String(d.human_outcome || d.policy_outcome || 'decision').replaceAll('_', ' ')}</div><span className="text-xs text-neutral-500">{when(d.decided_at)}</span></div><p className="mt-2 text-sm text-neutral-400">{d.rationale || 'No rationale shown.'}</p></div>)}{!decisions.length && <div className="text-sm text-neutral-500">No executed decision exists for this case.</div>}</div></section>
          </> : <section className="rounded-2xl border border-neutral-800 bg-[#0b0d0d] p-10 text-center text-neutral-500">Select a URWS case.</section>}
        </section>
      </div>
    </main>
  );
}

export default AdminURWSDecisionGovernanceWorkspace;
