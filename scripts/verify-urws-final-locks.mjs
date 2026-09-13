import fs from 'node:fs';
const must=(p,needles)=>{const s=fs.readFileSync(p,'utf8');for(const n of needles)if(!s.includes(n))throw new Error(`${p} missing ${n}`)};
must('supabase/migrations/20260913165000_build_family_guardian_authority_urws.sql',['family_authority_assignments','family.guardian_authority.disputed','guardian_authority_dispute']);
must('supabase/migrations/20260913190000_build_urws_attendance_assets_and_correction_bridges.sql',['assets.loss_or_damage','equipment_loss_damage','urws_record_corrections','records.correction.requested','record_correction']);
must('supabase/migrations/20260913191500_build_restricted_safeguarding_urws_bridge.sql',['urws_restricted_case_links','safeguarding.referral','never_copy_details','restricted boolean']);
console.log('URWS final scenario locks passed.');