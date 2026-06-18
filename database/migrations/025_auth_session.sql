-- Server-side session tracking for the regular-user (type=3) device limit.
-- Each successful login/register/google/link creates a row; the JWT carries the
-- session_id (sid). Middleware validates the sid is still active per request.
-- Max 2 sessions per user is enforced in application code (oldest evicted).
CREATE TABLE IF NOT EXISTS auth_session
(
    id           serial PRIMARY KEY,
    user_id      integer     NOT NULL
        REFERENCES managerial_auth ON DELETE CASCADE,
    session_id   varchar(64) NOT NULL UNIQUE,
    user_agent   varchar(255),
    ip           varchar(64),
    created_at   timestamp DEFAULT now(),
    last_seen_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_session_user_created
    ON auth_session (user_id, created_at);
