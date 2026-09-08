import { NextRequest, NextResponse } from 'next/server';
import { requireSuperUser, SuperUserAuthError } from '@/lib/server/requireSuperUser';
import { writeAuditEvent } from '@/lib/server/writeAuditEvent';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function headers(prefer = 'return=representation') {
  if (!KEY) throw new Error('Supabase service credentials are not configured.');
  return { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: prefer };
}

async function rest(path: string, init: RequestInit = {}) {
  if (!URL || !KEY) throw new Error('Supabase service credentials are not configured.');
  const response = await fetch(`${URL}/rest/v1/${path}`, { ...init, headers: { ...headers(), ...(init.headers || {}) }, cache: 'no-store' });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${path} returned ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

function text(value: unknown, label: string, max = 160) {
  const result = String(value || '').trim();
  if (!result) throw new Error(`${label} is required.`);
  if (result.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  return result;
}

function optionalText(value: unknown, max = 500) {
  const result = String(value || '').trim();
  if (!result) return null;
  if (result.length > max) throw new Error(`Text must be ${max} characters or fewer.`);
  return result;
}

function jsonObject(value: unknown, label: string) {
  if (value === null || value === undefined || value === '') return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`${label} must be a JSON object.`);
  }
}

function rejectSecrets(value: Record<string, unknown>) {
  const forbidden = /pass(word)?|secret|token|api[_-]?key|private[_-]?key|client[_-]?secret/i;
  const scan = (object: Record<string, unknown>): boolean => Object.entries(object).some(([key, child]) => {
    if (forbidden.test(key)) return true;
    return child && typeof child === 'object' && !Array.isArray(child) ? scan(child as Record<string, unknown>) : false;
  });
  if (scan(value)) throw new Error('Secrets and credentials cannot be stored in generic integration configuration. Use the approved secret-management path.');
}

async function defaultTenantId() {
  return (await rest('tenants?select=id&limit=1'))?.[0]?.id || null;
}

