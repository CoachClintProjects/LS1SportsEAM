import {Suspense} from 'react';
import CoachWorkspace from '@/components/hubs/coach/CoachWorkspace';
export default function CoachPage(){return <Suspense fallback={<div className="p-6 text-white">Loading Coach Team Engine…</div>}><CoachWorkspace/></Suspense>}
