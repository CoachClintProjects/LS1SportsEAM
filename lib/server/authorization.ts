import type { NextRequest } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;

type Json = Record<string, unknown>;

type AuthorizationRequirement = {
  permission: string;
  organizationId?: string | null;
  teamId?: string | null;
  requestedFields?: string[];
};

export type AuthorizationContext = {
  authenticated: true;
  authUserId: string;
  email: string | null;
  personId: string | null;
  roleCodes: string[];
  permission: string;
  organizationIds: string[];
  teamIds: string[];
  fieldRules: Json;
  superuser: boolean;
};

export class AuthorizationError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function config() {
  if (!SUPABASE_URL || !SERVICE_KEY || !PUBLIC_KEY) {
    throw new AuthorizationError(503, 'AUTH_CONFIG', 'Authorization service is not configured.');
  }
  return { url: SUPABASE_URL, serviceKey: SERVICE_KEY, publicKey: PUBLIC_KEY };
}

async function serviceRest(path: string) {
  const { url, serviceKey } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  const text = await response.text();
  if (!response.ok) throw new AuthorizationError(503, 'AUTH_DATA', `Authorization data lookup failed (${response.status}).`);
  return text ? JSON.parse(text) : [];
}

function bearer(request: NextRequest) {
  const authorization = request.headers.get('authorization') || '';
  if (/^Bearer\s+/i.test(authorization)) return authorization.replace(/^Bearer\s+/i, '').trim();
  return request.cookies.get('ls1_superuser_session')?.value || null;
}

async function authenticate(request: NextRequest) {
  const token = bearer(request);
  if (!token) throw new AuthorizationError(401, 'AUTH_REQUIRED', 'Authentication is required.');
  const { url, publicKey } = config();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: publicKey, Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new AuthorizationError(401, 'AUTH_INVALID', 'Authentication session is invalid or expired.');
  const user = await response.json() as { id?: string; email?: string };
  if (!user.id) throw new AuthorizationError(401, 'AUTH_INVALID', 'Authenticated identity is incomplete.');
  return { id: user.id, email: user.email?.trim().toLowerCase() || null };
}

function csv(values: string[]) {
  return `(${values.map((value) => `\"${value.replaceAll('"', '')}\"`).join(',')})`;
}

export async function authorizeRequest(request: NextRequest, requirement: AuthorizationRequirement): Promise<AuthorizationContext> {
  const user = await authenticate(request);

  const operatorRows = user.email
    ? await serviceRest(`platform_superuser_operators?select=person_id,email&active=eq.true&email=ilike.${encodeURIComponent(user.email)}&limit=1`)
    : [];
  const operator = operatorRows?.[0] || null;

  const appUsers = await serviceRest(`users?select=id,person_id,status&id=eq.${encodeURIComponent(user.id)}&limit=1`);
  const appUser = appUsers?.[0] || null;
  const personId = operator?.person_id || appUser?.person_id || null;

  let assignments: Array<{ role_id: string; organization_id: string | null; team_id: string | null }> = [];
  let roles: Array<{ id: string; code: string }> = [];

  if (personId) {
    const now = new Date().toISOString();
    assignments = await serviceRest(`person_role_assignments?select=role_id,organization_id,team_id,status,starts_at,ends_at&person_id=eq.${encodeURIComponent(personId)}&status=eq.active&or=(starts_at.is.null,starts_at.lte.${encodeURIComponent(now)})&or=(ends_at.is.null,ends_at.gte.${encodeURIComponent(now)})`);
    const roleIds = [...new Set(assignments.map((row) => row.role_id).filter(Boolean))];
    if (roleIds.length) roles = await serviceRest(`roles?select=id,code&id=in.${encodeURIComponent(csv(roleIds))}`);
  }

  const roleCodes = [...new Set(roles.map((row) => String(row.code)))];
  if (operator) roleCodes.push('SYSTEM_SUPERUSER');
  const uniqueRoleCodes = [...new Set(roleCodes)];
  if (!uniqueRoleCodes.length) throw new AuthorizationError(403, 'ROLE_REQUIRED', 'No active role assignment authorizes this request.');

  const roleDefinitions = await serviceRest(`role_definitions?select=id,code,tenant_id,is_active&is_active=eq.true&code=in.${encodeURIComponent(csv(uniqueRoleCodes))}`);
  const roleDefinitionIds = roleDefinitions.map((row: { id: string }) => row.id);
  if (!roleDefinitionIds.length) throw new AuthorizationError(403, 'ROLE_UNMAPPED', 'Active role is not mapped to the authorization control plane.');

  const permissions = await serviceRest(`permission_definitions?select=id,code,resource,action,field_scope,conditions&is_active=eq.true&code=eq.${encodeURIComponent(requirement.permission)}&limit=10`);
  const permissionIds = permissions.map((row: { id: string }) => row.id);
  if (!permissionIds.length) throw new AuthorizationError(403, 'PERMISSION_UNDEFINED', 'Requested action is not defined in the authorization control plane.');

  const grants = await serviceRest(`role_permission_definitions?select=role_definition_id,permission_definition_id,effect,field_rules,conditions,is_active&is_active=eq.true&role_definition_id=in.${encodeURIComponent(csv(roleDefinitionIds))}&permission_definition_id=in.${encodeURIComponent(csv(permissionIds))}`);
  const denied = grants.some((row: { effect?: string }) => row.effect === 'DENY');
  const allowed = grants.filter((row: { effect?: string }) => row.effect === 'ALLOW');
  if (denied || !allowed.length) throw new AuthorizationError(403, 'ACTION_FORBIDDEN', 'Your role does not permit this action.');

  const superuser = uniqueRoleCodes.includes('SYSTEM_SUPERUSER');
  const organizationIds = [...new Set(assignments.map((row) => row.organization_id).filter((value): value is string => Boolean(value)))];
  const teamIds = [...new Set(assignments.map((row) => row.team_id).filter((value): value is string => Boolean(value)))];

  if (!superuser && requirement.organizationId && !organizationIds.includes(requirement.organizationId)) {
    throw new AuthorizationError(403, 'SCOPE_FORBIDDEN', 'This organization is outside your authorized scope.');
  }
  if (!superuser && requirement.teamId && !teamIds.includes(requirement.teamId)) {
    throw new AuthorizationError(403, 'SCOPE_FORBIDDEN', 'This team is outside your authorized scope.');
  }

  const mergedFieldRules = allowed.reduce<Json>((acc, row: { field_rules?: Json }) => ({ ...acc, ...(row.field_rules || {}) }), {});
  const deniedFields = Array.isArray(mergedFieldRules.deny) ? mergedFieldRules.deny.map(String) : [];
  if (requirement.requestedFields?.some((field) => deniedFields.includes(field))) {
    throw new AuthorizationError(403, 'FIELD_FORBIDDEN', 'One or more requested fields are not permitted for this role.');
  }

  return {
    authenticated: true,
    authUserId: user.id,
    email: user.email,
    personId,
    roleCodes: uniqueRoleCodes,
    permission: requirement.permission,
    organizationIds,
    teamIds,
    fieldRules: mergedFieldRules,
    superuser,
  };
}

export function authorizationFailure(error: unknown) {
  if (error instanceof AuthorizationError) return { status: error.status, body: { error: error.message, code: error.code } };
  return null;
}
