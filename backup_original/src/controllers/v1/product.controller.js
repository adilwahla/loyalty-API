const productService = require('../../services/v1/product.service');
// const upload = require('../../../../middleware/multerConfig');

// GET /products
// GET /admin/products/all → non-paginated
// GET /products
exports.getAll = async (req, res) => {
  try {
    const products = await productService.getAll(req.query);
    res.status(200).json({ success: true, message: 'All products fetched successfully', products });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch all products', error: err.message });
  }
};

// GET /admin/products → paginated
exports.getPaginated = async (req, res) => {
  try {
    const result = await productService.getPaginated(req.query);
    res.status(200).json({ success: true, message: 'Paginated products fetched successfully', ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch paginated products', error: err.message });
  }
};

// POST /products/create
exports.create = async (req, res) => {
  try {
    const payload = req.body;

    if (req.file) {
      const imageUrl = `${req.protocol}://${req.get('host')}/uploads/products/${req.file.filename}`.replace(/\\/g, '/');
    //  payload.image = imageUrl;
    payload.image = `/uploads/products/${req.file.filename}`;

    }

    const newProduct = await productService.create(payload);
    res.status(201).json({ success: true, message: 'Product created successfully', product: newProduct });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError' || err.message.includes('SKU already exists')) {
      return res.status(400).json({ success: false, message: 'Product with this SKU already exists', field: 'sku' });
    }
    res.status(500).json({ success: false, message: 'Product creation failed', error: err.message });
  }
};

// POST /products/bulk-create
exports.bulkCreate = async (req, res) => {
  try {
    const productList = req.body.products ? JSON.parse(req.body.products) : [];
    if (req.files && req.files.length) {
      req.files.forEach((file, index) => {
        if (productList[index]) {
          const imageUrl = `${req.protocol}://${req.get('host')}/uploads/products/${file.filename}`;
          productList[index].image = imageUrl;
        }
      });
    }
    const { inserted, skipped } = await productService.bulkCreate(productList);
    res.status(201).json({ success: true, message: `${inserted.length} products created, ${skipped.length} skipped.`, inserted, skipped });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Bulk product creation failed', error: err.message });
  }
};

// PUT /products/:id
exports.update = async (req, res) => {
  try {
    const productData = { ...req.body };

    if (req.file) {
 //     productData.image = `${req.protocol}://${req.get('host')}/uploads/products/${req.file.filename}`;
    productData.image = `/uploads/products/${req.file.filename}`;

    }

    const updated = await productService.update(req.params.id, productData);
    res.status(200).json({ success: true, message: 'Product updated successfully', product: updated });
  } catch (err) {
    if (err.message === 'Product not found') {
      res.status(404).json({ success: false, message: 'No product found with the specified ID' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to update product', error: err.message });
    }
  }
};

// DELETE /products/:id
exports.remove = async (req, res) => {
  try {
    await productService.remove(req.params.id);
    res.status(200).json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    if (err.message === 'Product not found') {
      res.status(404).json({ success: false, message: 'No product found with the specified ID' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to delete product', error: err.message });
    }
  }
};
