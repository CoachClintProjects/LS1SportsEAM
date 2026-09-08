import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(root, rel));
const fail = message => failures.push(message);

const navPath = 'components/experience/HubNavigation/HubNavigation.tsx';
const defsPath = 'components/experience/HubNavigation/navigationDefinitions.ts';
const navApiPath = 'app/api/hub-navigation/route.ts';
const superPagePath = 'app/superuser/page.tsx';
const superBoundaryPath = 'components/hubs/superuser/SuperUserApiBoundary.tsx';
const releaseApiPath = 'app/api/superuser-release/route.ts';
const releaseUiPath = 'components/hubs/superuser/SuperUserReleaseCertification.tsx';
const staleRegistryPath = 'components/navigation/NavigationRegistry.ts';
const staleWorkspacePath = 'components/hubs/superuser/SuperUserWorkspace.tsx';

for (const required of [navPath, defsPath, navApiPath, superPagePath, superBoundaryPath, releaseApiPath, releaseUiPath]) {
  if (!exists(required)) fail(`${required}: required regression-lock target is missing.`);
}

function walk(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const child = path.join(rel, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '.git'].includes(entry.name)) continue;
      out.push(...walk(child));
    } else if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name)) {
      out.push(child);
    }
  }
  return out;
}

// Global lock: no client module may eagerly construct a Supabase/browser client
// at module scope. This is the defect class that repeatedly broke Next prerender.
for (const rel of [...walk('app'), ...walk('components'), ...walk('lib')]) {
  const source = read(rel).replace(/^\uFEFF/, '');
  if (!/^['\"]use client['\"];?/m.test(source)) continue;
  const topLevelClient = /^(?:const|let|var)\s+[A-Za-z_$][\w$]*(?:\s*:[^=\n]+)?\s*=\s*create(?:Browser)?Client\s*\(/m;
  if (topLevelClient.test(source)) {
    fail(`${rel}: client-side Supabase construction at module scope is forbidden; create it lazily in browser execution.`);
  }
}

if (exists(defsPath)) {
  const defs = read(defsPath);
  if (defs.includes('@supabase/supabase-js') || defs.includes('createClient(')) {
    fail(`${defsPath}: shared browser navigation must not instantiate Supabase directly.`);
  }
  if (!defs.includes('/api/hub-navigation')) {
    fail(`${defsPath}: shared navigation must use the canonical server navigation API.`);
  }
  if (!defs.includes('authenticatedFetch') || !defs.includes("hubId === 'superuser'")) {
    fail(`${defsPath}: Super User navigation must authenticate independently of page-boundary timing.`);
  }
}

if (exists(navPath)) {
  const nav = read(navPath);
  const initStart = nav.indexOf('async function initializeHub()');
  const initEnd = nav.indexOf('void initializeHub();', initStart);
  if (initStart < 0 || initEnd < 0) {
    fail(`${navPath}: initializeHub contract not found.`);
  } else if (nav.slice(initStart, initEnd).includes('setSections(')) {
    fail(`${navPath}: same-hub URL/search changes must never reset the loaded navigation tree.`);
  }
  if (!nav.includes('loadedHubRef.current !== activeHubId')) {
    fail(`${navPath}: last successful navigation tree preservation lock is missing.`);
  }
  if (!nav.includes("new CustomEvent('ls1sports:navigation'")) {
    fail(`${navPath}: canonical navigation event is missing.`);
  }
  if (!nav.includes("view: target.searchParams.get('view') || null")) {
    fail(`${navPath}: navigation event must expose the canonical view parsed from the href.`);
  }
}

if (exists(navApiPath)) {
  const api = read(navApiPath);
  if (!api.includes("hubId === 'superuser'") || !api.includes('requireSuperUser(request)')) {
    fail(`${navApiPath}: Super User navigation must remain authorization-gated server-side.`);
  }
  if (!api.includes('hub_navigation?select=')) {
    fail(`${navApiPath}: canonical DB-driven hub_navigation source is missing.`);
  }
  if (!api.includes("withoutSubtree(filtered, 'Competition Engine')")) {
    fail(`${navApiPath}: Competition Engine must remain outside the current Team Manager Super User navigation.`);
  }
}

if (exists(superPagePath)) {
  const page = read(superPagePath);
  if (!page.includes('useSearchParams')) fail(`${superPagePath}: URL must remain authoritative for active Super User view.`);
  if (!page.includes('<SuperUserModuleWorkspace view={view} />')) {
    fail(`${superPagePath}: non-command Super User views must route through SuperUserModuleWorkspace.`);
  }
  if (!page.includes('<ProjectCommand />')) fail(`${superPagePath}: Project Command control surface is missing.`);
  if (!page.includes('<SuperUserApiBoundary>')) fail(`${superPagePath}: Super User API boundary is missing.`);
  if (!page.includes('<SuperUserReleaseCertification')) fail(`${superPagePath}: exact-SHA release certification control is missing.`);
  if (page.includes('SuperUserCompetitionActions') || page.includes('SuperUserCompetitionOperations')) {
    fail(`${superPagePath}: Competition Engine actions must not be mounted in the current Team Manager runtime.`);
  }
}

if (exists(releaseApiPath)) {
  const api = read(releaseApiPath);
  if (!api.includes('requireSuperUser(request)')) fail(`${releaseApiPath}: release ledger API must remain Super User gated.`);
  if (!api.includes('writeAuditEvent')) fail(`${releaseApiPath}: release mutations must remain audited.`);
  if (!api.includes('platform_release_verifications') || !api.includes('platform_release_defects')) {
    fail(`${releaseApiPath}: release API must include verification and defect evidence.`);
  }
}

if (exists(staleRegistryPath)) {
  fail(`${staleRegistryPath}: duplicate navigation registry must not exist; hub_navigation + HubNavigation is authoritative.`);
}
if (exists(staleWorkspacePath)) {
  fail(`${staleWorkspacePath}: duplicate Super User workspace/router must not exist; app/superuser/page.tsx is authoritative.`);
}

if (failures.length) {
  console.error('\nLS1Sports regression locks FAILED:\n');
  failures.forEach((message, index) => console.error(`${index + 1}. ${message}`));
  process.exit(1);
}

console.log('LS1Sports regression locks passed.');
