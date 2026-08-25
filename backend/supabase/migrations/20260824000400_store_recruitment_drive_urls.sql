alter table public.recruitment_applications
  add column if not exists curriculum_vitae_url text,
  add column if not exists essay_url text,
  add column if not exists parent_permission_letter_url text,
  add column if not exists motivation_letter_url text,
