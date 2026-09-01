import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// =====================================================
// LS1Sports Development Intelligence API
//
// PURPOSE
// - Provide live development telemetry to the SuperUser
//   workspace during local development and controlled
//   server environments.
//
// CURRENT TELEMETRY
// - Counts actual TypeScript/TSX source files.
// - Counts route pages.
// - Counts reusable components.
// - Counts domain modules.
// - Counts Team Manager modules.
// - Counts hub modules.
// - Counts SuperUser modules.
// - Counts API routes.
//
// IMPORTANT
// - This is real filesystem-derived telemetry.
// - It intentionally does NOT pretend that file count equals
//   true business completion.
// - The next evolution should combine this with an explicit
//   implementation registry, database migrations, workflow
//   definitions, tests, integrations, and deployment state.
//
// SECURITY
// - Only relative project metadata is returned.
// - File contents are never returned by this endpoint.
// =====================================================

type Counts = {
  tsFiles: number;
  tsxFiles: number;
  routeFiles: number;
  pageFiles: number;
  componentFiles: number;
  domainFiles: number;
  teamManagerFiles: number;
  hubFiles: number;
  superuserFiles: number;
  apiRouteFiles: number;
};

async function walk(directory: string, counts: Counts): Promise<void> {
  let entries;

  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  await Promise.all(
    entries.map(async (entry) => {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.next' ||
        entry.name === '.git'
      ) {
        return;
      }

      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath, counts);
        return;
      }

      const lower = entry.name.toLowerCase();

      if (lower.endsWith('.tsx')) {
        counts.tsxFiles += 1;
      }

      if (lower.endsWith('.ts')) {
        counts.tsFiles += 1;
      }

      if (lower === 'page.tsx' || lower === 'page.ts') {
        counts.pageFiles += 1;
      }

      if (lower === 'route.ts' || lower === 'route.tsx') {
        counts.routeFiles += 1;
      }

      const normalized = fullPath.replaceAll('\\', '/').toLowerCase();

      if (normalized.includes('/components/')) {
        counts.componentFiles += 1;
      }

      if (normalized.includes('/components/domains/')) {
        counts.domainFiles += 1;
      }

      if (normalized.includes('/components/team-manager/')) {
        counts.teamManagerFiles += 1;
      }

      if (normalized.includes('/components/hubs/')) {
        counts.hubFiles += 1;
      }

      if (normalized.includes('/components/hubs/superuser/')) {
        counts.superuserFiles += 1;
      }

      if (normalized.includes('/app/api/')) {
        counts.apiRouteFiles += 1;
      }
    }),
  );
}

export async function GET() {
  const projectRoot = process.cwd();

  const counts: Counts = {
    tsFiles: 0,
    tsxFiles: 0,
    routeFiles: 0,
    pageFiles: 0,
    componentFiles: 0,
    domainFiles: 0,
    teamManagerFiles: 0,
    hubFiles: 0,
    superuserFiles: 0,
    apiRouteFiles: 0,
  };

  await walk(projectRoot, counts);

  const sourceFiles = counts.tsFiles + counts.tsxFiles;

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      source: 'filesystem',
      counts: {
        ...counts,
        sourceFiles,
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
}
