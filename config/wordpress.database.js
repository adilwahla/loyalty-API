// config/wordpress.database.js

require('dotenv').config();
const { Sequelize } = require('sequelize');

// ✅ Define the instance BEFORE using it
const wordpressSequelize = new Sequelize(
  process.env.WP_DB_NAME,
  process.env.WP_DB_USER,
  process.env.WP_DB_PASS,
  {
    host: process.env.WP_DB_HOST,
    // port:  3306,
    port:  process.env.WP_DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,
    define: {
      timestamps: false,
      freezeTableName: true,
    },
      dialectOptions: {
      connectTimeout: 10000, // 10 seconds
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000, // wait 30s for connection before throwing error
      idle: 10000,    // 10s idle before releasing connection
    },
  }
);

// Optional: test the connection (you can remove this in production)
// const testConnection = async () => {
//   try {
//     await wordpressSequelize.authenticate();
//     console.log('✅ Connected to WordPress DB successfully!');
//   } catch (error) {
//     console.error('❌ Connection failed:', error.message);
//   }
// };
const testConnection = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      await wordpressSequelize.authenticate();
      console.log('✅ Connected to WordPress DB successfully!');
      return;
    } catch (error) {
      console.warn(`❌ Connection attempt ${i + 1} failed: ${error.message}`);
      if (i < retries - 1) {
        console.log('🔄 Retrying in 2 seconds...');
        await new Promise(res => setTimeout(res, 2000));
      } else {
        console.error('❌ All retries failed. Please check DB server.');
      }
    }
  }
};

// Run it (optional)
testConnection();

// ✅ Now export it AFTER it's defined
module.exports = { wordpressSequelize };
