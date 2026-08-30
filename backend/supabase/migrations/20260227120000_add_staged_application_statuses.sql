alter table public.recruitment_applications
  add column if not exists draft_status text;

do $$
begin
  alter table public.recruitment_applications
    add constraint recruitment_applications_draft_status_check
    check (
      draft_status is null
      or draft_status in (
        'PENDING',
        'ADMINISTRATION',
        'INTERVIEW',
        'MEMBER',
        'NOT_SELECTED_ADMINISTRATION',
        'NOT_SELECTED_INTERVIEW'
      )
    );
exception
  when duplicate_object then null;
end;
$$;

create or replace function public.publish_application_statuses()
returns integer
language plpgsql
set search_path = public
as $$
declare
  published_count integer;
begin
  update public.recruitment_applications
  set status = draft_status,
      draft_status = null
  where draft_status is not null;

  get diagnostics published_count = row_count;
  return published_count;
end;
$$;

revoke all on function public.publish_application_statuses() from public;
grant execute on function public.publish_application_statuses() to service_role;
