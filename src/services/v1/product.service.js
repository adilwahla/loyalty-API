const { Product } = require('../../models');
const { Op } = require('sequelize');

exports.getAll = async (filters = {}) => {
  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.unitQuantity) where.unitQuantity = filters.unitQuantity;

  return await Product.findAll({ where, order: [['createdDate', 'DESC']] });
};

// Get products with pagination, sorting, and filtering
exports.getPaginated = async (filters = {}) => {
  const {
    page = 1,
    limit = 10,
    sortBy = 'createdDate',
    sortOrder = 'DESC',
    status,
    unitQuantity
  } = filters;

  const offset = (page - 1) * limit;
  const where = {};

  if (status) where.status = status;
  if (unitQuantity) where.unitQuantity = unitQuantity;

  const result = await Product.findAndCountAll({
    where,
    order: [[sortBy, sortOrder]],
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  return {
    total: result.count,
    page: parseInt(page),
    pageSize: parseInt(limit),
    products: result.rows
  };
};


exports.create = async (data) => {
  // Check if SKU already exists
  const exists = await Product.findOne({ where: { sku: data.sku } });

  if (exists) {
    throw new Error('SKU already exists');
  }
  delete data.id; // ⛔️ Remove id from the payload
  // Proceed if no duplicate
  return await Product.create(data);
};




exports.bulkCreate = async (productList) => {
  const inserted = [];
  const skipped = [];
  const incomingSKUs = new Set();
  const duplicatesInPayload = new Set();

  // Step 1: Detect duplicates in incoming request
  for (const product of productList) {
    if (incomingSKUs.has(product.sku)) {
      duplicatesInPayload.add(product.sku);
    } else {
      incomingSKUs.add(product.sku);
    }
  }

  // Step 2: Query existing SKUs from DB
  const existingSKUs = await Product.findAll({
    where: { sku: { [Op.in]: Array.from(incomingSKUs) } },
    attributes: ['sku']
  });

  const existingSKUSet = new Set(existingSKUs.map(p => p.sku));

  // Step 3: Filter and insert only unique SKUs
  for (const product of productList) {
    if (existingSKUSet.has(product.sku)) {
      skipped.push({ sku: product.sku, reason: 'SKU already exists in database' });
    } else if (duplicatesInPayload.has(product.sku)) {
      skipped.push({ sku: product.sku, reason: 'Duplicate SKU in request payload' });
    } else {
      try {
        const newProduct = await Product.create(product);
        inserted.push(newProduct);
      } catch (err) {
        skipped.push({ sku: product.sku, reason: `Insertion failed: ${err.message}` });
      }
    }
  }

  return { inserted, skipped };
};




exports.update = async (id, updates) => {
  const product = await Product.findByPk(id);
  if (!product) throw new Error('Product not found');
  return await product.update(updates);
};

exports.remove = async (id) => {
  const product = await Product.findByPk(id);
  if (!product) throw new Error('Product not found');
  return await product.destroy();
};
