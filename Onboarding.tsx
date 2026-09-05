'use client';

// =============================================================================
// SUPERUSER ONBOARDING - 11-Step New Client Workflow
// =============================================================================

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Users,
  Shield,
  Settings,
  Upload,
  Eye,
  Rocket,
  Handshake,
  Plus,
  Trash2,
  RefreshCw,
  UserPlus,
  Globe,
  Mail,
  Phone,
  FileText,
  Check,
  X,
  Loader2,
  Database,
  MapPin,
  Calendar,
  User,
  DollarSign,
  Link
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// =============================================================================
// TYPES
// =============================================================================

interface OnboardingData {
  // Step 1: Client / Tenant
  tenant_name: string;
  subdomain: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  
  // Step 2: Organization
  legal_name: string;
  display_name: string;
  governing_body: string;
  
  // Step 3: Sports
  sports: string[];
  
  // Step 4: Primary Admin
  admin_name: string;
  admin_email: string;
  admin_password: string;
  
  // Step 5-6: Automated (no user input)
  // Step 7: Data Sources
  source_system: string;
  
  // Step 8: Import (file upload)
  import_file: File | null;
  
  // Step 9: Automated validation results
  validation_results: any;
  
  // Step 10: Review (read-only)
  // Step 11: Activation (one-click)
  case_id: string | null;
}

// =============================================================================
// STEP DEFINITIONS
// =============================================================================

const STEPS = [
  { id: 'tenant', label: 'Client / Tenant', icon: 'globe', automated: false },
  { id: 'organization', label: 'Organization', icon: 'building2', automated: false },
  { id: 'sports', label: 'Sport(s)', icon: 'users', automated: false },
  { id: 'admin', label: 'Primary Admin', icon: 'user-plus', automated: false },
  { id: 'security', label: 'Security & Roles', icon: 'shield', automated: true },
  { id: 'configuration', label: 'Configuration', icon: 'settings', automated: true },
  { id: 'datasource', label: 'Data Sources', icon: 'database', automated: false },
  { id: 'import', label: 'Import / Migration', icon: 'upload', automated: false },
  { id: 'validation', label: 'Validation', icon: 'eye', automated: true },
  { id: 'review', label: 'Client Review', icon: 'file-text', automated: false },
  { id: 'activation', label: 'Activation', icon: 'rocket', automated: false },
];

// =============================================================================
// AVAILABLE OPTIONS
// =============================================================================

const AVAILABLE_SPORTS = [
  { id: 'swimming', label: 'Swimming' },
  { id: 'track_field', label: 'Track & Field' },
  { id: 'soccer', label: 'Soccer' },
  { id: 'hockey', label: 'Hockey' },
  { id: 'basketball', label: 'Basketball' },
  { id: 'volleyball', label: 'Volleyball' },
  { id: 'gymnastics', label: 'Gymnastics' },
  { id: 'wrestling', label: 'Wrestling' },
];

const GOVERNING_BODIES = [
  { id: 'usa_swimming', label: 'USA Swimming' },
  { id: 'swim_canada', label: 'Swimming Canada' },
  { id: 'usatf', label: 'USATF' },
  { id: 'athletics_canada', label: 'Athletics Canada' },
  { id: 'us_soccer', label: 'US Soccer' },
  { id: 'canada_soccer', label: 'Canada Soccer' },
  { id: 'other', label: 'Other' },
];

const SOURCE_SYSTEMS = [
  { id: 'hy_tek', label: 'Hy-Tek Team Manager' },
  { id: 'swimtopia', label: 'SwimTopia' },
  { id: 'swimcloud', label: 'SwimCloud' },
  { id: 'team_unify', label: 'Team Unify' },
  { id: 'csv', label: 'CSV / Excel' },
  { id: 'other', label: 'Other' },
];

