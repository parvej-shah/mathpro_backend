-- Indexes for the progress table to speed up leaderboard aggregation
-- and dashboard progress counts (both do user-scoped and module-scoped joins).
CREATE INDEX IF NOT EXISTS idx_progress_user   ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_module ON progress(module_id);
