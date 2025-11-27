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
    connectTimeout: 30000, // 30 seconds
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 60000, // max time in ms to acquire connection
    idle: 10000,    // max time a connection can be idle before release
  },
    logging: false,
  }
);

module.exports = sequelize;