async function row(table: string, id: string) {
  return (await rest(`${table}?id=eq.${encodeURIComponent(id)}&select=*&limit=1`))?.[0] || null;
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperUser(request);
    if (!actor.canManagePlatformSettings) throw new SuperUserAuthError('Platform-management permission required.', 403);
    const body = await request.json();
    const action = String(body.action || '');
    const tenantId = await defaultTenantId();

    if (action === 'create-business-rule') {
      const created = await rest('business_rule_definitions', { method: 'POST', body: JSON.stringify({
        tenant_id: tenantId,
        code: text(body.code, 'Code', 80).toUpperCase(),
        name: text(body.name, 'Name', 160),
        description: optionalText(body.description),
        domain: text(body.domain, 'Domain', 80),
        trigger_event: optionalText(body.trigger_event, 120),
        rule_definition: jsonObject(body.rule_definition, 'Rule definition'),
        priority: Number.isFinite(Number(body.priority)) ? Number(body.priority) : 100,
        is_active: body.is_active !== false,
      }) });
      const item = created?.[0];
      await writeAuditEvent(actor, { action: 'BUSINESS_RULE_CREATED', entityType: 'business_rule_definitions', entityId: item?.id || null, tenantId, afterData: item || body, reason: 'Super User created business rule' });
      return NextResponse.json(item);
    }

    if (action === 'set-business-rule-active') {
      const id = text(body.id, 'Rule ID', 80);
      const before = await row('business_rule_definitions', id);
      if (!before) return NextResponse.json({ error: 'Business rule not found.' }, { status: 404 });
      const updated = await rest(`business_rule_definitions?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ is_active: Boolean(body.active), updated_at: new Date().toISOString() }) });
      const after = updated?.[0] || await row('business_rule_definitions', id);
      await writeAuditEvent(actor, { action: Boolean(body.active) ? 'BUSINESS_RULE_ACTIVATED' : 'BUSINESS_RULE_DEACTIVATED', entityType: 'business_rule_definitions', entityId: id, tenantId: before.tenant_id || tenantId, beforeData: before, afterData: after, reason: 'Super User changed business rule lifecycle state' });
      return NextResponse.json(after);
    }

    if (action === 'create-validation-rule') {
      const created = await rest('validation_rule_definitions', { method: 'POST', body: JSON.stringify({
        tenant_id: tenantId,
        code: text(body.code, 'Code', 80).toUpperCase(),
        name: text(body.name, 'Name', 160),
        description: optionalText(body.description),
        entity_type: optionalText(body.entity_type, 120),
        field_name: optionalText(body.field_name, 120),
        severity: String(body.severity || 'error').toLowerCase(),
        rule_type: text(body.rule_type, 'Rule type', 80),
        rule_definition: jsonObject(body.rule_definition, 'Rule definition'),
        message_template: optionalText(body.message_template),
        is_active: body.is_active !== false,
      }) });
      const item = created?.[0];
      await writeAuditEvent(actor, { action: 'VALIDATION_RULE_CREATED', entityType: 'validation_rule_definitions', entityId: item?.id || null, tenantId, afterData: item || body, reason: 'Super User created validation rule' });
      return NextResponse.json(item);
    }

    if (action === 'set-validation-rule-active') {
      const id = text(body.id, 'Rule ID', 80);
      const before = await row('validation_rule_definitions', id);
      if (!before) return NextResponse.json({ error: 'Validation rule not found.' }, { status: 404 });
      const updated = await rest(`validation_rule_definitions?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ is_active: Boolean(body.active), updated_at: new Date().toISOString() }) });
      const after = updated?.[0] || await row('validation_rule_definitions', id);
      await writeAuditEvent(actor, { action: Boolean(body.active) ? 'VALIDATION_RULE_ACTIVATED' : 'VALIDATION_RULE_DEACTIVATED', entityType: 'validation_rule_definitions', entityId: id, tenantId: before.tenant_id || tenantId, beforeData: before, afterData: after, reason: 'Super User changed validation rule lifecycle state' });
      return NextResponse.json(after);
    }

    if (action === 'create-data-quality-rule') {
      const created = await rest('data_quality_rules', { method: 'POST', body: JSON.stringify({
        tenant_id: tenantId,
        entity_type: text(body.entity_type, 'Entity type', 120),
        rule_code: text(body.rule_code, 'Rule code', 80).toUpperCase(),
        description: text(body.description, 'Description', 500),
        expression: jsonObject(body.expression, 'Expression'),
        severity: String(body.severity || 'error').toLowerCase(),
        active: body.active !== false,
      }) });
      const item = created?.[0];
      await writeAuditEvent(actor, { action: 'DATA_QUALITY_RULE_CREATED', entityType: 'data_quality_rules', entityId: item?.id || null, tenantId, afterData: item || body, reason: 'Super User created data quality rule' });
      return NextResponse.json(item);
    }

    if (action === 'set-data-quality-rule-active') {
      const id = text(body.id, 'Rule ID', 80);
      const before = await row('data_quality_rules', id);
      if (!before) return NextResponse.json({ error: 'Data quality rule not found.' }, { status: 404 });
      const updated = await rest(`data_quality_rules?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ active: Boolean(body.active) }) });
      const after = updated?.[0] || await row('data_quality_rules', id);
      await writeAuditEvent(actor, { action: Boolean(body.active) ? 'DATA_QUALITY_RULE_ACTIVATED' : 'DATA_QUALITY_RULE_DEACTIVATED', entityType: 'data_quality_rules', entityId: id, tenantId: before.tenant_id || tenantId, beforeData: before, afterData: after, reason: 'Super User changed data quality rule lifecycle state' });
      return NextResponse.json(after);
    }

    if (action === 'create-integration-definition') {
      const contract = jsonObject(body.contract_definition, 'Contract definition');
      rejectSecrets(contract);
      const created = await rest('integration_definitions', { method: 'POST', body: JSON.stringify({
        tenant_id: tenantId,
        code: text(body.code, 'Code', 80).toUpperCase(),
        name: text(body.name, 'Name', 160),
        description: optionalText(body.description),
        integration_type: String(body.integration_type || 'legacy_reference'),
        direction: String(body.direction || 'inbound'),
        transport: optionalText(body.transport, 80),
        source_system: optionalText(body.source_system, 120),
        contract_definition: contract,
        auth_definition: {},
        is_required_dependency: Boolean(body.is_required_dependency),
        is_active: body.is_active !== false,
      }) });
      const item = created?.[0];
      await writeAuditEvent(actor, { action: 'INTEGRATION_DEFINITION_CREATED', entityType: 'integration_definitions', entityId: item?.id || null, tenantId, afterData: item || body, reason: 'Super User created integration definition' });
      return NextResponse.json(item);
    }

    if (action === 'set-integration-definition-active') {
      const id = text(body.id, 'Integration ID', 80);
      const before = await row('integration_definitions', id);
      if (!before) return NextResponse.json({ error: 'Integration definition not found.' }, { status: 404 });
      const updated = await rest(`integration_definitions?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ is_active: Boolean(body.active), updated_at: new Date().toISOString() }) });
      const after = updated?.[0] || await row('integration_definitions', id);
      await writeAuditEvent(actor, { action: Boolean(body.active) ? 'INTEGRATION_DEFINITION_ACTIVATED' : 'INTEGRATION_DEFINITION_DEACTIVATED', entityType: 'integration_definitions', entityId: id, tenantId: before.tenant_id || tenantId, beforeData: before, afterData: after, reason: 'Super User changed integration definition lifecycle state' });
      return NextResponse.json(after);
    }

    if (action === 'create-integration-connection') {
      const configuration = jsonObject(body.configuration, 'Configuration');
      rejectSecrets(configuration);
      const created = await rest('integration_connections', { method: 'POST', body: JSON.stringify({
        tenant_id: tenantId,
        system_code: text(body.system_code, 'System code', 80).toUpperCase(),
        name: text(body.name, 'Name', 160),
        provider: optionalText(body.provider, 120),
        status: String(body.status || 'configured'),
        auth_method: optionalText(body.auth_method, 80),
        configuration,
      }) });
      const item = created?.[0];
      await writeAuditEvent(actor, { action: 'INTEGRATION_CONNECTION_CREATED', entityType: 'integration_connections', entityId: item?.id || null, tenantId, afterData: item || body, reason: 'Super User created integration connection without embedded secrets' });
      return NextResponse.json(item);
    }

    if (action === 'set-integration-connection-status') {
      const id = text(body.id, 'Connection ID', 80);
      const status = text(body.status, 'Status', 60).toLowerCase();
      const before = await row('integration_connections', id);
      if (!before) return NextResponse.json({ error: 'Integration connection not found.' }, { status: 404 });
      const updated = await rest(`integration_connections?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      const after = updated?.[0] || await row('integration_connections', id);
      await writeAuditEvent(actor, { action: 'INTEGRATION_CONNECTION_STATUS_CHANGED', entityType: 'integration_connections', entityId: id, tenantId: before.tenant_id || tenantId, beforeData: before, afterData: after, reason: `Super User set integration connection status to ${status}` });
      return NextResponse.json(after);
    }

    if (action === 'create-integration-mapping') {
      const transform = jsonObject(body.transform_definition, 'Transform definition');
      rejectSecrets(transform);
      const created = await rest('integration_mappings', { method: 'POST', body: JSON.stringify({
        connection_id: body.connection_id || null,
        entity_type: text(body.entity_type, 'Entity type', 120),
        source_field: text(body.source_field, 'Source field', 160),
        target_field: text(body.target_field, 'Target field', 160),
        transform_definition: transform,
      }) });
      const item = created?.[0];
      await writeAuditEvent(actor, { action: 'INTEGRATION_MAPPING_CREATED', entityType: 'integration_mappings', entityId: item?.id || null, tenantId, afterData: item || body, reason: 'Super User created integration mapping' });
      return NextResponse.json(item);
    }

    if (action === 'set-dead-letter-status') {
      const id = text(body.id, 'Dead-letter ID', 80);
      const status = text(body.status, 'Status', 60).toLowerCase();
      const before = await row('integration_dead_letters', id);
      if (!before) return NextResponse.json({ error: 'Dead-letter record not found.' }, { status: 404 });
      const updated = await rest(`integration_dead_letters?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      const after = updated?.[0] || await row('integration_dead_letters', id);
      await writeAuditEvent(actor, { action: 'INTEGRATION_DEAD_LETTER_STATUS_CHANGED', entityType: 'integration_dead_letters', entityId: id, tenantId, beforeData: before, afterData: after, reason: `Super User changed dead-letter status to ${status}` });
      return NextResponse.json(after);
    }

    return NextResponse.json({ error: 'Unsupported domain action.' }, { status: 400 });
  } catch (error) {
    if (error instanceof SuperUserAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Domain action failed.' }, { status: 400 });
  }
}
