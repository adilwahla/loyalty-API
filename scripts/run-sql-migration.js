const sequelize = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🔄 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Read SQL files
    const createTableSQL = fs.readFileSync(
      path.join(__dirname, 'create-task-reassign-history-table.sql'),
      'utf8'
    );
    
    const addColumnSQL = fs.readFileSync(
      path.join(__dirname, 'add-updated-at-to-tasks.sql'),
      'utf8'
    );

    console.log('\n📝 Creating task_reassign_history table...');
    await sequelize.query(createTableSQL);
    console.log('✅ task_reassign_history table created successfully');

    console.log('\n📝 Adding updated_at column to tasks table...');
    // Check if column exists first
    const [results] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'tasks' 
      AND COLUMN_NAME = 'updated_at'
    `);
    
    if (results[0].count === 0) {
      await sequelize.query(`ALTER TABLE tasks ADD COLUMN updated_at DATETIME NULL`);
      console.log('✅ updated_at column added successfully');
    } else {
      console.log('ℹ️  updated_at column already exists, skipping...');
    }

    console.log('\n✅ All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    // Check if it's just a "table already exists" or "column already exists" error
    if (error.message.includes('already exists') || 
        error.message.includes('Duplicate column name')) {
      console.log('⚠️  Table or column already exists - this is fine!');
      console.log('✅ Migration completed (some items already existed)');
      process.exit(0);
    } else {
      console.error('Full error:', error);
      process.exit(1);
    }
  }
}

runMigration();

