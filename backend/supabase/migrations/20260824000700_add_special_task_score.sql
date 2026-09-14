alter table public.recruitment_applications
  add column if not exists special_task_score smallint;

alter table public.recruitment_applications
  drop constraint if exists recruitment_applications_scores_check;

alter table public.recruitment_applications
  add constraint recruitment_applications_scores_check check (
    (idea_score is null or idea_score between 0 and 30) and
    (relevance_score is null or relevance_score between 0 and 20) and
    (skills_experience_achievements_score is null or skills_experience_achievements_score between 0 and 20) and
    (identity_contact_score is null or identity_contact_score between 0 and 5) and
    (portfolio_score is null or portfolio_score between 0 and 15) and
    (special_task_score is null or special_task_score between 0 and 10) and
    (total_score is null or total_score between 0 and 100)
  );
