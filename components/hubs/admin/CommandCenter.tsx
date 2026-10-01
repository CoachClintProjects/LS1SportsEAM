"use client";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import "./admin-home.css";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
const PersonRecordDrawer = dynamic(() => import("./PersonRecordDrawer"));

import { CalendarDays, Settings } from "lucide-react";
import { CompetitionHomeDrawer } from "./CompetitionHomeDrawer";
const GovernanceRecordDrawer = dynamic(() =>
  import("./GovernanceWorkspace").then((m) => m.GovernanceRecordDrawer),
);
type Row = Record<string, any>;
type Task = {
  key: string;
  category: string;
  title: string;
  instruction: string;
  count: number;
  rows: Row[];
};
export function CommandCenter({
  role = "org_admin",
  roleLabel,
}: {
  role?: string;
  roleLabel?: string;
}) {
  const router = useRouter();
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [selected, setSelected] = useState<Task | null>(null),
    [birthDates, setBirthDates] = useState<Record<string, string>>({}),
    [taskTab, setTaskTab] = useState<"open" | "completed">("open"),
    [newTask, setNewTask] = useState(false),
    [taskTitle, setTaskTitle] = useState(""),
    [taskDescription, setTaskDescription] = useState(""),
    [newEvent, setNewEvent] = useState(false),
    [eventName, setEventName] = useState(""),
    [eventStart, setEventStart] = useState(""),
    [eventEnd, setEventEnd] = useState(""),
    [selectedEvent, setSelectedEvent] = useState<Row | null>(null),
    [eventTimezone, setEventTimezone] = useState(""),
    [customize, setCustomize] = useState(false),
    [selectedActivity, setSelectedActivity] = useState<Row | null>(null);
  const [governanceId, setGovernanceId] = useState<string | null>(null);
  const [recordPersonId, setRecordPersonId] = useState<string | null>(null);
  const [competitionData, setCompetitionData] = useState<any>(null),
    [openingCompetition, setOpeningCompetition] = useState(false);
  const requestVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setError("");
    const r = await authenticatedFetch(
      `/api/admin-command?role=${encodeURIComponent(role)}&section=home`,
      { cache: "no-store" },
    );
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    if (version === requestVersion.current) setData(j);
  }, [role]);
  useEffect(() => {
    setData(null);
    setSelected(null);
    setSelectedEvent(null);
    load().catch((e) => setError(e.message));
    return () => {
      requestVersion.current++;
    };
  }, [load]);
  const pref = (key: string) => {
    const p = (data?.homePreferences || []).find(
      (x: Row) => x.preference_key === key,
    );
    return p?.preference_value?.enabled !== false;
  };
  const setPref = async (key: string, value: boolean) => {
    setSaving(true);
    setError("");
    try {
      const r = await authenticatedFetch("/api/admin-command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update-home-preference",
            role,
            key,
            value,
          }),
        }),
        j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preference update failed.");
    } finally {
      setSaving(false);
    }
  };
  const canonicalTimezones = useMemo(
    () => [
      ...new Set(
        [
          ...(data?.orgAdmin?.sites || []).map((s: Row) =>
            String(s.timezone || "").trim(),
          ),
          ...(data?.controls?.competitions || []).map((c: Row) =>
            String(c.timezone || "").trim(),
          ),
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        ].filter(Boolean),
      ),
    ],
    [data],
  );
  const people = useMemo(
    () =>
      new Map<string, Row>(
        (data?.people || data?.orgAdmin?.people || []).map((p: Row) => [
          p.id,
          p,
        ]),
      ),
    [data],
  );
  const tasks = useMemo<Task[]>(() => {
    if (!data) return [];
    const out: Task[] = [];
    const dq = data.controls?.dataQualityIssues || [],
      dupes = data.controls?.duplicateCandidates || [],
      work = (data.tasks || []).filter(
        (r: Row) => !["completed", "cancelled"].includes(r.status),
      ),
      now = Date.now();
    const overdue = (data.invoices || []).filter(
      (r: Row) =>
        r.due_date &&
        Number(r.balance_due) > 0 &&
        new Date(r.due_date).getTime() < now,
    );
    const horizon = now + 30 * 24 * 60 * 60 * 1000;
    const deadlines = (data.controls?.deadlines || []).filter(
      (r: Row) =>
        r.due_at &&
        new Date(r.due_at).getTime() <= horizon &&
        String(r.status || "").toLowerCase() !== "completed",
    );
    const expiringCompliance = [
      ...(data.controls?.credentials || []),
      ...(data.controls?.backgroundChecks || []),
      ...(data.controls?.safeSport || []),
    ].filter(
      (r: Row) => r.expires_on && new Date(r.expires_on).getTime() <= horizon,
    );
    const expiringContracts = (data.enterprise?.contracts || []).filter(
      (r: Row) => r.expires_on && new Date(r.expires_on).getTime() <= horizon,
    );
    const vendorInsurance = (data.enterprise?.vendors || []).filter(
      (r: Row) =>
        r.insurance_expires_on &&
        new Date(r.insurance_expires_on).getTime() <= horizon,
    );
    if (deadlines.length)
      out.push({
        key: "competition-deadlines",
        category: "COMPETITION",
        title: `${deadlines.length} competition deadline${deadlines.length === 1 ? "" : "s"} overdue or due within 30 days`,
        instruction:
          "Open the competition deadline records and complete the required operational action before the canonical due date.",
        count: deadlines.length,
        rows: deadlines,
      });
    if (expiringCompliance.length)
      out.push({
        key: "compliance-expiry",
        category: "COMPLIANCE",
        title: `${expiringCompliance.length} compliance record${expiringCompliance.length === 1 ? "" : "s"} expired or expiring within 30 days`,
        instruction:
          "Open the affected compliance records and remediate or renew before eligibility is affected.",
        count: expiringCompliance.length,
        rows: expiringCompliance,
      });
    if (expiringContracts.length)
      out.push({
        key: "contract-expiry",
        category: "CONTRACTS",
        title: `${expiringContracts.length} contract${expiringContracts.length === 1 ? "" : "s"} expired or expiring within 30 days`,
        instruction:
          "Review the contract lifecycle and record the authorized renewal, replacement or closure action.",
        count: expiringContracts.length,
        rows: expiringContracts,
      });
    if (vendorInsurance.length)
      out.push({
        key: "vendor-insurance",
        category: "VENDOR RISK",
        title: `${vendorInsurance.length} vendor insurance record${vendorInsurance.length === 1 ? "" : "s"} expired or expiring within 30 days`,
        instruction:
          "Open the vendor record and renew or remediate insurance evidence before expiry.",
        count: vendorInsurance.length,
        rows: vendorInsurance,
      });
    if (dq.length)
      out.push({
        key: "quality",
        category: "RISK / DATA INTEGRITY",
        title: `${dq.length} person records require data correction`,
        instruction:
          "Open the affected people, enter the missing canonical information, and save each corrected record. Resolved source conditions will clear from this queue after reconciliation.",
        count: dq.length,
        rows: dq,
      });
    if (dupes.length)
      out.push({
        key: "duplicates",
        category: "WORKFORCE / RECORD INTEGRITY",
        title: `${dupes.length} potential duplicate people require review`,
        instruction:
          "Open the duplicate review queue and compare the linked person records before resolving the canonical identity.",
        count: dupes.length,
        rows: dupes,
      });
    const approvals = (data.approvals || []).filter(
        (r: Row) => !r.status || r.status === "pending",
      ),
      workflow = (data.workflowTasks || []).filter(
        (r: Row) => !["completed", "cancelled"].includes(r.status),
      );
    if (approvals.length)
      out.push({
        key: "approvals",
        category: "APPROVALS",
        title: `${approvals.length} approval${approvals.length === 1 ? "" : "s"} require a decision`,
        instruction:
          "Review the canonical approval request and record the authorized decision.",
        count: approvals.length,
        rows: approvals,
      });
    if (workflow.length)
      out.push({
        key: "workflow",
        category: "WORKFLOW",
        title: `${workflow.length} workflow task${workflow.length === 1 ? "" : "s"} require execution`,
        instruction: "Complete the assigned canonical workflow task.",
        count: workflow.length,
        rows: workflow,
      });
    if (overdue.length)
      out.push({
        key: "finance",
        category: "FINANCIAL MANAGEMENT",
        title: `${overdue.length} past-due invoice${overdue.length === 1 ? "" : "s"} require action`,
        instruction:
          "Open the receivable records, verify the balance and due date, then execute the appropriate financial lifecycle action.",
        count: overdue.length,
        rows: overdue,
      });
    work.forEach((r: Row) =>
      out.push({
        key: `work-${r.id}`,
        category: "ASSIGNED WORK ITEM",
        title: r.payload?.title || "Organization work item",
        instruction:
          r.payload?.description ||
          "Open and complete the assigned organization action.",
        count: 1,
        rows: [r],
      }),
    );
    const vacancies = (data.volunteerData?.opportunities || []).filter(
      (o: Row) =>
        String(o.status).toLowerCase() === "open" &&
        Number(o.capacity) >
          (data.volunteerData?.assignments || []).filter(
            (a: Row) =>
              a.opportunity_id === o.id &&
              !["cancelled", "declined"].includes(a.status),
          ).length,
    );
    if (vacancies.length)
      out.push({
        key: "volunteer-vacancies",
        category: "VOLUNTEER STAFFING",
        title: `${vacancies.length} volunteer opportunities below capacity`,
        instruction:
          "Review the open opportunities and their staffing assignments.",
        count: vacancies.length,
        rows: vacancies,
      });
    const drafts = (data.communicationData?.campaigns || []).filter(
      (c: Row) => c.status === "draft",
    );
    if (drafts.length)
      out.push({
        key: "communication-drafts",
        category: "COMMUNICATIONS",
        title: `${drafts.length} draft campaigns awaiting review`,
        instruction:
          "Review campaign audience, content and scheduling before advancing its status.",
        count: drafts.length,
        rows: drafts,
      });
    const prospects = (data.fundraisingData?.commitments || []).filter(
      (c: Row) => c.status === "prospect",
    );
    if (prospects.length)
      out.push({
        key: "fundraising-prospects",
        category: "FUNDRAISING",
        title: `${prospects.length} prospective commitments to follow up`,
        instruction:
          "Review the campaign and recorded commitment with the prospective contributor.",
        count: prospects.length,
        rows: prospects,
      });
    const pendingRegistrations = data.registrar?.registrations || [];
    if (pendingRegistrations.length)
      out.push({
        key: "registration-review",
        category: "REGISTRATION",
        title: `${pendingRegistrations.length} registrations awaiting review`,
        instruction:
          "Open the athlete record, review its evidence and required checks, then record a decision.",
        count: pendingRegistrations.length,
        rows: pendingRegistrations,
      });
    const governance = (data.governanceTasks || []).filter(
      (w: Row) =>
        w.payload?.record_status !== "active" ||
        (w.payload?.due_on && Date.parse(w.payload.due_on) <= horizon),
    );
    if (governance.length)
      out.push({
        key: "governance",
        category: "GOVERNANCE & RISK",
        title: `${governance.length} governance records need attention`,
        instruction:
          "Review the source record and complete its authorized decision or follow-up.",
        count: governance.length,
        rows: governance,
      });
    if (data.budgetTasks?.length)
      out.push({
        key: "budget-review",
        category: "BUDGET AUTHORITY",
        title: `${data.budgetTasks.length} budgets need preparation or approval`,
        instruction:
          "Open the budget to prepare allocations or record the authorized decision.",
        count: data.budgetTasks.length,
        rows: data.budgetTasks,
      });
    const byRole: Record<string, string[]> = {
      team_manager: [
        "competition-deadlines",
        "contract-expiry",
        "vendor-insurance",
      ],
      registrar: [
        "quality",
        "duplicates",
        "compliance-expiry",
        "registration-review",
      ],
      competition_manager: ["competition-deadlines"],
      treasurer: ["finance", "budget-review"],
      volunteer_coordinator: ["volunteer-vacancies"],
      communications_media: ["communication-drafts"],
      fundraising_coordinator: ["fundraising-prospects"],
      facilities_equipment_manager: ["contract-expiry", "vendor-insurance"],
    };
    return role === "org_admin"
      ? out
      : out.filter(
          (task) =>
            task.key.startsWith("work-") ||
            (byRole[role] || []).includes(task.key),
        );
  }, [data, role]);
  async function decideApproval(id: string, decision: "approved" | "rejected") {
    setSaving(true);
    setError("");
    try {
      const r = await authenticatedFetch("/api/admin-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decide-approval", id, decision, role }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setSelected(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval failed.");
    } finally {
      setSaving(false);
    }
  }
  async function completeWorkflowTask(id: string) {
    setSaving(true);
    setError("");
    try {
      const r = await authenticatedFetch("/api/admin-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete-workflow-task", id, role }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setSelected(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Workflow task failed.");
    } finally {
      setSaving(false);
    }
  }
  async function updateBirthDate(personId: string) {
    const birth_date = birthDates[personId];
    if (!birth_date) return;
    setSaving(true);
    setError("");
    try {
      const r = await authenticatedFetch("/api/admin-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-master-record",
          entity: "person",
          id: personId,
          changes: { birth_date },
          role,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }
  async function createTask() {
    const title = taskTitle.trim();
    if (!title) return;
    setSaving(true);
    setError("");
    try {
      const r = await authenticatedFetch("/api/admin-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-task",
          title,
          description: taskDescription.trim() || null,
          role,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setTaskTitle("");
      setTaskDescription("");
      setNewTask(false);
      setTaskTab("open");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Task creation failed.");
    } finally {
      setSaving(false);
    }
  }
  async function createEvent() {
    const name = eventName.trim();
    if (!name || !eventStart) return;
    setSaving(true);
    setError("");
    try {
      const r = await authenticatedFetch("/api/admin-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-event",
          name,
          startsAt: new Date(eventStart).toISOString(),
          endsAt: eventEnd ? new Date(eventEnd).toISOString() : null,
          timezone: eventTimezone || canonicalTimezones[0],
          role,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setEventName("");
      setEventStart("");
      setEventEnd("");
      setEventTimezone("");
      setNewEvent(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Event creation failed.");
    } finally {
      setSaving(false);
    }
  }
  async function updateEvent(id: string, changes: any) {
    setSaving(true);
    setError("");
    try {
      const r = await authenticatedFetch("/api/admin-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-event", id, changes, role }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setSelectedEvent(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Event update failed.");
    } finally {
      setSaving(false);
    }
  }
  async function complete(id: string) {
    setSaving(true);
    try {
      const r = await authenticatedFetch("/api/admin-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete-task", id, role }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await load();
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setSaving(false);
    }
  }
  if (!data) return <State text={error || "Loading organization work…"} />;
  const org =
    data.orgAdmin?.organizations?.[0] || data.controls?.organizations?.[0];
  return (
    <main className="org-admin-home">
      {governanceId && (
        <GovernanceRecordDrawer
          role={role}
          id={governanceId}
          onClose={() => setGovernanceId(null)}
          onSaved={() => {
            void load().catch((e) => setError(e.message));
          }}
        />
      )}
      {recordPersonId && (
        <PersonRecordDrawer
          personId={recordPersonId}
          role={role}
          initialTab="Registration"
          onClose={() => setRecordPersonId(null)}
          onSaved={() => {
            void load().catch((e) => setError(e.message));
          }}
        />
      )}
      {openingCompetition && (
        <p role="status" className="mb-3 text-blue-200">
          Opening competition…
        </p>
      )}
      <header className="relative pb-5">
        <div className="text-xs font-semibold text-neutral-500">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </div>
        <h1 className="mt-2 text-3xl font-black">
          Good {daypart()}, {data.viewer?.displayName || "there"}
        </h1>
        <div className="mt-2 text-xs text-neutral-500">
          {org?.name || "Organization context unavailable"} ·{" "}
          {roleLabel || role.replaceAll("_", " ")}
        </div>
        <button
          onClick={() => setCustomize(true)}
          aria-label="Customize home"
          title="Customize"
          className="absolute right-5 top-7 rounded-lg border border-neutral-700 p-2 text-neutral-400 hover:text-white lg:right-8"
        >
          <Settings className="h-4 w-4" />
        </button>
      </header>
      {error && (
        <div className="mb-4 rounded-lg border border-red-900 p-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {newTask && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setNewTask(false);
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-neutral-700 bg-[#0b0d0d] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">New Task</h2>
              <button
                onClick={() => setNewTask(false)}
                className="text-neutral-400"
              >
                Close
              </button>
            </div>
            <label className="mt-5 block text-xs text-neutral-400">
              Task
              <input
                autoFocus
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-neutral-700 bg-black px-3 py-2 text-white"
              />
            </label>
            <label className="mt-4 block text-xs text-neutral-400">
              Notes
              <textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-lg border border-neutral-700 bg-black px-3 py-2 text-white"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setNewTask(false)}
                className="rounded-lg border border-neutral-700 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                disabled={saving || !taskTitle.trim()}
                onClick={createTask}
                className="rounded-lg bg-[#FA4616] px-4 py-2 text-sm font-black text-black disabled:opacity-30"
              >
                Create task
              </button>
            </div>
          </div>
        </div>
      )}
      {pref("show_calendar") && (
        <Meetings
          events={[
            ...(data.calendarEvents || []),
            ...(data.controls?.competitions || []).map((x: Row) => ({
              ...x,
              title: x.name,
              event_type: "competition",
            })),
          ]}
          readiness={data.competitionReadiness || []}
          onNew={() => setNewEvent(true)}
          canCreate={Boolean(data.authorization?.events)}
          onOpen={async (event) => {
            if (event.event_type === "competition") {
              setOpeningCompetition(true);
              try {
                const r = await authenticatedFetch(
                  `/api/admin-command?role=${encodeURIComponent(role)}`,
                  { cache: "no-store" },
                );
                const j = await r.json();
                if (!r.ok) throw new Error(j.error);
                setCompetitionData(j);
                setSelectedEvent(event);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Competition unavailable",
                );
              } finally {
                setOpeningCompetition(false);
              }
            } else setSelectedEvent(event);
          }}
        />
      )}
      <section className="mt-8">
        <div className="mb-2 flex items-center justify-between border-b border-[#d8dde4] pb-2">
          <h2 className="text-sm font-bold">
            Today’s tasks · {roleLabel || role.replaceAll("_", " ")}
          </h2>
          {data.authorization?.createTask && (
            <button
              onClick={() => setNewTask(true)}
              className="rounded bg-orange-600 px-3 py-1 text-xs font-semibold text-white"
            >
              + Task
            </button>
          )}
        </div>
        <div className="mb-3 flex gap-4 text-xs">
          <button
            onClick={() => setTaskTab("open")}
            className={
              taskTab === "open" ? "font-bold text-[#145b91]" : "text-[#627188]"
            }
          >
            Open ({tasks.length})
          </button>
          <button
            onClick={() => setTaskTab("completed")}
            className={
              taskTab === "completed"
                ? "font-bold text-[#145b91]"
                : "text-[#627188]"
            }
          >
            Completed (
            {
              (data.tasks || []).filter((r: Row) => r.status === "completed")
                .length
            }
            )
          </button>
        </div>
        <div className="rounded-md border border-[#d8dde4] bg-white">
          {taskTab === "open" ? (
            tasks.length ? (
              tasks.map((task) => (
                <button
                  key={task.key}
                  onClick={() => setSelected(task)}
                  className="flex w-full items-center justify-between gap-4 border-b border-[#e5e8ec] px-4 py-3 text-left last:border-0 hover:bg-[#f3f7fb]"
                >
                  <span>
                    <span className="block text-xs font-semibold text-[#627188]">
                      {task.category}
                    </span>
                    <strong className="mt-1 block text-sm">{task.title}</strong>
                  </span>
                  <span className="shrink-0 text-xs text-[#145b91]">
                    Review →
                  </span>
                </button>
              ))
            ) : (
              <p className="p-5 text-sm text-[#627188]">
                No open tasks or exceptions are recorded.
              </p>
            )
          ) : (data.tasks || []).filter((r: Row) => r.status === "completed")
              .length ? (
            (data.tasks || [])
              .filter((r: Row) => r.status === "completed")
              .map((r: Row) => (
                <div
                  key={r.id}
                  className="border-b border-[#e5e8ec] px-4 py-3 text-sm last:border-0"
                >
                  {r.payload?.title || "Organization work item"}
                </div>
              ))
          ) : (
            <p className="p-5 text-sm text-[#627188]">
              No completed tasks are recorded.
            </p>
          )}
        </div>
      </section>
      {pref("show_activity") && (
        <section className="mt-8">
          <div className="mb-2 border-b border-neutral-800 pb-2 text-sm font-black">
            Activity Feed
          </div>
          <div className="rounded-xl border border-neutral-800 bg-[#090b0b] p-5">
            {(data.orgAdmin?.audit || []).slice(0, 8).map((a: Row) => (
              <button
                key={a.id}
                onClick={() => setSelectedActivity(a)}
                className="block w-full border-b border-neutral-800 py-3 text-left last:border-0 hover:bg-white/[.03]"
              >
                <div className="text-sm font-bold">
                  {humanAction(a.action, a.entity_type)}
                </div>
                <div className="mt-1 text-xs text-neutral-600">
                  {new Date(a.occurred_at).toLocaleString()}
                </div>
              </button>
            ))}
            {!data.orgAdmin?.audit?.length && (
              <div className="text-sm text-neutral-500">
                No recent activity.
              </div>
            )}
          </div>
        </section>
      )}
      {selectedActivity && (
        <div
          className="fixed inset-0 z-[135] bg-black/70"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedActivity(null);
          }}
        >
          <aside className="ml-auto h-full w-full max-w-xl overflow-y-auto border-l border-neutral-700 bg-[#080909] p-6">
            <button onClick={() => setSelectedActivity(null)}>Close</button>
            <div className="mt-5 text-[9px] font-black uppercase text-[#FA4616]">
              Audit evidence
            </div>
            <h2 className="mt-1 text-xl font-black">
              {humanAction(
                selectedActivity.action,
                selectedActivity.entity_type,
              )}
            </h2>
            <div className="mt-2 text-xs text-neutral-500">
              {selectedActivity.entity_type} · {selectedActivity.entity_id}
            </div>
            <div className="mt-5 grid gap-4">
              <pre className="overflow-auto rounded border border-neutral-800 p-3 text-xs">
                {JSON.stringify(selectedActivity.before_data, null, 2)}
              </pre>
              <pre className="overflow-auto rounded border border-neutral-800 p-3 text-xs">
                {JSON.stringify(selectedActivity.after_data, null, 2)}
              </pre>
            </div>
          </aside>
        </div>
      )}{" "}
      {customize && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCustomize(false);
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-neutral-700 bg-[#0b0d0d] p-5">
            <div className="flex justify-between">
              <h2 className="text-lg font-black">Customize Home</h2>
              <button onClick={() => setCustomize(false)}>Close</button>
            </div>
            {[
              ["show_calendar", "Meetings & calendar"],
              ["show_activity", "Activity feed"],
            ].map(([key, label]) => (
              <label
                key={key}
                className="mt-4 flex items-center justify-between rounded border border-neutral-800 p-3 text-sm"
              >
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={pref(key)}
                  disabled={saving}
                  onChange={(e) => setPref(key, e.target.checked)}
                />
              </label>
            ))}
          </div>
        </div>
      )}
      {selectedEvent &&
        (selectedEvent.event_type === "competition" ? (
          <CompetitionHomeDrawer
            item={selectedEvent}
            data={competitionData || data}
            role={role}
            onClose={() => setSelectedEvent(null)}
            onChanged={async () => {
              await load();
              const r = await authenticatedFetch(
                `/api/admin-command?role=${encodeURIComponent(role)}`,
                { cache: "no-store" },
              );
              const j = await r.json();
              if (!r.ok) throw new Error(j.error);
              setCompetitionData(j);
            }}
          />
        ) : (
          <div
            className="fixed inset-0 z-[125] bg-black/40"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setSelectedEvent(null);
            }}
          >
            <aside className="ml-auto h-full w-full max-w-xl overflow-y-auto border-l border-neutral-700 bg-[#242529] p-6 text-neutral-100">
              <button
                onClick={() => setSelectedEvent(null)}
                className="float-right rounded border border-[#cbd3dd] px-3 py-1 text-sm"
              >
                Close
              </button>
              <div className="text-xs font-semibold text-neutral-400">
                {selectedEvent.event_type || "Event"}
              </div>
              <h2 className="mt-2 text-2xl font-bold">
                {selectedEvent.title || selectedEvent.name}
              </h2>
              <p className="mt-3 text-sm text-neutral-300">
                {selectedEvent.starts_at
                  ? new Date(selectedEvent.starts_at).toLocaleString()
                  : "Date not recorded"}
                {selectedEvent.ends_at
                  ? ` → ${new Date(selectedEvent.ends_at).toLocaleString()}`
                  : ""}
              </p>
              <div className="mt-6 flex gap-2">
                <button
                  disabled={saving}
                  onClick={() =>
                    updateEvent(selectedEvent.id, { status: "cancelled" })
                  }
                  className="rounded border border-red-300 px-3 py-2 text-sm text-red-700"
                >
                  Cancel event
                </button>
                {selectedEvent.status === "cancelled" && (
                  <button
                    disabled={saving}
                    onClick={() =>
                      updateEvent(selectedEvent.id, { status: "scheduled" })
                    }
                    className="rounded bg-[#145b91] px-3 py-2 text-sm font-semibold text-white"
                  >
                    Restore event
                  </button>
                )}
              </div>
            </aside>
          </div>
        ))}
      {newEvent && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setNewEvent(false);
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-neutral-700 bg-[#0b0d0d] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">Create Event</h2>
              <button
                onClick={() => setNewEvent(false)}
                className="text-neutral-400"
              >
                Close
              </button>
            </div>
            <label className="mt-5 block text-xs text-neutral-400">
              Event name
              <input
                autoFocus
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-neutral-700 bg-black px-3 py-2 text-white"
              />
            </label>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-xs text-neutral-400">
                Starts
                <input
                  type="datetime-local"
                  value={eventStart}
                  onChange={(e) => setEventStart(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-neutral-700 bg-black px-3 py-2 text-white"
                />
              </label>
              <label className="text-xs text-neutral-400">
                Ends
                <input
                  type="datetime-local"
                  value={eventEnd}
                  onChange={(e) => setEventEnd(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-neutral-700 bg-black px-3 py-2 text-white"
                />
              </label>
            </div>
            <label className="mt-4 block text-xs text-neutral-400">
              Timezone
              <select
                value={eventTimezone || canonicalTimezones[0] || ""}
                onChange={(e) => setEventTimezone(e.target.value)}
                className="mt-1 block w-full rounded border border-[#cbd4df] bg-white px-3 py-2 text-[#17263c]"
              >
                {canonicalTimezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setNewEvent(false)}
                className="rounded-lg border border-neutral-700 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                disabled={saving || !eventName.trim() || !eventStart}
                onClick={createEvent}
                className="rounded-lg bg-[#FA4616] px-4 py-2 text-sm font-black text-black disabled:opacity-30"
              >
                Create event
              </button>
            </div>
          </div>
        </div>
      )}
      {selected && (
        <div
          className="fixed inset-0 z-[100] bg-black/70"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <aside className="absolute right-0 top-0 h-full w-full max-w-4xl overflow-y-auto border-l border-neutral-700 bg-[#080909]">
            <header className="sticky top-0 z-10 border-b border-neutral-800 bg-[#080909] p-5">
              <button
                onClick={() => setSelected(null)}
                className="float-right rounded border border-neutral-700 px-3 py-1 text-xs"
              >
                Close
              </button>
              <div className="text-[10px] font-black uppercase tracking-[.16em] text-[#FA4616]">
                {selected.category}
              </div>
              <h2 className="mt-1 text-2xl font-black">{selected.title}</h2>
              <p className="mt-2 max-w-2xl text-sm text-neutral-400">
                {selected.instruction}
              </p>
            </header>
            <div className="p-5">
              {error && (
                <p role="alert" className="mb-4 text-red-300">
                  {error}
                </p>
              )}
              {selected.key === "budget-review" ? (
                <div className="space-y-3">
                  {selected.rows.map((r: Row) => (
                    <div
                      key={r.id}
                      className="rounded border border-neutral-600 p-4"
                    >
                      <h3 className="font-semibold">{r.payload?.title}</h3>
                      <p className="mt-1 text-sm text-neutral-400">
                        {r.payload?.budget_status}
                      </p>
                      <button
                        className="mt-3 rounded bg-blue-700 px-3 py-2 text-sm text-white"
                        onClick={() =>
                          router.push(
                            `/admin?${new URLSearchParams({ view: "budgets", role, record: r.entity_id })}`,
                          )
                        }
                      >
                        Open budget
                      </button>
                    </div>
                  ))}
                </div>
              ) : selected.key === "governance" ? (
                <div className="space-y-3">
                  {selected.rows.map((r: Row) => (
                    <div
                      key={r.id}
                      className="rounded border border-neutral-600 p-4"
                    >
                      <h3 className="font-semibold">{r.payload?.title}</h3>
                      <p className="mt-1 text-sm text-neutral-400">
                        {r.payload?.kind} · {r.payload?.record_status}{" "}
                        {r.payload?.due_on ? `· Due ${r.payload.due_on}` : ""}
                      </p>
                      <button
                        className="mt-3 rounded bg-blue-700 px-3 py-2 text-sm text-white"
                        onClick={() => {
                          setSelected(null);
                          setGovernanceId(r.entity_id);
                        }}
                      >
                        Open governance record
                      </button>
                    </div>
                  ))}
                </div>
              ) : selected.key === "registration-review" ? (
                <div className="space-y-3">
                  {selected.rows.map((r: Row) => (
                    <div
                      key={r.id}
                      className="rounded-xl border border-neutral-700 p-4"
                    >
                      <h3 className="font-semibold">{r.name}</h3>
                      <p className="mt-1 text-sm text-neutral-400">
                        {String(r.status).replaceAll("_", " ")}
                      </p>
                      {r.person_id && (
                        <button
                          onClick={() => {
                            setSelected(null);
                            setRecordPersonId(r.person_id);
                          }}
                          className="mt-3 rounded bg-blue-700 px-3 py-2 text-sm text-white"
                        >
                          Review athlete registration
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : selected.key === "quality" ? (
                <div className="space-y-3">
                  {selected.rows.map((r: Row) => {
                    const p = people.get(r.entity_id);
                    return (
                      <div
                        key={r.id}
                        className="rounded-xl border border-neutral-800 p-4"
                      >
                        <div className="grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end">
                          <div>
                            <div className="font-black">
                              {p
                                ? [
                                    p.preferred_name || p.first_name,
                                    p.last_name,
                                  ]
                                    .filter(Boolean)
                                    .join(" ")
                                : "Person record"}
                            </div>
                            <div className="mt-1 text-sm text-neutral-500">
                              {r.details?.message ||
                                "Canonical person data requires review."}
                            </div>
                            <div className="mt-1 text-xs text-neutral-700">
                              {p?.email || ""}
                            </div>
                          </div>
                          <label className="text-xs text-neutral-400">
                            Birth date
                            <input
                              type="date"
                              value={
                                birthDates[r.entity_id] ?? p?.birth_date ?? ""
                              }
                              onChange={(e) =>
                                setBirthDates((x) => ({
                                  ...x,
                                  [r.entity_id]: e.target.value,
                                }))
                              }
                              className="mt-1 block w-full rounded-lg border border-neutral-700 bg-black px-3 py-2 text-white"
                            />
                          </label>
                          <button
                            disabled={
                              saving ||
                              !(birthDates[r.entity_id] ?? p?.birth_date)
                            }
                            onClick={() => updateBirthDate(r.entity_id)}
                            className="rounded-lg bg-[#FA4616] px-4 py-2 text-xs font-black text-black disabled:opacity-30"
                          >
                            Save correction
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : selected.key === "approvals" ? (
                <div className="space-y-3">
                  {selected.rows.map((r: Row) => (
                    <div
                      key={r.id}
                      className="rounded-xl border border-neutral-800 p-4"
                    >
                      <div className="font-bold">
                        {r.approval_type || r.entity_type}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          disabled={saving}
                          onClick={() => decideApproval(r.id, "rejected")}
                          className="rounded bg-red-800 px-3 py-2 text-xs text-white"
                        >
                          Reject
                        </button>
                        <button
                          disabled={saving}
                          onClick={() => decideApproval(r.id, "approved")}
                          className="rounded bg-emerald-700 px-3 py-2 text-xs font-bold text-white"
                        >
                          Approve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : selected.key === "workflow" ? (
                <div className="space-y-3">
                  {selected.rows.map((r: Row) => (
                    <div
                      key={r.id}
                      className="rounded-xl border border-neutral-800 p-4"
                    >
                      <div className="font-bold">{r.task_code}</div>
                      <button
                        disabled={saving}
                        onClick={() => completeWorkflowTask(r.id)}
                        className="mt-3 rounded bg-[#FA4616] px-3 py-2 text-xs font-black text-black"
                      >
                        Complete workflow task
                      </button>
                    </div>
                  ))}
                </div>
              ) : selected.key.startsWith("work-") ? (
                <div className="rounded-xl border border-neutral-800 p-5">
                  <div className="font-black">{selected.title}</div>
                  <p className="mt-2 text-sm text-neutral-400">
                    {selected.instruction}
                  </p>
                  {data.authorization?.updateTask && (
                    <button
                      disabled={saving}
                      onClick={() => complete(selected.rows[0].id)}
                      className="mt-5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white"
                    >
                      Complete task
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {selected.rows.map((r: Row) => (
                    <div
                      key={r.id}
                      className="rounded-xl border border-neutral-800 p-4"
                    >
                      <div className="font-bold">
                        {r.title ||
                          r.name ||
                          r.counterparty_name ||
                          r.invoice_number ||
                          r.entity_type ||
                          "Canonical record"}
                      </div>
                      <div className="mt-1 text-sm text-neutral-500">
                        {r.match_reason || r.status || ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
function Meetings({
  events,
  readiness,
  onNew,
  canCreate,
  onOpen,
}: {
  events: Row[];
  readiness: Row[];
  onNew: () => void;
  canCreate: boolean;
  onOpen: (r: Row) => void;
}) {
  const now = Date.now(),
    upcoming = events
      .filter((x) => x.starts_at && new Date(x.starts_at).getTime() >= now)
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      )
      .slice(0, 12);
  const nextCompetition = upcoming.find((x) => x.event_type === "competition");
  const nextReadiness = readiness.find(
    (x) => x.competition_id === nextCompetition?.id,
  );
  return (
    <section className="mt-8">
      <div className="mb-2 flex items-center justify-between border-b border-[#d8dde4] pb-2">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <CalendarDays className="h-4 w-4" />
          Meetings
        </h2>
        {canCreate && (
          <button
            onClick={onNew}
            className="rounded bg-orange-600 px-3 py-1 text-xs font-semibold text-white"
          >
            + Event
          </button>
        )}
      </div>
      <div className="grid overflow-hidden rounded-md border border-[#d8dde4] bg-white md:grid-cols-2">
        <div className="max-h-[290px] overflow-y-auto border-b border-[#d8dde4] md:border-b-0 md:border-r">
          {upcoming.map((event) => (
            <button
              key={`${event.event_type}-${event.id}`}
              onClick={() => onOpen(event)}
              className="flex w-full gap-3 border-b border-[#e5e8ec] px-4 py-3 text-left text-sm hover:bg-[#f3f7fb]"
            >
              <span className="w-20 shrink-0 text-xs text-[#627188]">
                {new Date(event.starts_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
                <br />
                {new Date(event.starts_at).toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              <span>
                <strong className="block">{event.title || event.name}</strong>
                <small className="text-[#627188]">
                  {event.event_type === "competition"
                    ? "Competition"
                    : event.event_type || "Event"}
                </small>
              </span>
            </button>
          ))}
          {!upcoming.length && (
            <p className="p-5 text-sm text-[#627188]">
              No upcoming meetings or competitions are recorded.
            </p>
          )}
        </div>
        <div className="flex flex-col justify-center p-5">
          {nextCompetition ? (
            <>
              <div className="text-xs font-semibold uppercase text-[#627188]">
                Next competition
              </div>
              <h3 className="mt-2 text-lg font-bold">{nextCompetition.name}</h3>
              <p className="mt-2 text-sm text-[#526176]">
                {new Date(nextCompetition.starts_at).toLocaleString()}
              </p>
              <p className="mt-3 text-sm text-[#526176]">
                {nextReadiness
                  ? `${nextReadiness.candidate_count} athletes in scope · ${nextReadiness.eligible_count} verified eligible · ${nextReadiness.entered_count} entered`
                  : "Open to review entries and eligibility"}
              </p>
              <button
                onClick={() => onOpen(nextCompetition)}
                className="mt-5 w-fit rounded bg-[#145b91] px-4 py-2 text-xs font-semibold text-white"
              >
                Review competition →
              </button>
            </>
          ) : (
            <p className="text-sm text-[#627188]">
              No upcoming competition is recorded.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
function humanAction(action: string, entity: string) {
  const a = String(action || "")
    .replaceAll("_", " ")
    .replaceAll(".", " ");
  return `${a.charAt(0).toUpperCase() + a.slice(1)} ${entity ? String(entity).replaceAll("_", " ") : ""}`.trim();
}
function daypart() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}
function State({ text }: { text: string }) {
  return (
    <div className="bg-[#070909] p-8 text-white">
      <h1 className="text-2xl font-black">Command Center</h1>
      <p className="mt-2 text-neutral-500">{text}</p>
    </div>
  );
}
export default CommandCenter;
