const sequelize = require('../config/database');

async function run() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    await sequelize.query('DROP TRIGGER IF EXISTS trg_users_after_insert_activation_task');
    await sequelize.query('DROP TRIGGER IF EXISTS trg_users_after_update_activation_task');
    await sequelize.query('DROP PROCEDURE IF EXISTS sp_sync_activation_task_for_group');

    await sequelize.query(`
      CREATE PROCEDURE sp_sync_activation_task_for_group(
        IN p_group_id VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
        IN p_fallback_rep_code VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
      )
      BEGIN
        DECLARE v_rep_code VARCHAR(255) DEFAULT NULL;
        DECLARE v_assignee_user_id CHAR(36) DEFAULT NULL;
        DECLARE v_has_location INT DEFAULT 0;

        IF p_group_id IS NOT NULL AND p_group_id <> '' THEN
          SELECT COUNT(*) INTO v_has_location
          FROM users u
          WHERE u.role = 'BUSINESS_OWNER'
            AND (
              u.parent_cust_id COLLATE utf8mb4_unicode_ci = p_group_id COLLATE utf8mb4_unicode_ci
              OR u.bsg_cust_id COLLATE utf8mb4_unicode_ci = p_group_id COLLATE utf8mb4_unicode_ci
            )
            AND u.latitude IS NOT NULL
            AND u.longitude IS NOT NULL;

          IF v_has_location > 0 THEN
            UPDATE tasks
            SET taskStatus = 'Completed',
                completedAt = NOW(),
                updated_at = NOW()
            WHERE customerId COLLATE utf8mb4_unicode_ci = p_group_id COLLATE utf8mb4_unicode_ci
              AND taskTitle = 'Activate Customer Location'
              AND taskType = 'Promotion'
              AND taskStatus = 'Pending';
          ELSE
            SET v_rep_code = p_fallback_rep_code;

            IF v_rep_code IS NULL OR v_rep_code = '' THEN
              SELECT u.sales_rep_id
              INTO v_rep_code
              FROM users u
              WHERE u.role = 'BUSINESS_OWNER'
                AND (
                  u.parent_cust_id COLLATE utf8mb4_unicode_ci = p_group_id COLLATE utf8mb4_unicode_ci
                  OR u.bsg_cust_id COLLATE utf8mb4_unicode_ci = p_group_id COLLATE utf8mb4_unicode_ci
                )
                AND u.sales_rep_id IS NOT NULL
                AND u.sales_rep_id <> ''
              ORDER BY u.updatedAt DESC
              LIMIT 1;
            END IF;

            IF v_rep_code IS NOT NULL AND v_rep_code <> '' THEN
              SELECT u.id
              INTO v_assignee_user_id
              FROM users u
              WHERE u.role = 'SALES_REP'
                AND u.sales_rep_id COLLATE utf8mb4_unicode_ci = v_rep_code COLLATE utf8mb4_unicode_ci
              LIMIT 1;

              IF v_assignee_user_id IS NOT NULL AND v_assignee_user_id <> ''
                 AND NOT EXISTS (
                   SELECT 1
                   FROM tasks t
                   WHERE t.customerId COLLATE utf8mb4_unicode_ci = p_group_id COLLATE utf8mb4_unicode_ci
                     AND t.taskTitle = 'Activate Customer Location'
                     AND t.taskType = 'Promotion'
                     AND t.taskStatus = 'Pending'
                 ) THEN
                INSERT INTO tasks (
                  id,
                  user_id,
                  taskTitle,
                  taskType,
                  priority,
                  customerId,
                  customerName,
                  taskStatus,
                  dateTime,
                  description
                ) VALUES (
                  UUID(),
                  v_assignee_user_id,
                  'Activate Customer Location',
                  'Promotion',
                  'High',
                  p_group_id,
                  p_group_id,
                  'Pending',
                  NOW(),
                  'Auto-generated task for customer group first-time location activation.'
                );
              END IF;
            END IF;
          END IF;
        END IF;
      END
    `);

    await sequelize.query(`
      CREATE TRIGGER trg_users_after_insert_activation_task
      AFTER INSERT ON users
      FOR EACH ROW
      BEGIN
        IF NEW.role = 'BUSINESS_OWNER' THEN
          CALL sp_sync_activation_task_for_group(
            COALESCE(NEW.parent_cust_id, NEW.bsg_cust_id),
            NEW.sales_rep_id
          );
        END IF;
      END
    `);

    await sequelize.query(`
      CREATE TRIGGER trg_users_after_update_activation_task
      AFTER UPDATE ON users
      FOR EACH ROW
      BEGIN
        IF NEW.role = 'BUSINESS_OWNER' THEN
          CALL sp_sync_activation_task_for_group(
            COALESCE(NEW.parent_cust_id, NEW.bsg_cust_id),
            NEW.sales_rep_id
          );
        END IF;

        IF OLD.role = 'BUSINESS_OWNER'
           AND COALESCE(OLD.parent_cust_id, OLD.bsg_cust_id) <> COALESCE(NEW.parent_cust_id, NEW.bsg_cust_id) THEN
          CALL sp_sync_activation_task_for_group(
            COALESCE(OLD.parent_cust_id, OLD.bsg_cust_id),
            OLD.sales_rep_id
          );
        END IF;
      END
    `);

    console.log('✅ Auto-activation DB procedure + triggers created');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to setup auto-activation DB triggers:', err.message);
    process.exit(1);
  }
}

run();
