export const triageSources = [
  "operational_tasks",
  "workflow_tasks",
  "competition_exceptions",
] as const;
export type TriageSource = (typeof triageSources)[number];
export const triageRoles = [
  "org_admin",
  "team_manager",
  "registrar",
  "treasurer",
  "competition_manager",
  "volunteer_coordinator",
  "communications_media",
  "fundraising_coordinator",
  "facilities_equipment_manager",
] as const;
export type TriageTask = {
  id: string;
  source: TriageSource;
  title: string;
  problem: string;
  exceptionCode: string | null;
  recommendedAction: string;
  priority: string;
  status: string;
  dueAt: string | null;
  organizationId: string | null;
  teamId: string | null;
  assignedRole: string | null;
  revision: number;
  assignedTo: string | null;
  entityId: string | null;
  entityType: string | null;
  canUpdate: boolean;
  evidence: unknown;
};
export type TriageFeed = {
  tasks: TriageTask[];
  total: number;
  page: number;
  pageSize: number;
  teams: { id: string; name: string; organization_id: string }[];
  organizations: { id: string; name: string }[];
  canCreate: boolean;
  needsTeam: boolean;
  refreshedAt: string;
};
export const closedTask = (status: string) =>
  ["completed", "resolved", "cancelled", "skipped"].includes(
    status.toLowerCase(),
  );
