const sequelize = require('../config/database');

async function columnExists(table, column) {
  const [rows] = await sequelize.query(
    `
      SELECT COUNT(*) AS count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table
        AND COLUMN_NAME = :column
    `,
    { replacements: { table, column } }
  );
  return Number(rows?.[0]?.count || 0) > 0;
}

async function indexExists(table, indexName) {
  const [rows] = await sequelize.query(
    `
      SELECT COUNT(*) AS count
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table
        AND INDEX_NAME = :indexName
    `,
    { replacements: { table, indexName } }
  );
  return Number(rows?.[0]?.count || 0) > 0;
}

async function run() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    if (!(await columnExists('users', 'parent_cust_id'))) {
      await sequelize.query('ALTER TABLE users ADD COLUMN parent_cust_id VARCHAR(255) NULL');
      console.log('✅ Added users.parent_cust_id');
    }

    if (!(await indexExists('users', 'idx_users_parent_cust_id'))) {
      await sequelize.query('CREATE INDEX idx_users_parent_cust_id ON users (parent_cust_id)');
      console.log('✅ Added idx_users_parent_cust_id');
    }

    if (!(await indexExists('users', 'idx_users_bsg_cust_id'))) {
      await sequelize.query('CREATE INDEX idx_users_bsg_cust_id ON users (bsg_cust_id)');
      console.log('✅ Added idx_users_bsg_cust_id');
    }

    // Step 1: Safe baseline for BUSINESS_OWNER only
    await sequelize.query(`
      UPDATE users
      SET parent_cust_id = bsg_cust_id
      WHERE role = 'BUSINESS_OWNER'
        AND bsg_cust_id IS NOT NULL
        AND parent_cust_id IS NULL
    `);
    console.log('✅ Backfill step 1 complete (self parent for null rows)');

    // Step 2: If a primary account exists (has password),
    // force all BO rows with same phone_number to use that primary bsg_cust_id.
    await sequelize.query('DROP TEMPORARY TABLE IF EXISTS tmp_bo_primary_parent');
    await sequelize.query(`
      CREATE TEMPORARY TABLE tmp_bo_primary_parent AS
      SELECT ranked.phone_key, ranked.bsg_cust_id AS primary_bsg
      FROM (
        SELECT
          bsg_cust_id,
          COALESCE(TRIM(phone_number), '') AS phone_key,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(TRIM(phone_number), '')
            ORDER BY
              (password IS NOT NULL AND password <> '') DESC,
              updatedAt DESC,
              createdAt ASC
          ) AS rn
        FROM users
        WHERE role = 'BUSINESS_OWNER'
          AND bsg_cust_id IS NOT NULL
          AND phone_number IS NOT NULL
          AND TRIM(phone_number) <> ''
      ) ranked
      WHERE ranked.rn = 1
        AND EXISTS (
          SELECT 1
          FROM users p
          WHERE p.role = 'BUSINESS_OWNER'
            AND COALESCE(TRIM(p.phone_number), '') = ranked.phone_key
            AND p.password IS NOT NULL
            AND p.password <> ''
        )
    `);

    await sequelize.query(`
      UPDATE users u
      JOIN tmp_bo_primary_parent g
        ON COALESCE(TRIM(u.phone_number), '') = g.phone_key
      SET u.parent_cust_id = g.primary_bsg
      WHERE u.role = 'BUSINESS_OWNER'
        AND u.bsg_cust_id IS NOT NULL
        AND u.phone_number IS NOT NULL
        AND TRIM(u.phone_number) <> ''
    `);
    await sequelize.query('DROP TEMPORARY TABLE IF EXISTS tmp_bo_primary_parent');
    console.log('✅ Backfill step 2 complete (phone unified to primary password account)');

    console.log('✅ Parent location migration completed');
    process.exit(0);
  } catch (err) {
    console.error('❌ Parent location migration failed:', err.message);
    process.exit(1);
  }
}

run();
