'use client';

// =============================================================================
// SUPERUSER MODULE WORKSPACE - DATABASE DRIVEN
// =============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck, Workflow, Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { getNavigation, NavigationItem, NavigationSection } from '@/components/experience/HubNavigation/navigationDefinitions';
import { renderIconSync } from '@/lib/icons';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =============================================================================
// TYPES
// =============================================================================

type Row = Record<string, any>;
type CommandPayload = { project: Row|null; milestones: Row[]; tasks: Row[]; raci: Row[]; counts: Record<string,number|null>; generatedAt:string; source?:string; error?:string };
type MetricRow = { id?: string; table: string; label: string; count: number|null };
type ModulePayload = { view:string; label:string; metrics:MetricRow[]; generatedAt:string; source:string; error?:string };

// =============================================================================
// UI COMPONENTS
// =============================================================================

function Panel({children,className=''}:{children:React.ReactNode;className?:string}){return <section className={`rounded-2xl border border-neutral-800 bg-[#090b0b] p-6 ${className}`}>{children}</section>}
function Metric({label,value,detail}:{label:string;value:React.ReactNode;detail:string}){return <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4"><div className="text-[8px] font-black uppercase tracking-[.18em] text-neutral-500">{label}</div><div className="mt-2 text-2xl font-black text-white">{value}</div><div className="mt-1 text-[10px] leading-4 text-neutral-500">{detail}</div></div>}

// =============================================================================
// ACTION BUTTONS COMPONENT
// =============================================================================

function ActionButtons({ onAdd, onEdit, onDelete, onSave, onCancel, isEditing }: {
  onAdd?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  isEditing?: boolean;
}) {
  const PlusIcon = renderIconSync('plus');
  const Edit2Icon = renderIconSync('edit-2');
  const Trash2Icon = renderIconSync('trash-2');
  const SaveIcon = renderIconSync('save');
  const XIcon = renderIconSync('x');

  if (isEditing) {
    return (
      <div className="flex gap-2">
        <button onClick={onSave} className="flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-emerald-400 transition-colors">
          {SaveIcon} Save
        </button>
        <button onClick={onCancel} className="flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:border-neutral-500 hover:text-white transition-colors">
          {XIcon} Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      {onAdd && (
        <button onClick={onAdd} className="flex items-center gap-2 rounded-lg bg-[#FA4616] px-3 py-1.5 text-xs font-bold text-black hover:bg-[#FA4616]/90 transition-colors">
          {PlusIcon} Add
        </button>
      )}
      {onEdit && (
        <button onClick={onEdit} className="flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:border-neutral-500 hover:text-white transition-colors">
          {Edit2Icon} Edit
        </button>
      )}
      {onDelete && (
        <button onClick={onDelete} className="flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors">
          {Trash2Icon} Delete
        </button>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function SuperUserModuleWorkspace({ view }: { view: string }) {
  const safeView = view || 'command-center';

  const [moduleData, setModuleData] = useState<ModulePayload|null>(null);
  const [command, setCommand] = useState<CommandPayload|null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemData, setNewItemData] = useState<any>({});
  const [navItem, setNavItem] = useState<NavigationItem | null>(null);
  const [navSection, setNavSection] = useState<string>('SUPERUSER');
  const [error, setError] = useState<string | null>(null);

  // ===========================================================================
  // SET DEFAULT NAV ITEM IMMEDIATELY
  // ===========================================================================
  useEffect(() => {
    // Set default immediately so component doesn't crash
    setNavItem({
      id: safeView,
      label: safeView.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      href: `/superuser?view=${safeView}`,
      icon: 'activity',
      description: 'Live SuperUser operating surface.'
    });
    setNavSection('SUPERUSER');

    // Then try to load from database
    const loadNavItem = async () => {
      try {
        const navSections = await getNavigation('superuser');
        let found = false;
        
        for (const section of navSections) {
          const foundItem = section.items.find(x => 
            x.id === safeView || 
            x.href === `/superuser?view=${safeView}` ||
            x.href === `/superuser/${safeView}` ||
            x.label.toLowerCase().replace(/\s+/g, '-') === safeView
          );
          if (foundItem) {
            setNavItem(foundItem);
            setNavSection(section.label);
            found = true;
            break;
          }
        }
      } catch (error) {
        console.error('Error loading navigation:', error);
        // Keep default navItem
      }
    };
    loadNavItem();
  }, [safeView]);

  // ===========================================================================
  // LOAD DATA
  // ===========================================================================
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, c] = await Promise.all([
        fetch(`/api/superuser-module?view=${encodeURIComponent(safeView)}`, { cache: 'no-store' }),
        fetch('/api/superuser-command', { cache: 'no-store' })
      ]);
      
      if (!m.ok) {
        throw new Error(`API error: ${m.status}`);
      }
      if (!c.ok) {
        throw new Error(`API error: ${c.status}`);
      }
      
      const moduleJson = await m.json();
      const commandJson = await c.json();
      
      setModuleData(moduleJson);
      setCommand(commandJson);
    } catch (e) {
      console.error('Error loading data:', e);
      setError(e instanceof Error ? e.message : 'Failed to load data');
      // Set empty data so component doesn't crash
      setModuleData({ view: safeView, label: safeView, metrics: [], generatedAt: new Date().toISOString(), source: 'LS1SportsEAM Supabase' });
      setCommand({ project: null, milestones: [], tasks: [], raci: [], counts: {}, generatedAt: new Date().toISOString() });
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(timer);
  }, [safeView]);

  // ===========================================================================
  // WRITE OPERATIONS
  // ===========================================================================

  const handleAdd = async () => {
    setShowAddModal(true);
    setNewItemData({});
  };

  const handleSaveNew = async () => {
    try {
      const { data, error } = await supabase
        .from(getTableName(safeView))
        .insert([newItemData])
        .select();

      if (error) throw error;
      setShowAddModal(false);
      await load();
    } catch (error) {
      console.error('Error adding record:', error);
      alert('Failed to add record');
    }
  };

  const handleEdit = (record: any) => {
    setIsEditing(true);
    setEditData(record);
  };

  const handleSaveEdit = async () => {
    try {
      const { data, error } = await supabase
        .from(getTableName(safeView))
        .update(editData)
        .eq('id', editData.id)
        .select();

      if (error) throw error;
      setIsEditing(false);
      setEditData(null);
      await load();
    } catch (error) {
      console.error('Error updating record:', error);
      alert('Failed to update record');
    }
  };

  const handleDelete = async (id: string | undefined) => {
    if (!id) return;
    try {
      const { error } = await supabase
        .from(getTableName(safeView))
        .delete()
        .eq('id', id);

      if (error) throw error;
      await load();
    } catch (error) {
      console.error('Error deleting record:', error);
      alert('Failed to delete record');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData(null);
  };

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  const getTableName = (viewId: string): string => {
    const tableMap: Record<string, string> = {
      'organizations': 'organization_master',
      'people': 'people',
      'athletes': 'athletes',
      'facilities': 'organization_facilities',
      'finance': 'financial_ledgers',
      'payroll': 'payroll_records',
      'workflow': 'sys_workflow_definitions',
      'rules': 'sys_rules_engine',
      'integrations': 'integration_configs',
      'competition': 'c_meet_registry',
    };
    return tableMap[viewId] || viewId;
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  const description = navItem?.description || `${navItem?.label || safeView} - Live SuperUser operating surface.`;

  const relatedTasks = useMemo(() => {
    const words = (navItem?.description || navItem?.label || '').toLowerCase().split(/\W+/).filter(w => w.length > 4);
    return (command?.tasks ?? []).filter(t => {
      const text = `${t.code ?? ''} ${t.name ?? ''} ${t.description ?? ''}`.toLowerCase();
      return words.some(w => text.includes(w));
    }).slice(0, 8);
  }, [command?.tasks, navItem]);

  const isOnboarding = safeView === 'onboarding' || navItem?.label === 'Client Onboarding';
  const isReadOnly = ['audit', 'metrics', 'command-center', 'milestones', 'project-map'].includes(safeView) || 
                      navItem?.label === 'Audit & Governance' || 
                      navItem?.label === 'Live Core Metrics' ||
                      navItem?.label === '14 Milestones';

  const lanes = useMemo(() => {
    const laneMap: Record<string, string[]> = {
      'team-manager': ['Organization architecture', 'Teams & rosters', 'Membership lifecycle', 'Programs & seasons', 'Staff & groups', 'Two-way communications'],
      'new-client': ['01 Client / Tenant', '02 Organization', '03 Sport(s)', '04 Primary Organization Admin', '05 Security & Roles', '06 Configuration', '07 Data Sources', '08 Import / Migration', '09 Validation', '10 Client Review', '11 Activation', '12 Handoff'],
      'client-updates': ['Stage incoming source', 'Compare with canonical roster', 'Classify new / changed / transfer / departure / duplicate', 'Validate', 'Human review', 'Apply approved changes'],
      settings: ['Brand & presentation', 'Platform behavior', 'Locale / currency / timezone', 'Feature defaults', 'Communication defaults', 'Data policy defaults'],
      'role-customization': ['Role workspace defaults', 'Navigation visibility', 'Dashboard defaults', 'Operational scope', 'Notification preferences', 'Permission-safe personalization'],
      deployments: ['Release candidate', 'Build / typecheck', 'Environment configuration', 'Deployment', 'Smoke validation', 'Release evidence'],
      'system-health': ['Database', 'API / runtime', 'Integrations', 'Security', 'Data quality', 'Automation'],
      agents: ['Registry', 'Permission policy', 'Tool access', 'Human approval gates', 'Execution', 'Audit'],
      compliance: ['SafeSport', 'Safeguarding', 'Credentials', 'Background checks', 'Consent / waivers', 'Exceptions'],
      imports: ['Source receipt', 'Staging', 'Validation', 'Identity resolution', 'Reconciliation', 'Canonical apply'],
      procurement: ['Request', 'Approval', 'Purchase order', 'Receipt', 'Invoice / match', 'Financial posting'],
      workflow: ['Definition', 'Trigger', 'Assignment', 'Approval', 'Execution', 'Audit']
    };
    return laneMap[safeView] ?? (moduleData?.metrics ?? []).map(m => m.label).slice(0, 6);
  }, [safeView, moduleData?.metrics]);

  const isClientOps = ['all-clients', 'new-client', 'onboarding-queue', 'active-clients', 'client-exceptions', 'client-updates'].includes(safeView);
  const isSettings = ['settings', 'role-customization'].includes(safeView);

  // Show loading state
  if (loading) {
    return (
      <Panel>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-neutral-500" />
          <span className="ml-3 text-neutral-500">Loading workspace...</span>
        </div>
      </Panel>
    );
  }

  // Show error state
  if (error) {
    return (
      <Panel>
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-red-400">
          <AlertTriangle className="h-5 w-5" />
          <div>
            <div className="font-bold">Error loading workspace</div>
            <div className="text-sm text-neutral-400">{error}</div>
          </div>
          <button onClick={() => void load()} className="ml-auto rounded-lg border border-neutral-700 px-3 py-1 text-xs text-neutral-400 hover:border-neutral-500 hover:text-white transition-colors">
            Retry
          </button>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="text-[9px] font-black uppercase tracking-[.25em] text-emerald-400">{navSection}</div>
            <h1 className="mt-2 text-3xl font-black text-white">{navItem?.label || safeView}</h1>
            <p className="mt-2 max-w-4xl text-xs leading-5 text-neutral-400">
              {description}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!isReadOnly && !isOnboarding && (
              <ActionButtons
                onAdd={handleAdd}
                onEdit={() => handleEdit(moduleData?.metrics?.[0] || {})}
                onDelete={() => handleDelete(moduleData?.metrics?.[0]?.id)}
                isEditing={isEditing}
                onSave={handleSaveEdit}
                onCancel={handleCancel}
              />
            )}
            <button onClick={() => void load()} className="rounded-xl border border-neutral-800 p-3 text-neutral-400 hover:text-white" aria-label="Refresh">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </Panel>

      {moduleData?.error && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-900/60 bg-amber-950/20 px-4 py-3 text-xs text-amber-300">
          <AlertTriangle className="h-4 w-4" />
          {moduleData.error}
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(moduleData?.metrics ?? []).slice(0, 8).map((metric, index) => (
          <div key={metric.table} className="relative">
            <Metric 
              label={metric.label} 
              value={isEditing && editData ? (
                <input 
                  type="text" 
                  value={editData[metric.table] || ''} 
                  onChange={(e) => setEditData({ ...editData, [metric.table]: e.target.value })}
                  className="w-full rounded-lg border border-neutral-700 bg-black px-2 py-1 text-xl font-black text-white"
                />
              ) : metric.count ?? '—'} 
              detail={`Live ${metric.table} records`} 
            />
            {isEditing && (
              <button 
                onClick={() => handleDelete(metric.id)} 
                className="absolute top-2 right-2 text-red-400 hover:text-red-300"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Rest of the component... */}
      <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <Panel>
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-emerald-400" />
            <div>
              <div className="text-[9px] font-black uppercase tracking-[.18em] text-neutral-500">Operating model</div>
              <h2 className="text-xl font-black text-white">{isClientOps ? 'Client lifecycle' : isSettings ? 'Configuration scope' : 'Control lanes'}</h2>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {lanes.map((lane, index) => (
              <div key={lane} className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4">
                <div className="text-[8px] font-black uppercase tracking-[.15em] text-neutral-600">{String(index + 1).padStart(2, '0')}</div>
                <div className="mt-2 text-sm font-bold text-white">{lane}</div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <div>
              <div className="text-[9px] font-black uppercase tracking-[.18em] text-neutral-500">Control posture</div>
              <h2 className="text-xl font-black text-white">Live evidence</h2>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4 text-xs leading-5 text-neutral-400">
              <span className="font-bold text-white">Source:</span> {moduleData?.source ?? 'LS1SportsEAM Supabase'}
            </div>
            <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4 text-xs leading-5 text-neutral-400">
              <span className="font-bold text-white">Refresh:</span> {moduleData ? new Date(moduleData.generatedAt).toLocaleString() : '—'}
            </div>
            <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4 text-xs leading-5 text-neutral-400">
              <span className="font-bold text-white">Write Access:</span> {isReadOnly ? '❌ Read-Only' : '✅ Read/Write'}
            </div>
          </div>
        </Panel>
      </div>

      {/* Implementation Tasks */}
      <Panel>
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400" />
          <div>
            <div className="text-[9px] font-black uppercase tracking-[.18em] text-neutral-500">Implementation</div>
            <h2 className="text-xl font-black text-white">Related build evidence</h2>
          </div>
        </div>
        <div className="mt-5 space-y-2">
          {relatedTasks.length ? relatedTasks.map(task => (
            <div key={task.id} className="grid gap-2 rounded-xl border border-neutral-800 bg-[#0d1010] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <div className="text-sm font-bold text-white">{task.code} · {task.name}</div>
                <div className="mt-1 text-[10px] text-neutral-500">{task.status}{task.blocker ? ` · blocker: ${task.blocker}` : ''}</div>
              </div>
              <div className="text-xl font-black text-white">{task.percent_complete ?? 0}%</div>
            </div>
          )) : (
            <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4 text-xs text-neutral-500">
              No implementation task is mapped to this domain.
            </div>
          )}
        </div>
      </Panel>

      {isOnboarding && (
        <Panel>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <div>
              <div className="text-[9px] font-black uppercase tracking-[.18em] text-neutral-500">Provisioning</div>
              <h2 className="text-xl font-black text-white">Client Onboarding</h2>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4 text-center">
              <div className="text-2xl font-black text-white">12</div>
              <div className="text-xs text-neutral-500">Steps</div>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4 text-center">
              <div className="text-2xl font-black text-white">24</div>
              <div className="text-xs text-neutral-500">Active Clients</div>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4 text-center">
              <div className="text-2xl font-black text-white">3</div>
              <div className="text-xs text-neutral-500">In Progress</div>
            </div>
          </div>
          <button className="mt-4 w-full rounded-xl bg-[#FA4616] py-3 text-sm font-bold text-black hover:bg-[#FA4616]/90 transition-colors">
            Start New Client Onboarding
          </button>
        </Panel>
      )}
    </div>
  );
}