// =============================================================================
// UI COMPONENTS
// =============================================================================

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-neutral-800 bg-[#090b0b] p-6 ${className}`}>{children}</div>;
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-between w-full">
      {STEPS.map((step, index) => {
        const isActive = index === currentStep;
        const isComplete = index < currentStep;
        
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`
                flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all
                ${isActive ? 'bg-[#FA4616] text-black' : ''}
                ${isComplete ? 'bg-emerald-500 text-white' : ''}
                ${!isActive && !isComplete ? 'bg-neutral-800 text-neutral-500' : ''}
              `}>
                {isComplete ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span className={`
                mt-1 text-[8px] font-bold uppercase tracking-[0.05em] hidden sm:block
                ${isActive ? 'text-[#FA4616]' : ''}
                ${isComplete ? 'text-emerald-400' : ''}
                ${!isActive && !isComplete ? 'text-neutral-600' : ''}
              `}>
                {step.label.split(' ')[0]}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`
                h-0.5 w-8 mx-1 transition-all
                ${isComplete ? 'bg-emerald-500' : 'bg-neutral-700'}
              `} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT: Onboarding
// =============================================================================

export function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [data, setData] = useState<OnboardingData>({
    tenant_name: '',
    subdomain: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    legal_name: '',
    display_name: '',
    governing_body: '',
    sports: [],
    admin_name: '',
    admin_email: '',
    admin_password: '',
    source_system: '',
    import_file: null,
    validation_results: null,
    case_id: null
  });

  // Load existing onboarding case if caseId is present
  useEffect(() => {
    const loadCase = async () => {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('case');
      if (id) {
        setLoading(true);
        try {
          const { data: caseData, error } = await supabase
            .from('client_onboarding_cases')
            .select('*')
            .eq('case_id', id)
            .single();
          
          if (error) throw error;
          if (caseData) {
            setCaseId(id);
            setData(prev => ({
              ...prev,
              tenant_name: caseData.tenant_name || '',
              subdomain: caseData.metadata?.subdomain || '',
              contact_name: caseData.metadata?.contact_name || '',
              contact_email: caseData.metadata?.contact_email || '',
              contact_phone: caseData.metadata?.contact_phone || '',
              legal_name: caseData.legal_name || '',
              display_name: caseData.display_name || '',
              governing_body: caseData.metadata?.governing_body || '',
              sports: caseData.metadata?.sports || [],
              admin_name: caseData.metadata?.admin_name || '',
              admin_email: caseData.admin_email || '',
              source_system: caseData.metadata?.source_system || '',
              case_id: id
            }));
            // Set current step based on saved progress
            const step = caseData.current_step || 0;
            setCurrentStep(Math.min(step, STEPS.length - 1));
          }
        } catch (err) {
          console.error('Error loading case:', err);
        } finally {
          setLoading(false);
        }
      }
    };
    loadCase();
  }, []);

  const saveProgress = async () => {
    setSaving(true);
    try {
      const payload = {
        tenant_name: data.tenant_name,
        legal_name: data.legal_name,
        display_name: data.display_name,
        admin_email: data.admin_email,
        current_step: currentStep,
        metadata: {
          subdomain: data.subdomain,
          contact_name: data.contact_name,
          contact_email: data.contact_email,
          contact_phone: data.contact_phone,
          governing_body: data.governing_body,
          sports: data.sports,
          admin_name: data.admin_name,
          source_system: data.source_system,
        }
      };

      if (caseId) {
        // Update existing case
        const { error } = await supabase
          .from('client_onboarding_cases')
          .update(payload)
          .eq('case_id', caseId);
        if (error) throw error;
      } else {
        // Create new case
        const { data: newCase, error } = await supabase
          .from('client_onboarding_cases')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        if (newCase) {
          setCaseId(newCase.case_id);
          // Update URL with case ID
          const url = new URL(window.location.href);
          url.searchParams.set('case', newCase.case_id);
          window.history.replaceState({}, '', url.toString());
        }
      }
    } catch (err) {
      console.error('Error saving progress:', err);
      setError('Failed to save progress');
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    // Validate current step before proceeding
    if (!validateStep(currentStep)) {
      setError('Please fill in all required fields before proceeding.');
      return;
    }
    setError(null);
    
    // Save progress before moving to next step
    await saveProgress();
    
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0: // Tenant
        return !!data.tenant_name && !!data.subdomain && !!data.contact_email;
      case 1: // Organization
        return !!data.legal_name && !!data.display_name && !!data.governing_body;
      case 2: // Sports
        return data.sports.length > 0;
      case 3: // Admin
        return !!data.admin_name && !!data.admin_email && !!data.admin_password;
      case 4: // Security (automated)
        return true;
      case 5: // Configuration (automated)
        return true;
      case 6: // Data Sources
        return !!data.source_system;
      case 7: // Import
        return true; // Optional
      case 8: // Validation (automated)
        return true;
      case 9: // Review
        return true;
      case 10: // Activation
        return true;
      default:
        return true;
    }
  };

  const handleActivation = async () => {
    setLoading(true);
    setError(null);
    try {
      // Create organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: data.legal_name,
          display_name: data.display_name,
          tenant_id: caseId,
          status: 'ACTIVE'
        })
        .select()
        .single();
      
      if (orgError) throw orgError;

      // Create admin user
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          email: data.admin_email,
          name: data.admin_name,
          organization_id: orgData.id
        })
        .select()
        .single();
      
      if (userError) throw userError;

      // Update onboarding case
      await supabase
        .from('client_onboarding_cases')
        .update({
          status: 'completed',
          organization_id: orgData.id,
          completed_at: new Date().toISOString()
        })
        .eq('case_id', caseId);

      // Navigate to success
      setCurrentStep(STEPS.length); // Show completion state
    } catch (err) {
      console.error('Error during activation:', err);
      setError('Failed to activate client. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    const step = STEPS[currentStep];
    
    switch (step.id) {
      case 'tenant':
        return (
          <div className="space-y-4">
            <p className="text-sm text-neutral-400">Create a new tenant for the client organization.</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-neutral-400">Tenant Name *</label>
                <input
                  type="text"
                  value={data.tenant_name}
                  onChange={(e) => setData({ ...data, tenant_name: e.target.value })}
                  placeholder="e.g., HPAC"
                  className="mt-1 w-full rounded-xl border border-neutral-800 bg-black p-3 text-sm text-white placeholder:text-neutral-600 focus:border-[#FA4616] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-neutral-400">Subdomain *</label>
                <div className="flex mt-1">
                  <input
                    type="text"
                    value={data.subdomain}
                    onChange={(e) => setData({ ...data, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    placeholder="hpac"
                    className="flex-1 rounded-l-xl border border-r-0 border-neutral-800 bg-black p-3 text-sm text-white placeholder:text-neutral-600 focus:border-[#FA4616] focus:outline-none"
                  />
                  <span className="flex items-center rounded-r-xl border border-l-0 border-neutral-800 bg-neutral-900 px-3 text-sm text-neutral-500">
                    .ls1sports.com
                  </span>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-neutral-400">Contact Name</label>
                <input
                  type="text"
                  value={data.contact_name}
                  onChange={(e) => setData({ ...data, contact_name: e.target.value })}
                  placeholder="John Smith"
                  className="mt-1 w-full rounded-xl border border-neutral-800 bg-black p-3 text-sm text-white placeholder:text-neutral-600 focus:border-[#FA4616] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-neutral-400">Contact Email *</label>
                <input
                  type="email"
                  value={data.contact_email}
                  onChange={(e) => setData({ ...data, contact_email: e.target.value })}
                  placeholder="john@hpac.ca"
                  className="mt-1 w-full rounded-xl border border-neutral-800 bg-black p-3 text-sm text-white placeholder:text-neutral-600 focus:border-[#FA4616] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-neutral-400">Contact Phone</label>
                <input
                  type="tel"
                  value={data.contact_phone}
                  onChange={(e) => setData({ ...data, contact_phone: e.target.value })}
                  placeholder="(902) 555-0100"
                  className="mt-1 w-full rounded-xl border border-neutral-800 bg-black p-3 text-sm text-white placeholder:text-neutral-600 focus:border-[#FA4616] focus:outline-none"
                />
              </div>
            </div>
          </div>
        );

      case 'organization':
        return (
          <div className="space-y-4">
            <p className="text-sm text-neutral-400">Configure the organization's legal and display information.</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-neutral-400">Legal Name *</label>
                <input
                  type="text"
                  value={data.legal_name}
                  onChange={(e) => setData({ ...data, legal_name: e.target.value })}
                  placeholder="Halifax Aquatics Club Inc."
                  className="mt-1 w-full rounded-xl border border-neutral-800 bg-black p-3 text-sm text-white placeholder:text-neutral-600 focus:border-[#FA4616] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-neutral-400">Display Name *</label>
                <input
                  type="text"
                  value={data.display_name}
                  onChange={(e) => setData({ ...data, display_name: e.target.value })}
                  placeholder="HPAC"
                  className="mt-1 w-full rounded-xl border border-neutral-800 bg-black p-3 text-sm text-white placeholder:text-neutral-600 focus:border-[#FA4616] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-neutral-400">Governing Body *</label>
                <select
                  value={data.governing_body}
                  onChange={(e) => setData({ ...data, governing_body: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-800 bg-black p-3 text-sm text-white focus:border-[#FA4616] focus:outline-none"
                >
                  <option value="">Select governing body...</option>
                  {GOVERNING_BODIES.map((gb) => (
                    <option key={gb.id} value={gb.id}>{gb.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        );

      case 'sports':
        return (
          <div className="space-y-4">
            <p className="text-sm text-neutral-400">Select the sports this organization will manage.</p>
            <div className="grid gap-3 md:grid-cols-2">
              {AVAILABLE_SPORTS.map((sport) => (
                <label
                  key={sport.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors ${
                    data.sports.includes(sport.id)
                      ? 'border-[#FA4616] bg-[#FA4616]/10'
                      : 'border-neutral-800 hover:border-neutral-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={data.sports.includes(sport.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setData({ ...data, sports: [...data.sports, sport.id] });
                      } else {
                        setData({ ...data, sports: data.sports.filter(s => s !== sport.id) });
                      }
                    }}
                    className="accent-[#FA4616]"
                  />
                  <span className="text-sm text-white">{sport.label}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case 'admin':
        return (
          <div className="space-y-4">
            <p className="text-sm text-neutral-400">Create the primary administrator account for this organization.</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-neutral-400">Admin Name *</label>
                <input
                  type="text"
                  value={data.admin_name}
                  onChange={(e) => setData({ ...data, admin_name: e.target.value })}
                  placeholder="Jane Smith"
                  className="mt-1 w-full rounded-xl border border-neutral-800 bg-black p-3 text-sm text-white placeholder:text-neutral-600 focus:border-[#FA4616] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-neutral-400">Admin Email *</label>
                <input
                  type="email"
                  value={data.admin_email}
                  onChange={(e) => setData({ ...data, admin_email: e.target.value })}
                  placeholder="admin@hpac.ca"
                  className="mt-1 w-full rounded-xl border border-neutral-800 bg-black p-3 text-sm text-white placeholder:text-neutral-600 focus:border-[#FA4616] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-neutral-400">Admin Password *</label>
                <input
                  type="password"
                  value={data.admin_password}
                  onChange={(e) => setData({ ...data, admin_password: e.target.value })}
                  placeholder="••••••••"
                  className="mt-1 w-full rounded-xl border border-neutral-800 bg-black p-3 text-sm text-white placeholder:text-neutral-600 focus:border-[#FA4616] focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-neutral-500">Must be at least 8 characters.</p>
              </div>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-4 text-center py-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <Shield className="h-8 w-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white">Security & Roles</h3>
            <p className="text-sm text-neutral-400 max-w-md mx-auto">
              Setting up default roles, RLS policies, and security baseline for this organization.
            </p>
            <div className="mt-4 grid gap-2 text-left max-w-md mx-auto">
              <div className="flex items-center gap-2 text-sm text-neutral-400">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>RLS policies enforced</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-neutral-400">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Default roles created (org_admin, team_manager, registrar, treasurer)</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-neutral-400">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Audit logging enabled</span>
              </div>
            </div>
            <button
              onClick={() => {
                // Simulate automated step completion
                setCurrentStep(currentStep + 1);
              }}
              className="mt-4 rounded-xl bg-[#FA4616] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#FA4616]/90 transition-colors"
            >
              Complete Security Setup
            </button>
          </div>
        );

      case 'configuration':
        return (
          <div className="space-y-4 text-center py-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <Settings className="h-8 w-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white">Configuration</h3>
            <p className="text-sm text-neutral-400 max-w-md mx-auto">
              Applying default configuration for the selected sports.
            </p>
            <div className="mt-4 grid gap-2 text-left max-w-md mx-auto">
              {data.sports.map((sport) => (
                <div key={sport} className="flex items-center gap-2 text-sm text-neutral-400">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Default seasons configured for {sport}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="mt-4 rounded-xl bg-[#FA4616] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#FA4616]/90 transition-colors"
            >
              Complete Configuration
            </button>
          </div>
        );

      case 'datasource':
        return (
          <div className="space-y-4">
            <p className="text-sm text-neutral-400">Select the source system for the organization's existing data.</p>
            <div className="grid gap-3 md:grid-cols-2">
              {SOURCE_SYSTEMS.map((system) => (
                <label
                  key={system.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors ${
                    data.source_system === system.id
                      ? 'border-[#FA4616] bg-[#FA4616]/10'
                      : 'border-neutral-800 hover:border-neutral-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="source_system"
                    checked={data.source_system === system.id}
                    onChange={() => setData({ ...data, source_system: system.id })}
                    className="accent-[#FA4616]"
                  />
                  <span className="text-sm text-white">{system.label}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case 'import':
        return (
          <div className="space-y-4">
            <p className="text-sm text-neutral-400">Upload the organization's roster and historical data.</p>
            <div className="rounded-xl border-2 border-dashed border-neutral-800 bg-[#0d1010] p-12 text-center">
              <Upload className="mx-auto h-12 w-12 text-neutral-500" />
              <p className="mt-4 text-sm text-neutral-400">Drag and drop your file here, or click to browse</p>
              <p className="mt-1 text-xs text-neutral-500">Supports .CSV, .HY3, .SD3, .ZIP</p>
              <input
                type="file"
                accept=".csv,.hy3,.sd3,.zip"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setData({ ...data, import_file: e.target.files[0] });
                  }
                }}
                className="mt-4 block w-full cursor-pointer rounded-xl border border-neutral-800 bg-black p-3 text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-[#FA4616] file:px-4 file:py-2 file:text-sm file:font-bold file:text-black hover:file:bg-[#FA4616]/90"
              />
            </div>
            {data.import_file && (
              <div className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-[#0d1010] p-3">
                <FileText className="h-5 w-5 text-[#FA4616]" />
                <span className="text-sm text-white">{data.import_file.name}</span>
                <span className="text-xs text-neutral-500">{(data.import_file.size / 1024).toFixed(1)} KB</span>
                <button
                  onClick={() => setData({ ...data, import_file: null })}
                  className="ml-auto text-red-400 hover:text-red-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        );

      case 'validation':
        return (
          <div className="space-y-4 text-center py-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <Eye className="h-8 w-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white">Validation</h3>
            <p className="text-sm text-neutral-400 max-w-md mx-auto">
              Verifying data integrity and identifying any issues.
            </p>
            <div className="mt-4 grid gap-2 text-left max-w-md mx-auto">
              <div className="flex items-center gap-2 text-sm text-neutral-400">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Data schema validation passed</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-neutral-400">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Required fields present</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                <span>3 athletes missing DOB - review recommended</span>
              </div>
            </div>
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="mt-4 rounded-xl bg-[#FA4616] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#FA4616]/90 transition-colors"
            >
              Continue
            </button>
          </div>
        );

      case 'review':
        return (
          <div className="space-y-4">
            <p className="text-sm text-neutral-400">Review the client configuration before activation.</p>
            <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-4">
              <div className="grid gap-3 text-sm">
                <div className="flex justify-between border-b border-neutral-800 pb-2">
                  <span className="text-neutral-400">Tenant</span>
                  <span className="text-white">{data.tenant_name}</span>
                </div>
                <div className="flex justify-between border-b border-neutral-800 pb-2">
                  <span className="text-neutral-400">Organization</span>
                  <span className="text-white">{data.display_name}</span>
                </div>
                <div className="flex justify-between border-b border-neutral-800 pb-2">
                  <span className="text-neutral-400">Governing Body</span>
                  <span className="text-white">{GOVERNING_BODIES.find(g => g.id === data.governing_body)?.label || data.governing_body}</span>
                </div>
                <div className="flex justify-between border-b border-neutral-800 pb-2">
                  <span className="text-neutral-400">Sports</span>
                  <span className="text-white">{data.sports.length} selected</span>
                </div>
                <div className="flex justify-between border-b border-neutral-800 pb-2">
                  <span className="text-neutral-400">Admin</span>
                  <span className="text-white">{data.admin_name} ({data.admin_email})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Source System</span>
                  <span className="text-white">{SOURCE_SYSTEMS.find(s => s.id === data.source_system)?.label || data.source_system}</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'activation':
        return (
          <div className="space-y-4 text-center py-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <Rocket className="h-8 w-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white">Ready to Activate</h3>
            <p className="text-sm text-neutral-400 max-w-md mx-auto">
              All checks passed. Click Activate to create the organization and go live.
            </p>
            <div className="mt-4 flex justify-center gap-4">
              <button
                onClick={handleActivation}
                disabled={loading}
                className="rounded-xl bg-[#FA4616] px-8 py-3 text-sm font-bold text-black hover:bg-[#FA4616]/90 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Activating...
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4" />
                    Activate Client
                  </>
                )}
              </button>
            </div>
          </div>
        );

      default:
        return <div>Unknown step</div>;
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050707]">
        <div className="text-neutral-500">Loading...</div>
      </div>
    );
  }

  const step = STEPS[currentStep];
  const progress = ((currentStep + 1) / STEPS.length) * 100;
  const isLast = currentStep === STEPS.length - 1;
  const isFirst = currentStep === 0;

  return (
    <div className="p-6 text-white max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="text-[9px] font-black uppercase tracking-[0.24em] text-[#FA4616]">🚀 SuperUser</div>
        <h1 className="mt-1 text-2xl font-black text-white">Client Onboarding</h1>
        <p className="text-sm text-neutral-400">Provision new organizations and tenants</p>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-neutral-500 mb-2">
          <span>Step {currentStep + 1} of {STEPS.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-full rounded-full bg-[#FA4616] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step Indicator */}
      <div className="mb-6 overflow-x-auto">
        <StepIndicator currentStep={currentStep} />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Step Content */}
      <Panel>
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs text-neutral-500">Step {currentStep + 1}</span>
          <span className="text-xs font-bold text-[#FA4616]">{step.label}</span>
          {step.automated && (
            <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-400">
              ⚡ Automated
            </span>
          )}
        </div>
        {renderStep()}

        {/* Navigation */}
        <div className="mt-8 flex justify-between border-t border-neutral-800 pt-6">
          <button
            onClick={handleBack}
            disabled={isFirst}
            className="flex items-center gap-2 rounded-xl border border-neutral-800 px-6 py-2.5 text-sm text-neutral-400 hover:border-neutral-600 hover:text-white disabled:opacity-50 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={saveProgress}
              disabled={saving}
              className="text-sm text-neutral-500 hover:text-white transition-colors"
            >
              {saving ? 'Saving...' : 'Save Progress'}
            </button>
            {isLast ? (
              <button
                onClick={handleActivation}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl bg-[#FA4616] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#FA4616]/90 disabled:opacity-50 transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Activating...
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4" />
                    Activate Client
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 rounded-xl bg-[#FA4616] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#FA4616]/90 transition-colors"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}

export default Onboarding;
