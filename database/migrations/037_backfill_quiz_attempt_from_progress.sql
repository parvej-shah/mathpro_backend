-- Backfill quiz_attempt rows for quiz attempts made before migration 015.
--
-- `progress` has always been the one-attempt lock that submitAttempt rejects
-- on, but quiz_attempt (015) records WHAT was answered. Attempts predating 015
-- left a progress row with no matching quiz_attempt row, so getAttempt reported
-- submitted:false — the client re-offered the exam and the submit was then
-- rejected as "Quiz already submitted".
--
-- Only the score survived in `progress`; the chosen answers and per-question
-- verdict were never stored, so those columns are backfilled empty. The reveal
-- for these rows shows the score without per-question feedback, which is
-- correct — the data does not exist.
--
-- Scoped to QUIZ modules only, and ON CONFLICT DO NOTHING keeps it idempotent
-- and non-destructive to real attempts recorded after 015.
insert into quiz_attempt (user_id, module_id, answers, verdict, score, timestamp)
select p.user_id,
       p.module_id,
       '{}'::jsonb,
       '[]'::jsonb,
       coalesce(p.point, 0),
       -- progress.point/timestamp are nullable, quiz_attempt's are NOT NULL.
       -- Without these coalesces a single legacy row with a null column aborts
       -- the whole backfill.
       coalesce(p.timestamp, 0)
from progress p
         join module m on m.id = p.module_id
where m.data ->> 'category' = 'QUIZ'
on conflict (user_id, module_id) do nothing;
