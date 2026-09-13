alter table public.recruitment_applications
  drop constraint if exists recruitment_applications_electrical_acceptance_priority_check;

alter table public.recruitment_applications
  add constraint recruitment_applications_electrical_acceptance_priority_check check (
    acceptance_priority is null
    or (
      division_code = 'electrical'
      and acceptance_priority in ('HIGH', 'MEDIUM', 'LOW', 'NOT_RECOMMENDED')
    )
  );
