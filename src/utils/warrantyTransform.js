// utilities/warrantyTransform.js

function formatDate(date) {
  if (!date) return 'N/A';

  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function toWarrantyView(row) {
  return {
    'Name': row.name || '',
    'Warranty Number': row.warranty_number || '',
    'Phone Number': row.phone || '',
    'City': row.city || '',
    'Car Make': row.car_make || '',
    'Car Model': row.car_model || '',
    'Car Year': row.car_year || '',
    'Brand': row.battery_brand || '',
    'Battery Type': row.battery_type || '',
    'No of Warranty Months': row.warranty_months || '',
    'Invoice Date': formatDate(row.invoice_date),
    'warranty Invoice': row.invoice_image || '',
    'Battery Picture': row.battery_image || ''
  };
}

module.exports = { toWarrantyView };


// // utilities/warrantyTransform.js
// function msToLongDate(msString) {
//   if (!msString) return 'N/A';
//   const n = Number(msString);
//   if (Number.isNaN(n)) return 'N/A';
//   return new Date(n).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
// }

// function pickFileUrl(main, meta) {
//   if (main) return main;
//   if (!meta) return '';
//   try {
//     const j = JSON.parse(meta);
//     return j?.file_url || '';
//   } catch {
//     return '';
//   }
// }

// function toWarrantyView(row) {
//   // Combine columns 9..100 for Car Model (falls back to column_9 if you’ve only one)
//   const carModel = (() => {
//     const parts = [];
//     for (let i = 9; i <= 100; i++) {
//       const k = `column_${i}`;
//       if (row[k]) parts.push(row[k]);
//     }
//     return parts.join(', ');
//   })();

//   // Battery Type from 104..107 (commonly a single value like EFB)
//   const batteryType = ['column_104', 'column_105', 'column_106', 'column_107','column_125',column_126', column_127', column_128', column_129',  'column_130' ]
//     .map(k => row[k]).filter(Boolean).join(', ') || '';

//   // Years → Months (take first numeric value you store in 108..111; adjust if months are stored directly)
//  // Warranty months from (108–111 ---- 131–136, 140 )
// const warrantyMonths = Number(
//   ['column_108', 'column_109', 'column_110', 'column_111', 'column_131', 'column_132', 'column_133', 'column_134', 'column_135', 'column_136', 'column_140']
//     .map((k) => row[k])
//     .find((val) => val && !isNaN(val))
// ) || null;

//   return {
//     'Name': row.column_3 || '',
//     'Warranty Number': row.column_2 || '',
//     'Phone Number': row.column_4 || '',
//     'City': row.column_5 || '',
//     'Car Make': row.column_6 || '',
//     'Car Model': carModel || row.column_9 || '',    // fallback if only one model field used
//     'Car Year': row.column_101 || '',
//     'Brand': row.column_103 || '',
//     'Battery Type': batteryType || '',
//     'No of Warranty Months': warrantyMonths || '',
//     'Invoice Date': msToLongDate(row.column_102),
//     'warranty Invoice': pickFileUrl(row.column_7, row.column_7_meta),
//     'Battery Picture': pickFileUrl(row.column_122, row.column_122_meta),
//   };
// }

// module.exports = { toWarrantyView };
