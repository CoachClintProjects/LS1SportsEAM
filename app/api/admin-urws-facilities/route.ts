import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AdminAuthError } from '@/lib/server/requireAdmin';
import { adminRest } from '@/lib/server/adminRest';

export const dynamic='force-dynamic';
export const revalidate=0;
type Row=Record<string,any>;

export async function GET(request:NextRequest){
  try{
    const actor=await requireAdmin(request);
    const snapshot=await adminRest<Row>(actor,'rpc/admin_urws_facility_snapshot',{method:'POST',body:'{}'});
    return NextResponse.json(snapshot||{facilities:[],closures:[],bookings:[]},{headers:{'Cache-Control':'no-store, max-age=0'}});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:'Facility URWS context unavailable.'},{status:error instanceof AdminAuthError?error.status:500});
  }
}
