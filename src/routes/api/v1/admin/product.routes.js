const express = require('express');
const router = express.Router();
const productController = require('../../../../controllers/v1/product.controller');
const upload = require('../../../../middleware/multerConfig');




// const { protect } = require('../../../../middleware/auth');


// router.use(protect(['admin', 'sales_admin', 'super_admin']));

router.get('/', productController.getPaginated);
router.get('/all', productController.getAll);
router.post('/create', upload.single('file'), productController.create);
router.post('/bulk-create', upload.array('file'), productController.bulkCreate);
router.put('/:id', upload.single('file'), productController.update);
router.delete('/:id', productController.remove);




module.exports = router;


/**
 * @swagger
 * tags:
 *   name: Admin Products
 *   description: Admin product management APIs
 */

/**
 * @swagger
 * /api/v1/admin/products:
 *   get:
 *     tags: [Admin Products]
 *     summary: Get paginated products
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of paginated products
 */

/**
 * @swagger
 * /api/v1/admin/products/all:
 *   get:
 *     tags: [Admin Products]
 *     summary: Get all products
 *     responses:
 *       200:
 *         description: Complete product list
 */

/**
 * @swagger
 * /api/v1/admin/products/create:
 *   post:
 *     tags: [Admin Products]
 *     summary: Create a new product (with image upload)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - sku
 *             properties:
 *               sku:
 *                 type: string
 *                 example: 053995305
 *               title:
 *                 type: string
 *                 example: Test Product
 *               nameArabic:
 *                 type: string
 *                 example: منتج تجريبي
 *               units:
 *                 type: string
 *                 example: Litre
 *               unitQuantity:
 *                 type: integer
 *                 example: 5
 *               basePoints:
 *                 type: number
 *                 example: 1.5
 *               colorCode:
 *                 type: string
 *                 example: Black
 *               mCode:
 *                 type: string
 *                 example: LE24C5
 *               status:
 *                 type: string
 *                 example: Published
 *               createdDate:
 *                 type: string
 *                 format: date
 *                 example: 2025-06-26
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Product created
 */

/**
 * @swagger
 * /api/v1/admin/products/bulk-create:
 *   post:
 *     tags: [Admin Products]
 *     summary: Bulk create multiple products (with optional images)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               products:
 *                 type: string
 *                 description: JSON string of products array
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Bulk product creation result
 */

/**
 * @swagger
 * /api/v1/admin/products/{id}:
 *   put:
 *     tags: [Admin Products]
 *     summary: Update a product by ID (with image upload)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               sku:
 *                 type: string
 *               title:
 *                 type: string
 *               nameArabic:
 *                 type: string
 *               units:
 *                 type: string
 *               unitQuantity:
 *                 type: integer
 *               basePoints:
 *                 type: number
 *               colorCode:
 *                 type: string
 *               mCode:
 *                 type: string
 *               status:
 *                 type: string
 *               createdDate:
 *                 type: string
 *                 format: date
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Product updated
 */

/**
 * @swagger
 * /api/v1/admin/products/{id}:
 *   delete:
 *     tags: [Admin Products]
 *     summary: Delete a product by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Product deleted
 */
