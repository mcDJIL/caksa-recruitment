create or replace function public.publish_application_statuses()
returns integer
language plpgsql
set search_path = public
as $$
declare
  published_count integer;
begin
  update public.recruitment_applications
  set status = draft_status::public.recruitment_application_status,
      draft_status = null
  where draft_status is not null;

  get diagnostics published_count = row_count;
  return published_count;
end;
$$;

revoke all on function public.publish_application_statuses() from public;
grant execute on function public.publish_application_statuses() to service_role;
