-- Correct initial athlete experience seed to canonical sport code SWIM.
-- The previous seed migration may be a no-op if the sport code is not SWIMMING.
insert into public.athlete_experience_rules (tenant_id,sport_id,code,name,age_min,age_max,feature_key,configuration,priority)
select t.id,s.id,v.code,v.name,v.age_min,v.age_max,'home',v.configuration,v.priority
from public.tenants t join public.sports s on s.code='SWIM' cross join (values
('AGE_5_8_HOME','5-8 Home Experience',5,8,jsonb_build_object('focus','fun'),10),
('AGE_9_12_HOME','9-12 Home Experience',9,12,jsonb_build_object('focus','guided-growth'),20),
('AGE_13_17_HOME','13-17 Home Experience',13,17,jsonb_build_object('focus','performance-awareness'),30),
('AGE_18_PLUS_HOME','18+ Home Experience',18,99,jsonb_build_object('focus','autonomy'),40)
) v(code,name,age_min,age_max,configuration,priority)
where t.code='HPAC' and not exists(select 1 from public.athlete_experience_rules r where r.tenant_id=t.id and r.code=v.code);
insert into public.athlete_challenges (tenant_id,sport_id,code,name,description,age_band,challenge_type,target_definition,reward_definition,active)
select t.id,s.id,v.code,v.name,v.description,v.age_band,v.challenge_type,v.target_definition,v.reward_definition,true
from public.tenants t join public.sports s on s.code='SWIM' cross join (values
('FIRST_WEEK','First Week Ready','Complete your first week of participation','5_8','attendance',jsonb_build_object('target',3,'unit','sessions'),jsonb_build_object('badge','FIRST_WEEK')),
('POOL_EXPLORER','Pool Explorer','Try three different swimming skills or activities','5_8','skill',jsonb_build_object('target',3,'unit','skills'),jsonb_build_object('badge','POOL_EXPLORER')),
('CONSISTENCY','Consistency Builder','Build a consistent training streak','9_12','attendance',jsonb_build_object('target',8,'unit','sessions'),jsonb_build_object('badge','CONSISTENCY')),
('PERSONAL_BEST','Personal Best','Improve a recorded performance','9_12','performance',jsonb_build_object('target',1,'unit','improvement'),jsonb_build_object('badge','PERSONAL_BEST')),
('OWN_YOUR_PLAN','Own Your Plan','Keep your development plan current','13_17','development',jsonb_build_object('target',1,'unit','plan_cycle'),jsonb_build_object('badge','OWN_YOUR_PLAN'))
) v(code,name,description,age_band,challenge_type,target_definition,reward_definition)
where t.code='HPAC' and not exists(select 1 from public.athlete_challenges c where c.tenant_id=t.id and c.code=v.code);