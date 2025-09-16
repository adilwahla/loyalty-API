// src/utilities/getWarrantyFromWP.js
const { wordpressSequelize } = require('../../config/wordpress.database');
const { QueryTypes } = require('sequelize');

class NotFoundError extends Error { constructor(msg){ super(msg); this.name='NotFoundError'; this.status=404; } }
class ExternalServiceError extends Error { constructor(msg){ super(msg); this.name='ExternalServiceError'; this.status=503; } }

async function getWarrantyFromWP(warrantyNumber) {
  const sql = `
    SELECT * FROM \`CW7OK167O_tablesome_table_1201\`
    WHERE column_2 = ?
    LIMIT 1
  `;

   try {
    const rows = await wordpressSequelize.query(sql, {
      replacements: [warrantyNumber],
      type: QueryTypes.SELECT,
    });

    if (!rows || rows.length === 0) {
      // normal business case → 404
      throw new NotFoundError(`No WordPress record found for warranty number: ${warrantyNumber}`);
    }

    return rows[0]; // success
  } catch (err) {
    // if your WP DB connection itself is down/broken
    if (err instanceof NotFoundError) throw err;
    // Map other unexpected failures to a 503
    throw new ExternalServiceError('WordPress datasource unavailable');
  }
}

module.exports = { getWarrantyFromWP , NotFoundError, ExternalServiceError  };
