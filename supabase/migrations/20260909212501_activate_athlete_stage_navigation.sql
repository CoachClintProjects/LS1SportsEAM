update public.hub_navigation
set path = case label
  when 'Overview' then '/athlete'
  when 'Passport' then '/athlete/passport'
  when 'Performance' then '/athlete/performance'
  when 'Training' then '/athlete/training'
  when 'Competition' then '/athlete/competitions'
  when 'Development' then '/athlete/development'
  when 'Goals' then '/athlete/goals'
  when 'Journey' then '/athlete/journey'
  when 'Health' then '/athlete/health'
  when 'Documents' then '/athlete/documents'
  when 'Media' then '/athlete/media'
  when 'Recruiting' then '/athlete/recruiting'
  when 'Skills' then '/athlete/skills'
  when 'Achievements' then '/athlete/achievements'
  else path end
where hub_id = 'athlete';

insert into public.hub_navigation (hub_id, nav_id, label, path, icon, description, sort_order, parent_id, is_active)
select 'athlete', gen_random_uuid(), v.label, v.path, v.icon, v.description, v.sort_order, null, true
from (values
  ('Calendar','/athlete/calendar','CalendarDays','Practices, meets and race days',45),
  ('Logbook','/athlete/logbook','NotebookPen','Athlete training and race reflections',85),
  ('Settings','/athlete/settings','Settings','Customize the Athlete Hub experience',900),
  ('Send Feedback','/athlete/feedback','MessageSquareMore','Help shape the LS1 Athlete experience',910)
) as v(label,path,icon,description,sort_order)
where not exists (
  select 1 from public.hub_navigation n where n.hub_id='athlete' and n.label=v.label
);
