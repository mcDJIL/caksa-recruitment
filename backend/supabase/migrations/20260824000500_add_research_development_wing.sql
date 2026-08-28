insert into public.interested_wings (code, name, sort_order)
values ('research-development', 'Research & Development', 3)
on conflict (code) do update
set name = excluded.name,
    sort_order = excluded.sort_order;

alter table public.divisions
  drop constraint if exists divisions_pkey;

alter table public.divisions
  add primary key (code, interested_wing_code);

insert into public.divisions (code, name, interested_wing_code, sort_order)
values
  ('electrical', 'Electrical', 'research-development', 1),
  ('mechanical', 'Mechanical', 'research-development', 2),
  ('programming', 'Programming', 'research-development', 3)
on conflict (code, interested_wing_code) do nothing;

delete from public.divisions
where code = 'research-development'
  and interested_wing_code = 'technical'
  and not exists (
    select 1
    from public.recruitment_applications
    where division_code = 'research-development'
      and interested_wing_code = 'technical'
  );
