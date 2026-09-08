import { NextResponse } from 'next/server';
import { requireSuperUser, SuperUserAuthError } from '@/lib/server/requireSuperUser';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const TEXT_FORMATS = new Set(['CSV', 'JSON', 'TXT', 'XML']);

function headers(prefer = 'return=representation') {
  return {
    apikey: KEY!,
    Authorization: `Bearer ${KEY!}`,
    'Content-Type': 'application/json',
    Prefer: prefer,
  };
}

async function rest(path: string, init: RequestInit = {}) {
  if (!URL || !KEY) throw new Error('Competition import server credentials are not configured.');
  const response = await fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers || {}) },
    cache: 'no-store',
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase import request returned ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function sha256(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: Request) {
  try {
    const actor = await requireSuperUser(request);
    if (!actor.canManagePlatformSettings) {
      throw new SuperUserAuthError('Platform-management permission required.', 403);
    }

    const form = await request.formData();
    const file = form.get('file');
    const sourceSystem = String(form.get('source_system') || 'UNKNOWN').trim();
    const format = String(form.get('format') || '').trim().toUpperCase();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Select a source file.' }, { status: 400 });
    }
    if (!format) {
      return NextResponse.json({ error: 'Import format is required.' }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'Source file must be between 1 byte and 10 MB.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const checksum = await sha256(bytes);
    const tenant = (await rest('tenants?select=id&limit=1'))?.[0]?.id || null;
    const systems = await rest('competition_source_systems?select=id,name,code&active=eq.true&limit=100');
    const source = systems?.find((item: { name?: string; code?: string }) => {
      const needle = sourceSystem.toLowerCase();
      return String(item.name || '').toLowerCase() === needle || String(item.code || '').toLowerCase() === needle;
    })?.id || null;

    const job = await rest('import_jobs', {
      method: 'POST',
      body: JSON.stringify({
        tenant_id: tenant,
        source_system: sourceSystem,
        source_file: file.name,
        entity_type: 'COMPETITION_RESULTS',
        started_at: new Date().toISOString(),
        status: 'RECEIVED',
        records_read: 0,
        records_valid: 0,
        records_rejected: 0,
        records_created: 0,
        records_updated: 0,
      }),
    });

    const importFile = await rest('competition_import_files', {
      method: 'POST',
      body: JSON.stringify({
        tenant_id: tenant,
        import_job_id: job?.[0]?.id || null,
        source_system_id: source,
        original_filename: file.name,
        detected_format: format,
        checksum_sha256: checksum,
        file_size_bytes: file.size,
        parse_status: TEXT_FORMATS.has(format) ? 'staging' : 'queued',
        parse_summary: {
          source_system: sourceSystem,
          uploaded_by: actor.email,
          operator_id: actor.operatorId,
          binary_source: !TEXT_FORMATS.has(format),
        },
      }),
    });

    const fileRow = importFile?.[0];
    if (!fileRow?.id) throw new Error('Import file registration did not return an ID.');

    let stagedRecords = 0;
    if (TEXT_FORMATS.has(format)) {
      const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      const records = format === 'JSON' ? [text] : text.split(/\r?\n/).filter(line => line.length > 0);
      const batchSize = 250;

      for (let offset = 0; offset < records.length; offset += batchSize) {
        const batch = records.slice(offset, offset + batchSize).map((line, index) => ({
          import_file_id: fileRow.id,
          record_type: 'RAW',
          line_number: offset + index + 1,
          raw_record: { raw: line },
          validation_status: 'pending',
          validation_errors: [],
        }));
        if (batch.length) {
          await rest('competition_import_records', {
            method: 'POST',
            body: JSON.stringify(batch),
          });
          stagedRecords += batch.length;
        }
      }

      await rest(`competition_import_files?id=eq.${encodeURIComponent(fileRow.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          parse_status: 'staged',
          parse_summary: {
            source_system: sourceSystem,
            uploaded_by: actor.email,
            operator_id: actor.operatorId,
            staged_records: stagedRecords,
            checksum_sha256: checksum,
          },
        }),
      });

      if (job?.[0]?.id) {
        await rest(`import_jobs?id=eq.${encodeURIComponent(job[0].id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ records_read: stagedRecords, status: 'STAGED' }),
        });
      }
    }

    try {
      await rest('audit_events', {
        method: 'POST',
        body: JSON.stringify({
          action: 'COMPETITION_IMPORT_UPLOADED',
          entity_type: 'competition_import_files',
          entity_id: fileRow.id,
          details: {
            filename: file.name,
            format,
            source_system: sourceSystem,
            staged_records: stagedRecords,
            operator_id: actor.operatorId,
            operator_email: actor.email,
          },
        }),
      });
    } catch {
      // Import is already persisted; avoid duplicate writes if the audit schema differs.
    }

    return NextResponse.json({
      success: true,
      file_id: fileRow.id,
      filename: file.name,
      format,
      source_system: sourceSystem,
      staged_records: stagedRecords,
      parse_status: TEXT_FORMATS.has(format) ? 'staged' : 'queued',
      checksum_sha256: checksum,
    });
  } catch (error) {
    if (error instanceof SuperUserAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[competition-import] failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Competition import failed.' }, { status: 500 });
  }
}
