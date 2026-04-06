const express = require('express');
const router = express.Router();
const offerController = require('../../../../controllers/v1/offer.controller');
const upload = require('../../../../middleware/multerOffer');

router.get('/', offerController.getPaginated);
router.get('/all', offerController.getAll);
router.post('/create', upload.single('file'), offerController.create);
router.post('/bulk-create', upload.array('file'), offerController.bulkCreate);
router.put('/:id', upload.single('file'), offerController.update);
// router.delete('/:id', offerController.remove);
router.delete('/:offerId', offerController.removeByOfferId); // Assuming you want to keep this route

module.exports = router;


/**
 * @swagger
 * tags:
 *   name: Admin Offers
 *   description: Admin offer/banner management APIs
 */

/**
 * @swagger
 * /api/v1/admin/offers:
 *   get:
 *     tags: [Admin Offers]
 *     summary: Get paginated offers
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Paginated list of offers

 * /api/v1/admin/offers/all:
 *   get:
 *     tags: [Admin Offers]
 *     summary: Get all offers
 *     responses:
 *       200:
 *         description: Full list of offers

 * /api/v1/admin/offers/create:
 *   post:
 *     tags: [Admin Offers]
 *     summary: Create a new offer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               offerId:
 *                 type: string
 *               name:
 *                 type: string
 *               userRole:
 *                 type: string
 *               fromDate:
 *                 type: string
 *                 format: date
 *               toDate:
 *                 type: string
 *                 format: date
 *               pointsFactor:
 *                 type: number
 *               type:
 *                 type: string
 *                 enum: [offer, banner]
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Offer created successfully

 * /api/v1/admin/offers/bulk-create:
 *   post:
 *     tags: [Admin Offers]
 *     summary: Bulk create offers
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: string
 *                 description: JSON stringified array of offer objects
 *               file:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Bulk offers created successfully

 * /api/v1/admin/offers/{id}:
 *   put:
 *     tags: [Admin Offers]
 *     summary: Update an existing offer
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               userRole:
 *                 type: string
 *               fromDate:
 *                 type: string
 *                 format: date
 *               toDate:
 *                 type: string
 *                 format: date
 *               pointsFactor:
 *                 type: number
 *               type:
 *                 type: string
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Offer updated successfully

 *   delete:
 *     tags: [Admin Offers]
 *     summary: Delete an offer
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Offer deleted successfully
 */
