import { NextRequest, NextResponse } from 'next/server';
import { requireSuperUser, SuperUserAuthError } from '@/lib/server/requireSuperUser';

const URL=process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
export const dynamic='force-dynamic';
export const revalidate=0;

type ScopeRow={id:string;scope_key:string;name:string;description:string|null;status:string};
type ScopeMilestoneRow={milestone_id:string;required:boolean;display_mode:string;sort_order:number};
async function rest<T>(path:string):Promise<T>{if(!URL||!KEY)throw new Error('Supabase service credentials are not configured.');const response=await fetch(`${URL}/rest/v1/${path}`,{headers:{apikey:KEY,Authorization:`Bearer ${KEY}`,Accept:'application/json'},cache:'no-store'});const text=await response.text();if(!response.ok)throw new Error(`Delivery-scope request failed (${response.status}): ${text.slice(0,300)}`);return(text?JSON.parse(text):[]) as T}
export async function GET(request:NextRequest){try{await requireSuperUser(request);const scopes=await rest<ScopeRow[]>('platform_delivery_scopes?scope_key=eq.superuser-team-engine&status=eq.active&select=id,scope_key,name,description,status&limit=1');const scope=scopes[0]||null;if(!scope)return NextResponse.json({error:'Active Super User / Team Engine delivery scope is not configured.'},{status:404});const milestones=await rest<ScopeMilestoneRow[]>(`platform_delivery_scope_milestones?scope_id=eq.${encodeURIComponent(scope.id)}&select=milestone_id,required,display_mode,sort_order&order=sort_order.asc`);return NextResponse.json({scope,milestones,requiredMilestoneIds:milestones.filter(item=>item.required).map(item=>item.milestone_id),roadmapMilestoneIds:milestones.filter(item=>!item.required).map(item=>item.milestone_id),generatedAt:new Date().toISOString(),source:'LS1SportsEAM delivery scope'},{headers:{'Cache-Control':'no-store, max-age=0, must-revalidate'}})}catch(error){if(error instanceof SuperUserAuthError)return NextResponse.json({error:error.message},{status:error.status});return NextResponse.json({error:error instanceof Error?error.message:'Delivery scope unavailable.'},{status:500})}}
