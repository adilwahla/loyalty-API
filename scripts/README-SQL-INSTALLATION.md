# How to Run SQL Scripts

Follow these steps to create the `task_reassign_history` table and add `updated_at` column to `tasks` table.

## Option 1: MySQL Command Line

1. Open terminal/command prompt
2. Connect to your MySQL database:
   ```bash
   mysql -u YOUR_USERNAME -p YOUR_DATABASE_NAME
   ```
   (Replace `YOUR_USERNAME` and `YOUR_DATABASE_NAME` with your actual values)

3. Run the SQL scripts:
   ```bash
   source scripts/create-task-reassign-history-table.sql
   source scripts/add-updated-at-to-tasks.sql
   ```

   OR copy and paste the SQL directly into the MySQL prompt.

## Option 2: MySQL Workbench (GUI Tool)

1. Open MySQL Workbench
2. Connect to your database
3. Open the SQL script file:
   - File → Open SQL Script → Select `scripts/create-task-reassign-history-table.sql`
4. Click the Execute button (⚡ lightning bolt icon) or press `Ctrl+Shift+Enter`
5. Repeat for `scripts/add-updated-at-to-tasks.sql`

## Option 3: phpMyAdmin (Web Interface)

1. Open phpMyAdmin in your browser
2. Select your database from the left sidebar
3. Click on the "SQL" tab
4. Copy and paste the SQL from `scripts/create-task-reassign-history-table.sql`
5. Click "Go" to execute
6. Repeat for `scripts/add-updated-at-to-tasks.sql`

## Option 4: Direct SQL (Copy-Paste)

Copy and paste this complete SQL into any MySQL client:

```sql
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

-- Add updated_at column to tasks table
ALTER TABLE `tasks` 
ADD COLUMN IF NOT EXISTS `updated_at` DATETIME NULL;
```

## Option 5: Using Node.js Script (Automated)

You can also create a simple Node.js script to run the SQL automatically.

## Verification

After running the SQL, verify the table was created:

```sql
SHOW TABLES LIKE 'task_reassign_history';
DESCRIBE task_reassign_history;
DESCRIBE tasks;  -- Check if updated_at column exists
```

## Troubleshooting

- **Error: Table already exists** - This is fine, the `IF NOT EXISTS` clause prevents errors
- **Error: Column already exists** - The `updated_at` column might already exist, which is fine
- **Error: Foreign key constraint fails** - Make sure `tasks` and `users` tables exist first

