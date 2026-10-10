"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
import dynamic from "next/dynamic";
const TransactionEngine = dynamic(() =>
  import("../superuser/TransactionEngine").then((m) => m.TransactionEngine),
);
const workspaceLoading = () => (
  <div className="p-8 text-sm text-neutral-300">Opening workspace…</div>
);
const BudgetWorkspace = dynamic(
  () => import("./BudgetWorkspace").then((m) => m.BudgetWorkspace),
  { loading: workspaceLoading },
);
const GovernanceWorkspace = dynamic(
  () => import("./GovernanceWorkspace").then((m) => m.GovernanceWorkspace),
  { loading: workspaceLoading },
);
const ContactsDirectory = dynamic(
  () => import("./ContactsDirectory").then((m) => m.ContactsDirectory),
  { loading: workspaceLoading },
);
const CommandCenter = dynamic(
  () => import("./CommandCenter").then((m) => m.CommandCenter),
  { loading: workspaceLoading },
);
const PlanningScheduler = dynamic(
  () => import("./PlanningScheduler").then((m) => m.PlanningScheduler),
  { loading: workspaceLoading },
);
const OrganizationArchitecture = dynamic(
  () =>
    import("./OrganizationArchitecture").then(
      (m) => m.OrganizationArchitecture,
    ),
  { loading: workspaceLoading },
);
const TeamManager = dynamic(
  () => import("./TeamManager").then((m) => m.TeamManager),
  { loading: workspaceLoading },
);
const RegistrarValidation = dynamic(
  () => import("./RegistrarValidation").then((m) => m.RegistrarValidation),
  { loading: workspaceLoading },
);
const FinanceAccounting = dynamic(
  () => import("./FinanceAccounting").then((m) => m.FinanceAccounting),
  { loading: workspaceLoading },
);
const Facilities = dynamic(
  () => import("./Facilities").then((m) => m.Facilities),
  { loading: workspaceLoading },
);
const Payroll = dynamic(() => import("./Payroll").then((m) => m.Payroll), {
  loading: workspaceLoading,
});
const Imports = dynamic(() => import("./Imports").then((m) => m.Imports), {
  loading: workspaceLoading,
});
const Compliance = dynamic(
  () => import("./Compliance").then((m) => m.Compliance),
  { loading: workspaceLoading },
);
const Reporting = dynamic(
  () => import("./Reporting").then((m) => m.Reporting),
  { loading: workspaceLoading },
);
const AdminCompetitionOperations = dynamic(
  () =>
    import("./AdminCompetitionOperations").then(
      (m) => m.AdminCompetitionOperations,
    ),
  { loading: workspaceLoading },
);
const CommunicationsOperations = dynamic(
  () =>
    import("./CommunicationsOperations").then(
      (m) => m.CommunicationsOperations,
    ),
  { loading: workspaceLoading },
);
const VolunteerOperations = dynamic(
  () => import("./VolunteerOperations").then((m) => m.VolunteerOperations),
  { loading: workspaceLoading },
);
const FundraisingOperations = dynamic(
  () => import("./FundraisingOperations").then((m) => m.FundraisingOperations),
  { loading: workspaceLoading },
);
const FamilyOperations = dynamic(
  () => import("./FamilyOperations").then((m) => m.FamilyOperations),
  { loading: workspaceLoading },
);
const VendorDirectory = dynamic(
  () => import("./VendorDirectory").then((m) => m.VendorDirectory),
  { loading: workspaceLoading },
);
const ExternalOrganizationDirectory = dynamic(
  () =>
    import("./ExternalOrganizationDirectory").then(
      (m) => m.ExternalOrganizationDirectory,
    ),
  { loading: workspaceLoading },
);
const registry: Record<
  string,
  React.ComponentType<{ role?: string; roleLabel?: string }>
