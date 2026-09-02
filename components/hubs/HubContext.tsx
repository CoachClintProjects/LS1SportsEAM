'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { usePathname } from 'next/navigation';

export type HubType =
  | 'superuser'
  | 'athlete'
  | 'parent'
  | 'coach'
  | 'admin'
  | 'official'
  | 'scout';

export interface HubDefinition {
  id: HubType;
  name: string;
  description: string;
  codeLane: string;
}

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

export interface HubContextType {
  activeHub: HubDefinition;
  activeHubId: HubType;
  currentHub: HubDefinition;
  setActiveHub: (hub: HubType) => void;
  hubs: HubDefinition[];
}

export const HubContext =
  createContext<HubContextType | undefined>(undefined);

const HUB_IDS = new Set<HubType>([
  'superuser',
  'athlete',
  'parent',
  'coach',
  'admin',
  'official',
  'scout',
]);

function resolveHubFromPath(pathname: string | null | undefined): HubType {
  const segment = pathname?.split('/').filter(Boolean)[0]?.toLowerCase() as HubType | undefined;
  return segment && HUB_IDS.has(segment) ? segment : 'superuser';
}

export function HubProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const routeHub = resolveHubFromPath(pathname);
  const [activeHubId, setActiveHubId] = useState<HubType>(routeHub);

  // The URL is authoritative for the active operating hub. This prevents a
  // direct /athlete load, browser refresh, back/forward navigation or pasted
  // deep-link from retaining the previous hub's sidebar and shell context.
  useEffect(() => {
    setActiveHubId(routeHub);
  }, [routeHub]);

  const selectedHub = useMemo(
    () => hubs.find((hub) => hub.id === activeHubId) ?? hubs[0],
    [activeHubId],
  );

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

export function useHub(): HubContextType {
  const context = useContext(HubContext);

  if (!context) {
    throw new Error('useHub must be used within HubProvider');
  }

  return context;
}
