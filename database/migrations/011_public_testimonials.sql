CREATE TABLE IF NOT EXISTS public_testimonial (
    feedback_id VARCHAR(255) PRIMARY KEY
        REFERENCES feedbacks(id) ON DELETE CASCADE,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER,
    updated_at  INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER
);

CREATE INDEX IF NOT EXISTS idx_public_testimonial_active_sort
    ON public_testimonial (is_active, sort_order, feedback_id);
