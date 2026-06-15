-- Server-side persistence for a student's single quiz attempt.
-- One row per (user_id, module_id) mirrors the `progress` one-attempt model.
-- `progress` already records THAT a quiz was submitted; this table records WHAT
-- the student answered + the graded verdict, so the answer reveal/explanation
-- survives reloads and other devices without relying on localStorage.
create table if not exists quiz_attempt
(
    user_id   integer not null
        constraint fk_quiz_attempt_user
            references managerial_auth
            on delete cascade,
    module_id integer not null
        constraint fk_quiz_attempt_module
            references module
            on delete cascade,
    answers   jsonb   not null,   -- { "0": "selected option text", "1": "..." }
    verdict   jsonb   not null,   -- [true, false, ...] per question index
    score     integer not null,
    timestamp integer not null,
    primary key (user_id, module_id)
);
