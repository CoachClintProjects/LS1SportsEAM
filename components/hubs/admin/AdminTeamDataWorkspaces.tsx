'use client';
import { AdminMasterDataActions } from './AdminMasterDataActions';
import { ProgramsView as ProgramsDirectory,TeamsView as TeamsDirectory,SeasonsView as SeasonsDirectory } from './AdminDataWorkspaces';
import { MembershipView as MembershipDirectory } from './AdminMembershipDirectory';
export function ProgramsView(){return <><div className="px-5 pt-5 lg:px-7"><AdminMasterDataActions area="programs"/></div><ProgramsDirectory/></>}
export function TeamsView(){return <><div className="px-5 pt-5 lg:px-7"><AdminMasterDataActions area="teams"/></div><TeamsDirectory/></>}
export function SeasonsView(){return <><div className="px-5 pt-5 lg:px-7"><AdminMasterDataActions area="seasons"/></div><SeasonsDirectory/></>}
export function MembershipView(){return <><div className="px-5 pt-5 lg:px-7"><AdminMasterDataActions area="membership"/></div><MembershipDirectory/></>}
