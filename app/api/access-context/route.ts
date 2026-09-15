import { NextRequest, NextResponse } from 'next/server';
import { resolveAccess } from '@/lib/server/accessControl';

export async function GET(request:NextRequest){
 const context=await resolveAccess(request);
 if(!context)return NextResponse.json({error:'Authentication required or session expired.'},{status:401,headers:{'Cache-Control':'no-store'}});
 return NextResponse.json({authenticated:true,...context},{headers:{'Cache-Control':'no-store'}});
}
