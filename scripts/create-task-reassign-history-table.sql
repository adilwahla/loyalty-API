-- Create task_reassign_history table
CREATE TABLE IF NOT EXISTS `task_reassign_history` (
  `id` CHAR(36) NOT NULL,
  `task_id` CHAR(36) NOT NULL,
  `old_user_id` CHAR(36) NOT NULL,
  `new_user_id` CHAR(36) NOT NULL,
  `new_end_date` DATE NULL,
  `reason` TEXT NULL,
  `changed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_task_id` (`task_id`),
  INDEX `idx_old_user_id` (`old_user_id`),
  INDEX `idx_new_user_id` (`new_user_id`),
  INDEX `idx_changed_at` (`changed_at`),
  CONSTRAINT `fk_task_reassign_history_task` 
    FOREIGN KEY (`task_id`) 
    REFERENCES `tasks` (`id`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE,
  CONSTRAINT `fk_task_reassign_history_old_user` 
    FOREIGN KEY (`old_user_id`) 
    REFERENCES `users` (`id`) 
    ON DELETE RESTRICT 
    ON UPDATE CASCADE,
  CONSTRAINT `fk_task_reassign_history_new_user` 
    FOREIGN KEY (`new_user_id`) 
    REFERENCES `users` (`id`) 
    ON DELETE RESTRICT 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

