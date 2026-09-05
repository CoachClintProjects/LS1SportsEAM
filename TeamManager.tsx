'use client';

// =============================================================================
// TEAM MANAGER - Roster Management with REAL Supabase Data
// =============================================================================

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { renderIconSync } from '@/lib/icons';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// =============================================================================
// TYPES
// =============================================================================

interface Athlete {
  id: string;
  athlete_number: string;
  person_id: string;
  status: string;
  people?: {
    first_name: string;
    last_name: string;
    date_of_birth: string;
    gender: string;
  };
}

// =============================================================================
// DRAWER COMPONENT
// =============================================================================

function AthleteDrawer({
  athlete,
  isOpen,
  onClose,
}: {
  athlete: Athlete | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen || !athlete) return null;

  const fullName = `${athlete.people?.first_name || ''} ${athlete.people?.last_name || ''}`.trim();
  const age = athlete.people?.date_of_birth
    ? new Date().getFullYear() - new Date(athlete.people.date_of_birth).getFullYear()
    : null;

  const XIcon = renderIconSync('x');
  const CheckCircle2Icon = renderIconSync('check-circle-2');
  const Edit2Icon = renderIconSync('edit-2');
  const MailIcon = renderIconSync('mail');

  return (
    <div className="fixed inset-0 z-50 bg-black/70" onClick={onClose}>
      <aside
        className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-neutral-800 bg-[#090b0b] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-neutral-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FA4616]/20 text-xl font-black text-[#FA4616]">
                {fullName.charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-black text-white">{fullName}</h2>
                <div className="text-sm text-neutral-400">
                  {athlete.athlete_number} · {age || '—'} · {athlete.people?.gender || '—'}
                </div>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg border border-neutral-800 p-2 hover:border-neutral-600 transition-colors">
            {XIcon}
          </button>
        </div>

        <div className="mt-6">
          <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-neutral-500">About</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-3">
              <div className="text-[10px] text-neutral-500">Status</div>
              <div className="flex items-center gap-1.5 text-sm font-bold text-white">
                {CheckCircle2Icon}
                {athlete.status || 'ACTIVE'}
              </div>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-[#0d1010] p-3">
              <div className="text-[10px] text-neutral-500">HPAC #</div>
              <div className="text-sm font-bold text-white">{athlete.athlete_number || '—'}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-2 border-t border-neutral-800 pt-6">
          <button className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#FA4616] px-4 py-2.5 text-sm font-bold text-black hover:bg-[#FA4616]/90 transition-colors">
            {Edit2Icon}
            Edit Profile
          </button>
          <button className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-neutral-800 px-4 py-2.5 text-sm text-white hover:border-neutral-600 transition-colors">
            {MailIcon}
            Email
          </button>
        </div>
      </aside>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function TeamManager() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const SearchIcon = renderIconSync('search');
  const PlusIcon = renderIconSync('plus');
  const DownloadIcon = renderIconSync('download');
  const FilterIcon = renderIconSync('filter');
  const ChevronDownIcon = renderIconSync('chevron-down');
  const EyeIcon = renderIconSync('eye');
  const Edit2Icon = renderIconSync('edit-2');

  // =========================================================================
  // LOAD REAL DATA FROM SUPABASE
  // =========================================================================
  useEffect(() => {
    loadAthletes();
  }, []);

  const loadAthletes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('athletes')
        .select(`
          id,
          person_id,
          athlete_number,
          status,
          people:person_id (
            first_name,
            last_name,
            date_of_birth,
            gender
          )
        `)
        .order('athlete_number', { ascending: true });

      if (error) throw error;
      setAthletes(data || []);
    } catch (error) {
      console.error('Error loading athletes:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAthletes = athletes.filter((a) => {
    const fullName = `${a.people?.first_name || ''} ${a.people?.last_name || ''}`.toLowerCase();
    const search = searchTerm.toLowerCase();
    return fullName.includes(search) || a.athlete_number?.toLowerCase().includes(search);
  });

  const paginatedAthletes = filteredAthletes.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalPages = Math.ceil(filteredAthletes.length / pageSize);

  const openDrawer = (athlete: Athlete) => {
    setSelectedAthlete(athlete);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedAthlete(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-emerald-400/10 text-emerald-400';
      case 'INACTIVE': return 'bg-neutral-400/10 text-neutral-400';
      case 'SUSPENDED': return 'bg-red-400/10 text-red-400';
      default: return 'bg-amber-400/10 text-amber-400';
    }
  };

  return (
    <div className="p-6 text-white">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.24em] text-[#FA4616]">👥 Team Manager</div>
          <h1 className="mt-1 text-2xl font-black text-white">Roster Management</h1>
          <p className="text-sm text-neutral-400">{athletes.length} HPAC swimmers</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 rounded-xl border border-neutral-800 px-4 py-2 text-sm text-neutral-400 hover:border-neutral-600 hover:text-white transition-colors">
            {DownloadIcon} Export
          </button>
          <button className="flex items-center gap-2 rounded-xl bg-[#FA4616] px-4 py-2 text-sm font-bold text-black hover:bg-[#FA4616]/90 transition-colors">
            {PlusIcon} Add Swimmer
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">{SearchIcon}</span>
          <input
            type="text"
            placeholder="Search swimmers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-neutral-800 bg-[#090b0b] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-neutral-500 focus:border-[#FA4616] focus:outline-none"
          />
        </div>
        <button className="flex items-center gap-2 rounded-xl border border-neutral-800 px-4 py-2.5 text-sm text-neutral-400 hover:border-neutral-600 hover:text-white transition-colors">
          {FilterIcon} Filter
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-[#090b0b]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              <th className="px-4 py-3">HPAC #</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-neutral-500">Loading HPAC swimmers...</td></tr>
            ) : paginatedAthletes.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-neutral-500">No swimmers found</td></tr>
            ) : (
              paginatedAthletes.map((athlete) => {
                const fullName = `${athlete.people?.first_name || ''} ${athlete.people?.last_name || ''}`.trim();
                return (
                  <tr key={athlete.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors cursor-pointer" onClick={() => openDrawer(athlete)}>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-400">{athlete.athlete_number || '—'}</td>
                    <td className="px-4 py-3 font-medium text-white">{fullName || '—'}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${getStatusColor(athlete.status || 'ACTIVE')}`}>{athlete.status || 'ACTIVE'}</span></td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={(e) => { e.stopPropagation(); openDrawer(athlete); }} className="mr-2 rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-white transition-colors">{EyeIcon}</button>
                      <button onClick={(e) => { e.stopPropagation(); }} className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-white transition-colors">{Edit2Icon}</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-neutral-500">Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, filteredAthletes.length)} of {filteredAthletes.length}</div>
        <div className="flex gap-1">
          <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="rounded-lg border border-neutral-800 px-3 py-1.5 text-sm text-neutral-400 disabled:opacity-50 hover:border-neutral-600 hover:text-white transition-colors"><ChevronLeft className="h-4 w-4" /></button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            const pageNum = i + 1;
            return <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`rounded-lg px-3 py-1.5 text-sm ${currentPage === pageNum ? 'bg-[#FA4616] text-black font-bold' : 'border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white'}`}>{pageNum}</button>;
          })}
          <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="rounded-lg border border-neutral-800 px-3 py-1.5 text-sm text-neutral-400 disabled:opacity-50 hover:border-neutral-600 hover:text-white transition-colors"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <AthleteDrawer athlete={selectedAthlete} isOpen={isDrawerOpen} onClose={closeDrawer} />
    </div>
  );
}

export default TeamManager;
