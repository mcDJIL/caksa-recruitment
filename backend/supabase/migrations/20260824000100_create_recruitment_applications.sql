-- ============================================================
-- ENUM
-- ============================================================

create type public.recruitment_application_status as enum (
  'PENDING',
  'ADMINISTRATION',
  'INTERVIEW',
  'MEMBER',
  'NOT_SELECTED_ADMINISTRATION',
  'NOT_SELECTED_INTERVIEW'
);


-- ============================================================
-- DEGREE LEVELS
-- ============================================================

create table public.degree_levels (
  code text primary key,
  name text not null unique,
  sort_order smallint not null default 0
);


-- ============================================================
-- STUDY PROGRAMS
-- ============================================================

create table public.study_programs (
  code text primary key,
  name text not null unique,
  sort_order smallint not null default 0
);


-- ============================================================
-- RECRUITMENT BATCHES
-- ============================================================

create table public.recruitment_batches (
  year smallint primary key
    check (year between 2000 and 2100),

  is_open boolean not null default true
);


-- ============================================================
-- INTERESTED WINGS
-- ============================================================

create table public.interested_wings (
  code text primary key,
  name text not null unique,
  sort_order smallint not null default 0
);


-- ============================================================
-- DIVISIONS
-- ============================================================

create table public.divisions (
  code text primary key,

  name text not null,

  interested_wing_code text not null
    references public.interested_wings(code),

  sort_order smallint not null default 0,

  unique (code, interested_wing_code),

  unique (interested_wing_code, name)
);


-- ============================================================
-- SEED: DEGREE LEVELS
-- ============================================================

insert into public.degree_levels (
  code,
  name,
  sort_order
)
values
  ('D3', 'D3', 1),
  ('D4', 'D4', 2),
  ('LJ', 'LJ', 3),
  ('S2', 'S2', 4);


-- ============================================================
-- SEED: STUDY PROGRAMS
-- ============================================================

insert into public.study_programs (
  code,
  name,
  sort_order
)
values
  (
    'teknik-elektronika',
    'Teknik Elektronika',
    1
  ),
  (
    'teknik-telekomunikasi',
    'Teknik Telekomunikasi',
    2
  ),
  (
    'teknik-elektro-industri',
    'Teknik Elektro Industri',
    3
  ),
  (
    'teknologi-rekayasa-internet',
    'Teknologi Rekayasa Internet',
    4
  ),
  (
    'teknologi-rekayasa-keselamatan-k3',
    'Teknologi Rekayasa Keselamatan K3',
    5
  ),
  (
    'teknik-informatika',
    'Teknik Informatika',
    6
  ),
  (
    'teknik-komputer',
    'Teknik Komputer',
    7
  ),
  (
    'sains-data-terapan',
    'Sains Data Terapan',
    8
  ),
  (
    'teknik-mekatronika',
    'Teknik Mekatronika',
    9
  ),
  (
    'sistem-pembangkit-energi',
    'Sistem Pembangkit Energi',
    10
  ),
  (
    'teknologi-rekayasa-perancangan-manufaktur',
    'Teknologi Rekayasa Perancangan Manufaktur',
    11
  ),
  (
    'teknologi-game',
    'Teknologi Game',
    12
  ),
  (
    'teknologi-rekayasa-multimedia',
    'Teknologi Rekayasa Multimedia',
    13
  ),
  (
    'bisnis-digital',
    'Bisnis Digital',
    14
  );


-- ============================================================
-- SEED: RECRUITMENT BATCHES
-- ============================================================

insert into public.recruitment_batches (
  year
)
values
  (2024),
  (2025),
  (2026);


-- ============================================================
-- SEED: INTERESTED WINGS
-- ============================================================

insert into public.interested_wings (
  code,
  name,
  sort_order
)
values
  ('technical', 'Technical', 1),
  ('non-technical', 'Non-Technical', 2);


-- ============================================================
-- SEED: DIVISIONS
-- ============================================================

insert into public.divisions (
  code,
  name,
  interested_wing_code,
  sort_order
)
values
  (
    'electrical',
    'Electrical',
    'technical',
    1
  ),
  (
    'mechanical',
    'Mechanical',
    'technical',
    2
  ),
  (
    'programming',
    'Programming',
    'technical',
    3
  ),
  (
    'research-development',
    'Research & Development',
    'technical',
    4
  ),
  (
    'administration',
    'Administration',
    'non-technical',
    1
  ),
  (
    'branding',
    'Branding',
    'non-technical',
    2
  ),
  (
    'public-relations',
    'Public Relations',
    'non-technical',
    3
  ),
  (
    'project-management',
    'Project Management',
    'non-technical',
    4
  );


