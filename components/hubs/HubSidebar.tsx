'use client';

// =====================================================
// LS1Sports Hub Sidebar
//
// SECTION: RESPONSIBILITY
// - Provide the persistent contextual navigation rail.
// =====================================================

import React from 'react';
import { HubNavigation } from '@/components/experience/HubNavigation/HubNavigation';

// =====================================================
// SECTION: COMPONENT
// =====================================================

export function HubSidebar() {
  return (
    <aside className="h-full w-full">
      <HubNavigation />
    </aside>
  );
}
