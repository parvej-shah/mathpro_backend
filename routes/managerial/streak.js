const express = require('express');
const router = express.Router();
const AdminStreakController = require('../../controllers/managerial/streakController');
const { requirePermission } = require('../../service/authMiddleWares');
const { PERMISSIONS } = require('../../util/permissions');
const { rateLimiter } = require('../../util/rateLimiter');

const adminStreakController = new AdminStreakController();

// Phase 5: All streak admin endpoints use streak.manage.all
const requireStreakManage = requirePermission(PERMISSIONS.STREAK.MANAGE.ALL);

/**
 * @swagger
 * /admin/streak/analytics:
 *   get:
 *     summary: Get streak analytics for admin dashboard
 *     tags: [Admin Streaks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Optional course ID to filter analytics
 *     responses:
 *       200:
 *         description: Streak analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalUsers:
 *                       type: integer
 *                     averageCurrentStreak:
 *                       type: string
 *                     averageLongestStreak:
 *                       type: string
 *                     maxStreak:
 *                       type: integer
 *                     activeStreaks:
 *                       type: integer
 *                     weekPlusStreaks:
 *                       type: integer
 *                     monthPlusStreaks:
 *                       type: integer
 *                     engagementRate:
 *                       type: string
 */
router.get('/analytics', requireStreakManage, rateLimiter(100, 15 * 60 * 1000), adminStreakController.getStreakAnalytics);

/**
 * @swagger
 * /admin/streak/user/{userId}:
 *   get:
 *     summary: Get detailed streak data for a specific user
 *     tags: [Admin Streaks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User streak details
 */
router.get('/user/:userId', requireStreakManage, rateLimiter(200, 15 * 60 * 1000), adminStreakController.getUserStreakDetails);

/**
 * @swagger
 * /admin/streak/leaderboard/{courseId}:
 *   get:
 *     summary: Get course leaderboard (admin version with more details)
 *     tags: [Admin Streaks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Admin course leaderboard
 */
router.get('/leaderboard/:courseId', requireStreakManage, rateLimiter(100, 15 * 60 * 1000), adminStreakController.getAdminCourseLeaderboard);

/**
 * @swagger
 * /admin/streak/manual-update:
 *   post:
 *     summary: Manually update a user's streak (admin correction)
 *     tags: [Admin Streaks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - courseId
 *               - activityDate
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               courseId:
 *                 type: string
 *                 format: uuid
 *               activityDate:
 *                 type: string
 *                 format: date
 *                 description: Date in YYYY-MM-DD format
 *     responses:
 *       200:
 *         description: Streak updated successfully
 */
router.post('/manual-update', requireStreakManage, rateLimiter(50, 15 * 60 * 1000), adminStreakController.manualStreakUpdate);

/**
 * @swagger
 * /admin/streak/bulk-update:
 *   post:
 *     summary: Bulk update streaks (for data migration/correction)
 *     tags: [Admin Streaks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - updates
 *             properties:
 *               updates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                       format: uuid
 *                     courseId:
 *                       type: string
 *                       format: uuid
 *                     activityDate:
 *                       type: string
 *                       format: date
 *     responses:
 *       200:
 *         description: Bulk update completed
 */
router.post('/bulk-update', requireStreakManage, rateLimiter(10, 15 * 60 * 1000), adminStreakController.bulkStreakUpdate);

/**
 * @swagger
 * /admin/streak/trends:
 *   get:
 *     summary: Get streak trends over time
 *     tags: [Admin Streaks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *           maximum: 365
 *     responses:
 *       200:
 *         description: Streak trends data
 */
router.get('/trends', requireStreakManage, rateLimiter(50, 15 * 60 * 1000), adminStreakController.getStreakTrends);

module.exports = router;