> = {
  BudgetWorkspace,
  GovernanceWorkspace,
  ContactsDirectory,
  CommandCenter,
  CommunicationsOperations,
  VolunteerOperations,
  FundraisingOperations,
  FamilyOperations,
  PlanningScheduler,
  OrganizationArchitecture,
  TeamManager,
  RegistrarValidation,
  FinanceAccounting,
  Facilities,
  Payroll,
  Imports,
  Compliance,
  Reporting,
  AdminCompetitionOperations,
  VendorDirectory,
  ExternalOrganizationDirectory,
  RostersView: TeamManager,
  MembershipView: RegistrarValidation,
  ProgramsView: (props) => (
    <OrganizationArchitecture {...props} initialDomain="programs" />
  ),
  TeamsView: (props) => (
    <OrganizationArchitecture {...props} initialDomain="teams" />
  ),
  SeasonsView: (props) => (
    <OrganizationArchitecture {...props} initialDomain="seasons" />
  ),
  BillingView: FinanceAccounting,
  InvoicesView: FinanceAccounting,
  PaymentsView: FinanceAccounting,
};
const Fallback = ({
  message = "Admin workspace unavailable.",
}: {
  message?: string;
}) => (
  <div className="flex h-full items-center justify-center p-12">
    <div className="text-center">
      <div className="text-2xl font-black text-white">Admin Workspace</div>
      <p className="mt-2 text-sm text-neutral-400">{message}</p>
    </div>
  </div>
);
type OrganizationOption = {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
};
export function AdminWorkspace() {
  const [engineOpen, setEngineOpen] = useState(false);
  const [engineRevision, setEngineRevision] = useState(0);
  const searchParams = useSearchParams(),
    role = searchParams.get("role") || "org_admin";
  const [Component, setComponent] = useState<React.ComponentType<{
    role?: string;
    roleLabel?: string;
  }> | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [roleLabel, setRoleLabel] = useState("");
  const [contextLoaded, setContextLoaded] = useState(false),
    [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [userId, setUserId] = useState(""),
    [selectedOrganization, setSelectedOrganization] = useState(""),
    [selectionRequired, setSelectionRequired] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function loadContext() {
      try {
        const response = await authenticatedFetch("/api/admin-context", {
            cache: "no-store",
          }),
          body = await response.json();
        if (!response.ok)
          throw new Error(body.error || "Admin context unavailable.");
        const options = (body.organizations || []) as OrganizationOption[],
          stored =
            sessionStorage.getItem(`ls1-admin-organization:${body.userId}`) ||
            "";
        const selected =
          options.length === 1
            ? options[0].id
            : options.some((x) => x.id === stored)
              ? stored
              : "";
        if (selected)
          sessionStorage.setItem(
            `ls1-admin-organization:${body.userId}`,
            selected,
          );
        else if (stored)
          sessionStorage.removeItem(`ls1-admin-organization:${body.userId}`);
        if (!cancelled) {
          setUserId(body.userId);
          setOrganizations(options);
          setSelectionRequired(body.selectionRequired);
          setSelectedOrganization(selected);
          setContextLoaded(true);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Admin context unavailable.",
          );
          setContextLoaded(true);
          setLoading(false);
        }
      }
    }
    void loadContext();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!contextLoaded || (selectionRequired && !selectedOrganization)) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        let view = searchParams.get("view");
        const nav = await authenticatedFetch(
          `/api/admin-navigation?role=${encodeURIComponent(role)}`,
          { cache: "no-store" },
        );
        if (!nav.ok) throw new Error("Admin navigation unavailable.");
        const j = await nav.json();
        if (!cancelled)
          setRoleLabel(
            (j.switcher || []).find(
              (x: { role_name: string; display_name: string }) =>
                x.role_name === role,
            )?.display_name || role.replaceAll("_", " "),
          );
        if (!view)
          view =
            (j.rows || []).find((x: any) => x.component === "CommandCenter")
              ?.nav_id || "";
        if (!view)
          throw new Error("No authorized Admin workspace is available.");
        const selected = (j.rows || []).find(
          (x: { nav_id: string; path?: string; component?: string }) =>
            x.component &&
            x.path &&
            (x.nav_id === view ||
              new URL(x.path, window.location.origin).searchParams.get(
                "view",
              ) === view),
        );
        if (!selected)
          throw new Error(
            "Admin view is not authorized for this role context.",
          );
        const name = selected.component || "",
          C = registry[name];
        if (!C)
          throw new Error(
            `Operational component "${name || selected.label || view}" is not implemented.`,
          );
        if (!cancelled) setComponent(() => C);
      } catch (e) {
        if (!cancelled) {
          setComponent(null);
          setError(
            e instanceof Error ? e.message : "Admin workspace unavailable.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [
    searchParams,
    role,
    contextLoaded,
    selectionRequired,
    selectedOrganization,
  ]);
  if (
    !contextLoaded ||
    (loading && (!selectionRequired || selectedOrganization))
  )
    return (
      <div className="flex h-full items-center justify-center p-12 text-sm text-neutral-400">
        Loading authorized workspace…
      </div>
    );
  if (error) return <Fallback message={error} />;
  if (selectionRequired && !selectedOrganization)
    return (
      <div className="mx-auto max-w-lg bg-[#242529] p-8 text-white">
        <h1 className="text-2xl font-black">Select an organization</h1>
        <p className="mt-2 text-sm text-neutral-300">
          Choose the club whose staff workspace you are opening.
        </p>
        <div className="mt-5 space-y-2">
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => {
                sessionStorage.setItem(
                  `ls1-admin-organization:${userId}`,
                  org.id,
                );
                setSelectedOrganization(org.id);
              }}
              className="block w-full rounded-lg border border-[#d7dce3] p-4 text-left hover:border-[#1772b8]"
            >
              {org.name} <span className="text-neutral-500">{org.code}</span>
            </button>
          ))}
        </div>
        {!organizations.length && (
          <p className="mt-4 text-sm text-red-300">
            No club is available for your account.
          </p>
        )}
      </div>
    );
  if (!Component) return <Fallback message="Admin workspace unavailable." />;
  const C = Component;
  return (
    <div className="min-h-full w-full bg-[#070909] text-white">
      {selectionRequired && (
        <div className="border-b border-neutral-800 bg-[#090b0b] px-6 py-3 text-sm text-neutral-300">
          Organization:{" "}
          <strong>
            {organizations.find((x) => x.id === selectedOrganization)?.name}
          </strong>
          <button
            onClick={() => {
              sessionStorage.removeItem(`ls1-admin-organization:${userId}`);
              setSelectedOrganization("");
              setComponent(null);
            }}
            className="ml-4 font-semibold text-[#FA4616]"
          >
            Change
          </button>
        </div>
      )}
      {["org_admin", "treasurer"].includes(role) && (
        <div className="px-6 py-3">
          <button
            className="rounded bg-emerald-800 px-4 py-2 text-sm"
            onClick={() => setEngineOpen(true)}
          >
            Club balance & squad changes
          </button>
        </div>
      )}
      {engineOpen && (
        <TransactionEngine
          role={role}
          onClose={() => setEngineOpen(false)}
          onSaved={() => setEngineRevision((v) => v + 1)}
        />
      )}
      <C key={`${role}:${engineRevision}`} role={role} roleLabel={roleLabel} />
    </div>
  );
}
export default AdminWorkspace;
