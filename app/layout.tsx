import React, { Suspense } from 'react';
import { Lexend_Deca } from 'next/font/google';
const workspaceFont = Lexend_Deca({subsets:['latin'],weight:['400','500','600','700'],display:'swap'});
import '@/app/globals.css';

import { GlobalShell } from '@/components/experience/GlobalShell/GlobalShell';
import { GlobalHeader } from '@/components/experience/GlobalHeader/GlobalHeader';
import { HubProvider } from '@/components/hubs/HubContext';
import { HubSidebar } from '@/components/hubs/HubSidebar';

// =====================================================
// LS1Sports Root Layout
//
// SECTION: RESPONSIBILITY
// - Establish application document.
// - Mount HubProvider.
// - Mount Global Header.
// - Mount contextual Hub navigation.
// - Establish full viewport application frame.
// =====================================================

// =====================================================
// SECTION: DOCUMENT METADATA
// =====================================================

export const metadata = {
  title: 'LS1Sports',
  description: 'LS1Sports Sports ERP Intelligence',
};

function NavigationFallback() {
  return <div className="h-full w-full bg-[#080909]" aria-hidden="true" />;
}

// =====================================================
// SECTION: ROOT LAYOUT
// =====================================================

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={workspaceFont.style} className="h-screen w-screen overflow-hidden bg-[#0A0C10]">
        {/* =================================================
            SECTION: HUB CONTEXT
            ================================================= */}

        <HubProvider>
          {/* ===============================================
              SECTION: GLOBAL APPLICATION SHELL
              =============================================== */}

          <Suspense fallback={<NavigationFallback />}>
          <GlobalShell
            header={<GlobalHeader />}
            navigation={
              <Suspense fallback={<NavigationFallback />}>
                <HubSidebar />
              </Suspense>
            }
          >
            {/* =============================================
                SECTION: PRIMARY WORKSPACE
                ============================================= */}

            {children}
          </GlobalShell>
          </Suspense>
        </HubProvider>
      </body>
    </html>
  );
}
