alter table public.recruitment_applications
  drop constraint if exists recruitment_applications_study_program_code_degree_level_code_fkey;

alter table public.study_programs
  drop constraint if exists study_programs_code_degree_level_code_key;

alter table public.study_programs
  drop column if exists degree_level_code;