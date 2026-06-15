CREATE TABLE IF NOT EXISTS public_featured_course (
    course_id   INTEGER PRIMARY KEY
        REFERENCES course(id) ON DELETE CASCADE,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER,
    updated_at  INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER
);

CREATE INDEX IF NOT EXISTS idx_public_featured_course_active_sort
    ON public_featured_course (is_active, sort_order, course_id);
