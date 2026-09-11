alter table public.recruitment_applications
  add column if not exists idea_score smallint,
  add column if not exists relevance_score smallint,
  add column if not exists skills_experience_achievements_score smallint,
  add column if not exists identity_contact_score smallint,
  add column if not exists portfolio_score smallint,
  add column if not exists total_score smallint;

alter table public.recruitment_applications
  drop constraint if exists recruitment_applications_scores_check;

alter table public.recruitment_applications
  add constraint recruitment_applications_scores_check check (
    (idea_score is null or idea_score between 0 and 30) and
    (relevance_score is null or relevance_score between 0 and 20) and
    (skills_experience_achievements_score is null or skills_experience_achievements_score between 0 and 20) and
    (identity_contact_score is null or identity_contact_score between 0 and 5) and
    (portfolio_score is null or portfolio_score between 0 and 15) and
    (total_score is null or total_score between 0 and 90)
  );