-- ============================================================
-- RECRUITMENT APPLICATIONS
-- ============================================================

create table public.recruitment_applications (

  -- ----------------------------------------------------------
  -- IDENTITY
  -- ----------------------------------------------------------

  id uuid primary key,


  -- ----------------------------------------------------------
  -- RECRUITMENT
  -- ----------------------------------------------------------

  recruitment_year smallint not null
    references public.recruitment_batches(year),

  batch_year smallint not null
    references public.recruitment_batches(year),


  -- ----------------------------------------------------------
  -- PERSONAL INFORMATION
  -- ----------------------------------------------------------

  email text not null,

  full_name text not null,

  nrp text not null,

  instagram text not null,


  -- ----------------------------------------------------------
  -- EDUCATION
  -- ----------------------------------------------------------

  degree_level_code text not null
    references public.degree_levels(code),

  study_program_code text not null
    references public.study_programs(code),


  -- ----------------------------------------------------------
  -- RECRUITMENT CHOICE
  -- ----------------------------------------------------------

  interested_wing_code text not null
    references public.interested_wings(code),

  division_code text not null,

  foreign key (
    division_code,
    interested_wing_code
  )
  references public.divisions (
    code,
    interested_wing_code
  ),


  -- ----------------------------------------------------------
  -- APPLICATION INFORMATION
  -- ----------------------------------------------------------

  referral_source text not null,

  why_caksa text not null,


  -- ----------------------------------------------------------
  -- USER-PROVIDED DRIVE LINKS
  -- ----------------------------------------------------------

  -- Portfolio is a link submitted by the applicant.
  portfolio_url text,

  -- Required only for Non-Technical
  -- Administration / Branding.
  special_task_url text,


  -- ----------------------------------------------------------
  -- FILES STORED IN CAKSA GOOGLE DRIVE
  -- ----------------------------------------------------------

  -- Required for everyone.
  curriculum_vitae_url text,

  -- Required for Technical.
  essay_url text,

  -- Required for Non-Technical.
  motivation_letter_url text,

  -- Required for everyone.
  parent_permission_letter_url text,


  -- ----------------------------------------------------------
  -- STATUS
  -- ----------------------------------------------------------

  status public.recruitment_application_status
    not null default 'PENDING',


  -- ----------------------------------------------------------
  -- GOOGLE DRIVE METADATA
  -- ----------------------------------------------------------

  file_metadata jsonb
    not null default '[]'::jsonb
    check (
      jsonb_typeof(file_metadata) = 'array'
    ),


  -- ----------------------------------------------------------
  -- TIMESTAMPS
  -- ----------------------------------------------------------

  created_at timestamptz
    not null default now(),

  updated_at timestamptz
    not null default now(),


  -- ----------------------------------------------------------
  -- UNIQUE CONSTRAINTS
  -- ----------------------------------------------------------

  unique (
    email
  ),

  unique (
    nrp
  )

);


-- ============================================================
-- INDEXES
-- ============================================================

create index recruitment_applications_status_idx
on public.recruitment_applications (status);


create index recruitment_applications_created_at_idx
on public.recruitment_applications (created_at desc);


create index recruitment_applications_wing_idx
on public.recruitment_applications (
  interested_wing_code
);


create index recruitment_applications_division_idx
on public.recruitment_applications (
  division_code
);


create index recruitment_applications_batch_idx
on public.recruitment_applications (
  recruitment_year
);


-- ============================================================
-- UPDATED_AT FUNCTION
-- ============================================================

create or replace function
public.set_recruitment_application_updated_at()

returns trigger

language plpgsql

security invoker

set search_path = public

as $$
begin

  new.updated_at = now();

  return new;

end;
$$;


-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create trigger recruitment_applications_updated_at

before update
on public.recruitment_applications

for each row

execute function
public.set_recruitment_application_updated_at();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.degree_levels
enable row level security;

alter table public.study_programs
enable row level security;

alter table public.recruitment_batches
enable row level security;

alter table public.interested_wings
enable row level security;

alter table public.divisions
enable row level security;

alter table public.recruitment_applications
enable row level security;


-- ============================================================
-- REMOVE DEFAULT API ACCESS
-- ============================================================

revoke all
on table
  public.degree_levels,
  public.study_programs,
  public.recruitment_batches,
  public.interested_wings,
  public.divisions,
  public.recruitment_applications
from anon, authenticated;


-- ============================================================
-- BACKEND SERVICE ROLE
-- ============================================================

grant all
on table
  public.degree_levels,
  public.study_programs,
  public.recruitment_batches,
  public.interested_wings,
  public.divisions,
  public.recruitment_applications
to service_role;
