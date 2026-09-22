'use client';
import {useEffect} from 'react';
import {useParams,useRouter} from 'next/navigation';
const map:Record<string,string>={squads:'roster',rosters:'roster',attendance:'attendance',training:'training',workouts:'training',deployment:'training',competition:'planning',performance:'performance',development:'development',deck:'attendance',community:'notes',library:'training','video-analysis':'performance'};
export default function CoachSectionPage(){const params=useParams<{section:string[]}>(),router=useRouter();useEffect(()=>{const section=Array.isArray(params?.section)?params.section[0]:'';router.replace('/coach?view='+(map[section]||'command-center'))},[params,router]);return <main className="p-8 text-neutral-400">Opening Coach workspace…</main>}
