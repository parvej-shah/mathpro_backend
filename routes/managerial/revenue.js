const router = require("express-promise-router")();
const RevenueController = require('../../controllers/managerial/revenueController').RevenueController;
const { requirePermission } = require('../../service/authMiddleWares');
const { PERMISSIONS } = require('../../util/permissions');

const revenueController = new RevenueController();

const requireRevenueManage = requirePermission(PERMISSIONS.REVENUE.MANAGE.ALL);

/**
 * @swagger
 * /admin/revenue/detailed:
 *   get:
 *     summary: Get overall revenue statistics
 *     tags: [Revenue]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Revenue statistics fetched successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.route("/detailed").get(requireRevenueManage, revenueController.getDetailedRevenue);

/**
 * @swagger
 * /admin/revenue/detailed/{id}:
 *   get:
 *     summary: Get detailed revenue statistics for a specific course
 *     tags: [Revenue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Course ID
 *     responses:
 *       200:
 *         description: Course revenue statistics fetched successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.route("/detailed/:id").get(requireRevenueManage, revenueController.getDetailedRevenue);

/**
 * @swagger
 * /admin/revenue/timeframe:
 *   get:
 *     summary: Get revenue statistics over time
 *     tags: [Revenue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, year, all]
 *           default: year
 *         description: Time period for the statistics
 *     responses:
 *       200:
 *         description: Revenue statistics fetched successfully
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.route("/timeframe").get(requireRevenueManage, revenueController.getRevenueByTimeframe);

/**
 * @swagger
 * /admin/revenue/top:
 *   get:
 *     summary: Get top revenue-generating courses
 *     tags: [Revenue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 100
 *         description: Number of top courses to return
 *     responses:
 *       200:
 *         description: Top revenue generators fetched successfully
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.route("/top").get(requireRevenueManage, revenueController.getTopRevenueGenerators);

module.exports = router; 