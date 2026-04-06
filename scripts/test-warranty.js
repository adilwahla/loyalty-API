
// scripts/test-warranty.js
require('dotenv').config();

const { QueryTypes } = require('sequelize');
const { wordpressSequelize } = require('../config/wordpress.database');
const { toWarrantyView } = require('../src/utils/warrantyTransform');

(async () => {
  // Allow skipping during local dev
  if (String(process.env.SKIP_WP_DB).toLowerCase() === 'true') {
    console.log('ℹ️ SKIP_WP_DB=true — skipping WordPress DB test.');
    process.exit(0);
  }
  

  // Defaults can be overridden via CLI args
  const warranty_number = process.argv[2] || 'adil2951';
  // const phone_number = process.argv[3] || '0539953058';

  // // Normalize phone: with & without spaces
  // const phoneWithoutSpaces = String(phone_number).replace(/\s+/g, '');
  // const phoneWithSpaces = phoneWithoutSpaces.replace(
  //   /^(\d{3})(\d{3})(\d{4})$/,
  //   '$1 $2 $3'
  // );

  const sql = `
    SELECT * FROM \`CW7OK167O_tablesome_table_1201\`
    WHERE column_2 = ? 
  `;

  try {
    // Optional: quick connectivity check
    await wordpressSequelize.authenticate();
    console.log('✅ Connected to WordPress DB');

    const rows = await wordpressSequelize.query(sql, {
      replacements: [warranty_number],
      type: QueryTypes.SELECT,
    });

    if (!rows || rows.length === 0) {
      console.log('❌ No match found.');
      return;
    }

    // Shape rows to your UI schema
    const shaped = rows.map(toWarrantyView);

    // Sort by Car Year (asc) if present
    shaped.sort((a, b) => parseInt(a['Car Year'] || 0) - parseInt(b['Car Year'] || 0));

    console.log('✅ Match found:\n', JSON.stringify(shaped, null, 2));
  } catch (err) {
    // Print a concise error plus the original code/status when available
    const msg = err?.message || String(err);
    console.error('❌ Error querying DB:', msg);
    if (err?.parent?.code) console.error('   code:', err.parent.code);
    if (err?.parent?.sqlMessage) console.error('   sqlMessage:', err.parent.sqlMessage);
  } finally {
    try {
      await wordpressSequelize.close();
    } catch {}
  }
})();



















// // scripts/test-warranty.js
// const { wordpressSequelize } = require('../config/wordpress.database');
// const { toWarrantyView } = require('../src/utils/warrantyTransform');

// (async () => {
//   const warranty_number = '158';
//   const phone_number = '0539953058';

//   // Format phone number (with and without spaces)
//   const phoneWithoutSpaces = phone_number.replace(/\s+/g, '');
//   const phoneWithSpaces = phoneWithoutSpaces.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3');

//   // SQL query to match warranty number and phone number variations
//   const query = `
//     SELECT * FROM CW7OK167O_tablesome_table_1201
//     WHERE column_2 = ? AND (column_4 = ? OR column_4 = ?)
//   `;

//   try {
//     const [rows] = await wordpressSequelize.query(query, {
//       replacements: [warranty_number, phoneWithoutSpaces, phoneWithSpaces]
//     });

//     if (!rows.length) {
//       console.log('❌ No match found.');
//       return;
//     }

//     // Process and format results
//     const formattedResults = rows.map((row) => {
//       // Car Model (column_8 to column_100)
//       const carModel = Object.keys(row)
//         .filter((key) => /^column_(\d+)$/.test(key) && +key.split('_')[1] >= 8 && +key.split('_')[1] <= 100)
//         .map((key) => row[key])
//         .filter(Boolean)
//         .join(', ');

//       // Battery Type (columns 104–107)
//       const batteryType = ['column_104', 'column_105', 'column_106', 'column_107']
//         .map((key) => row[key])
//         .filter(Boolean)
//         .join(', ');

//       // Warranty Years (columns 108–111)
//       const warrantyYears = ['column_108', 'column_109', 'column_110', 'column_111']
//         .map((key) => row[key])
//         .filter(Boolean)
//         .join(', ');

//       // Car Year and Brand
//       const carYear = row.column_101 || '';
//       const brand = row.column_103 || '';

//       // Extract file_url from column_7 or column_7_meta
//       let imageUrl = row.column_7 || '';
//       if (!imageUrl && row.column_7_meta) {
//         try {
//           const meta = JSON.parse(row.column_7_meta);
//           if (meta?.file_url) imageUrl = meta.file_url;
//         } catch {}
//       }

//       // Extract file_url from column_122 or column_122_meta
//       let warrantyDoc = row.column_122 || '';
//       if (!warrantyDoc && row.column_122_meta) {
//         try {
//           const meta = JSON.parse(row.column_122_meta);
//           if (meta?.file_url) warrantyDoc = meta.file_url;
//         } catch {}
//       }

//       // Return structured object
//       return {
//         WarrantyNumber: row.column_2,
//         PhoneNumber: row.column_4,
//         CarModel: carModel,
//         CarYear: carYear,
//         Brand: brand,
//         BatteryType: batteryType,
//         NoOfWarrantyYears: warrantyYears,
//         ImageURL: imageUrl,
//         WarrantyDocument: warrantyDoc 
//       };
//     });

//     // Optional: sort by CarYear (ascending)
//     formattedResults.sort((a, b) => parseInt(a.CarYear || 0) - parseInt(b.CarYear || 0));

//     // Output to console
//     console.log('✅ Match found:\n', JSON.stringify(formattedResults, null, 2));
//   } catch (err) {
//     console.error('❌ Error querying DB:', err.message);
//   } finally {
//     await wordpressSequelize.close();
//   }
// })();
