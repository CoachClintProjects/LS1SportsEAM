'use client';

// =====================================================
// LS1Sports Hub Context
//
// SECTION: RESPONSIBILITY
// - Define the seven primary human hubs.
// - Store active hub context.
// - Expose hub definitions to the experience engine.
//
// SECTION: NON-RESPONSIBILITIES
// - No database calls.
// - No authorization decisions.
// - No business-domain calculations.
// =====================================================

import React, {
  createContext,
  useContext,
  useState,
} from 'react';

// =====================================================
// SECTION: HUB TYPES
// =====================================================

export type HubType =
  | 'superuser'
  | 'athlete'
  | 'parent'
  | 'coach'
  | 'admin'
  | 'official'
  | 'scout';

// =====================================================
// SECTION: HUB DEFINITION
// =====================================================

export interface HubDefinition {
  id: HubType;
  name: string;
  description: string;
  codeLane: string;
}

// =====================================================
// SECTION: HUB DEFINITIONS
// =====================================================

export const hubs: HubDefinition[] = [
  {
    id: 'superuser',
    name: 'SuperUser',
    description:
      'Enterprise command, EAM/ERP control, security, finance, governance, intelligence, and system operations',
    codeLane: 'LANE 00',
  },
  {
    id: 'athlete',
    name: 'Athlete',
    description:
      'Longitudinal athlete development, performance, competition, wellbeing, records, and recruiting',
    codeLane: 'LANE 01',
  },
  {
    id: 'parent',
    name: 'Parent',
    description:
      'Family, athlete oversight, registration, finance, scheduling, compliance, and communication',
    codeLane: 'LANE 02',
  },
  {
    id: 'coach',
    name: 'Coach',
    description:
      'Team Manager, rosters, training, development, performance, attendance, and competition preparation',
    codeLane: 'LANE 03',
  },
  {
    id: 'admin',
    name: 'Admin',
    description:
      'Organization administration, registrar operations, Team Manager, finance, facilities, payroll, and compliance',
    codeLane: 'LANE 04',
  },
  {
    id: 'official',
    name: 'Official',
    description:
      'Credentials, certification, availability, assignments, conflicts, competition operations, and history',
    codeLane: 'LANE 05',
  },
  {
    id: 'scout',
    name: 'Scout',
    description:
      'Talent discovery, prospect pipelines, trajectory analysis, recruiting intelligence, and athlete dossiers',
    codeLane: 'LANE 06',
  },
];

// =====================================================
// SECTION: CONTEXT CONTRACT
// =====================================================

export interface HubContextType {
  activeHub: HubDefinition;
  activeHubId: HubType;
  currentHub: HubDefinition;
  setActiveHub: (hub: HubType) => void;
  hubs: HubDefinition[];
}

// =====================================================
// SECTION: CONTEXT
// =====================================================

export const HubContext =
  createContext<HubContextType | undefined>(undefined);

// =====================================================
// SECTION: PROVIDER
// =====================================================

export function HubProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeHubId, setActiveHubId] =
    useState<HubType>('superuser');

  // ===================================================
  // SECTION: ACTIVE HUB RESOLUTION
  // ===================================================

  const selectedHub =
    hubs.find((hub) => hub.id === activeHubId) ?? hubs[0];

  // ===================================================
  // SECTION: PROVIDER
  // ===================================================

  return (
    <HubContext.Provider
      value={{
        activeHub: selectedHub,
        activeHubId,
        currentHub: selectedHub,
        setActiveHub: setActiveHubId,
        hubs,
      }}
    >
      {children}
    </HubContext.Provider>
  );
}

// =====================================================
// SECTION: HOOK
// =====================================================

export function useHub(): HubContextType {
  const context = useContext(HubContext);

  if (!context) {
    throw new Error(
      'useHub must be used within HubProvider',
    );
  }

  return context;
}
