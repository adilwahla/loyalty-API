const express = require('express');
const router = express.Router();
const rewardController = require('../../../../controllers/v1/reward.controller');
// For rewards
const uploadReward = require('../../../../middleware/multerRewards');

router.get('/all', rewardController.getAll);
router.get('/', rewardController.getPaginated);
router.post('/create', uploadReward.single('file'), rewardController.create);
router.post('/bulk-create', uploadReward.array('file'), rewardController.bulkCreate);
router.put('/:id', uploadReward.single('file'), rewardController.update);
router.delete('/:id', rewardController.remove);

module.exports = router;

/**
 * @swagger
 * tags:
 *   name: Admin Rewards
 *   description: Admin reward management APIs
 */

/**
 * @swagger
 * /api/v1/admin/rewards/all:
 *   get:
 *     summary: Get all rewards (non-paginated)
 *     tags: [Admin Rewards]
 *     responses:
 *       200:
 *         description: All rewards fetched
 */

/**
 * @swagger
 * /api/v1/admin/rewards:
 *   get:
 *     summary: Get paginated rewards
 *     tags: [Admin Rewards]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Paginated rewards fetched
 */

/**
 * @swagger
 * /api/v1/admin/rewards/create:
 *   post:
 *     summary: Create a new reward
 *     tags: [Admin Rewards]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - serialNumber
 *               - rewardId
 *               - title
 *               - points
 *               - dateCreated
 *             properties:
 *               serialNumber: { type: integer }
 *               rewardId: { type: string }
 *               title: { type: string }
 *               points: { type: number }
 *               users:
 *                 type: array
 *                 items: { type: string }
 *               dateCreated: { type: string }
 *               isActive: { type: boolean }
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Reward created
 */

/**
 * @swagger
 * /api/v1/admin/rewards/bulk-create:
 *   post:
 *     summary: Bulk create rewards
 *     tags: [Admin Rewards]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               rewards: { type: string, description: 'JSON stringified array of rewards' }
 *               images:
 *                 type: array
 *                 items: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Bulk rewards created
 */

/**
 * @swagger
 * /api/v1/admin/rewards/{id}:
 *   put:
 *     summary: Update reward by ID
 *     tags: [Admin Rewards]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               serialNumber: { type: integer }
 *               rewardId: { type: string }
 *               title: { type: string }
 *               points: { type: number }
 *               users:
 *                 type: array
 *                 items: { type: string }
 *               dateCreated: { type: string }
 *               isActive: { type: boolean }
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Reward updated
 */

/**
 * @swagger
 * /api/v1/admin/rewards/{id}:
 *   delete:
 *     summary: Delete reward by ID
 *     tags: [Admin Rewards]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Reward deleted
 */