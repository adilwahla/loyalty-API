const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',

    dialectOptions: {
      charset: 'utf8mb4',
      connectTimeout: 30000,
    },

    define: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
    },

    pool: {
      max: 10,
      min: 0,
      acquire: 60000,
      idle: 10000,

      afterCreate: (connection, done) => {
        connection.query(
          "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;",
          (err) => done(err, connection)
        );
      }
    },

    logging: false,
  }
);

module.exports = sequelize;

// const { Sequelize } = require('sequelize');
// require('dotenv').config();

// const sequelize = new Sequelize(
//   process.env.DB_NAME,
//   process.env.DB_USER,
//   process.env.DB_PASSWORD,
//   {
//     host: process.env.DB_HOST,
//     port: process.env.DB_PORT,
//     dialect: 'mysql',
//      dialectOptions: {
//     connectTimeout: 30000, // 30 seconds
//   },
//   pool: {
//     max: 10,
//     min: 0,
//     acquire: 60000, // max time in ms to acquire connection
//     idle: 10000,  
//       // max time a connection can be idle before release
//   },
//     logging: false,
//   }
// );

// module.exports = sequelize;
