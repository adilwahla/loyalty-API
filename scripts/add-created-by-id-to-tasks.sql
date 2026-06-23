-- Add created_by_id to tasks (nullable; existing rows stay NULL)
ALTER TABLE tasks
  ADD COLUMN created_by_id CHAR(36) NULL,
  ADD INDEX idx_tasks_created_by_id (created_by_id);
