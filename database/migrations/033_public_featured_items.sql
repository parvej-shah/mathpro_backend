CREATE TABLE IF NOT EXISTS public_featured_item (
    item_type   VARCHAR(20) NOT NULL
        CHECK (item_type IN ('course', 'bundle')),
    item_id     INTEGER NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER,
    updated_at  INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::INTEGER,
    PRIMARY KEY (item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_public_featured_item_active_sort
    ON public_featured_item (is_active, sort_order, item_type, item_id);

INSERT INTO public_featured_item (item_type, item_id, sort_order, is_active, created_at, updated_at)
SELECT 'course', course_id, sort_order, is_active, created_at, updated_at
FROM public_featured_course
ON CONFLICT (item_type, item_id) DO NOTHING;
