-- Run this against your MySQL database to drop the unique index on phone_number.
-- The Sequelize model change (removing unique: true) prevents the index from being
-- re-created, but sequelize.sync() does NOT drop existing indexes automatically.
--
-- Usage:  mysql -u <user> -p <dbname> < scripts/drop-phone-unique.sql

ALTER TABLE users DROP INDEX phone_number;
