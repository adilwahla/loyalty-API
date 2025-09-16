// utilities/warrantyTransform.js
function msToLongDate(msString) {
  if (!msString) return 'N/A';
  const n = Number(msString);
  if (Number.isNaN(n)) return 'N/A';
  return new Date(n).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function pickFileUrl(main, meta) {
  if (main) return main;
  if (!meta) return '';
  try {
    const j = JSON.parse(meta);
    return j?.file_url || '';
  } catch {
    return '';
  }
}

function toWarrantyView(row) {
  // Combine columns 9..100 for Car Model (falls back to column_9 if you’ve only one)
  const carModel = (() => {
    const parts = [];
    for (let i = 9; i <= 100; i++) {
      const k = `column_${i}`;
      if (row[k]) parts.push(row[k]);
    }
    return parts.join(', ');
  })();

  // Battery Type from 104..107 (commonly a single value like EFB)
  const batteryType = ['column_104', 'column_105', 'column_106', 'column_107']
    .map(k => row[k]).filter(Boolean).join(', ') || '';

  // Years → Months (take first numeric value you store in 108..111; adjust if months are stored directly)
 // Warranty months from (108–111)
const warrantyMonths = Number(
  ['column_108', 'column_109', 'column_110', 'column_111']
    .map((k) => row[k])
    .find((val) => val && !isNaN(val))
) || null;

  return {
    'Name': row.column_3 || '',
    'Warranty Number': row.column_2 || '',
    'Phone Number': row.column_4 || '',
    'City': row.column_5 || '',
    'Car Make': row.column_6 || '',
    'Car Model': carModel || row.column_9 || '',    // fallback if only one model field used
    'Car Year': row.column_101 || '',
    'Brand': row.column_103 || '',
    'Battery Type': batteryType || '',
    'No of Warranty Months': warrantyMonths || '',
    'Invoice Date': msToLongDate(row.column_102),
    'warranty Invoice': pickFileUrl(row.column_7, row.column_7_meta),
    'Battery Picture': pickFileUrl(row.column_122, row.column_122_meta),
  };
}

module.exports = { toWarrantyView };
