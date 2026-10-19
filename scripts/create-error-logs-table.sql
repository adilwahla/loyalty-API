CREATE TABLE IF NOT EXISTS `error_logs` (
  `id` CHAR(36) NOT NULL,
  `sales_rep_id` VARCHAR(255) NOT NULL,
  `customer_id` VARCHAR(255) NULL,
  `error_code` VARCHAR(64) NOT NULL,
  `error_message` TEXT NOT NULL,
  `source` VARCHAR(32) NOT NULL,
  `datetime` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
