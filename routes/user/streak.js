const express = require('express');
const router = express.Router();
const StreakController = require('../../controllers/user/streakController');
const { authenticateUser } = require('../../service/authMiddleWares');
const { rateLimiter } = require('../../util/rateLimiter');

const streakController = new StreakController();

/**
 * @swagger
 * components:
 *   schemas:
 *     StreakData:
 *       type: object
 *       properties:
 *         currentStreak:
 *           type: integer
 *           description: Current consecutive days streak
 *         longestStreak:
 *           type: integer
 *           description: Longest streak ever achieved
 *         lastActivityDate:
 *           type: string
 *           format: date
 *           description: Last activity date
 *         isNewRecord:
 *           type: boolean
 *           description: Whether current streak is a new record
 */

/**
 * @swagger
 * /user/streak/complete-lesson:
 *   post:
 *     summary: Record lesson completion and update streak
 *     tags: [User Streaks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - courseId
 *             properties:
 *               courseId:
 *                 type: string
 *                 format: uuid
 *                 description: Course UUID
 *               timezone:
 *                 type: string
 *                 default: UTC
 *                 description: User's timezone (e.g., 'America/New_York')
 *     responses:
 *       200:
 *         description: Streak updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/StreakData'
 */
router.post('/complete-lesson', 
    authenticateUser, 
    rateLimiter(100, 15 * 60 * 1000), // 100 requests per 15 minutes
    streakController.completeLessonStreak
);

/**
 * @swagger
 * /user/streak/course/{courseId}:
 *   get:
 *     summary: Get user's streak for a specific course
 *     tags: [User Streaks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Course streak data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/StreakData'
 */
router.get('/course/:courseId', 
    authenticateUser, 
    rateLimiter(200, 15 * 60 * 1000), // 200 requests per 15 minutes
    streakController.getCourseStreak
);

/**
 * @swagger
 * /user/streak/dashboard:
 *   get:
 *     summary: Get all user's streaks for dashboard
 *     tags: [User Streaks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard streak data
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
 *                     streaks:
 *                       type: array
 *                       items:
 *                         type: object
 *                     totalCourses:
 *                       type: integer
 *                     activeStreaks:
 *                       type: integer
 *                     totalCurrentStreak:
 *                       type: integer
 *                     longestOverallStreak:
 *                       type: integer
 */
router.get('/dashboard', 
    authenticateUser, 
    rateLimiter(100, 15 * 60 * 1000), // 100 requests per 15 minutes
    streakController.getDashboardStreaks
);

/**
 * @swagger
 * /user/streak/leaderboard/{courseId}:
 *   get:
 *     summary: Get course leaderboard
 *     tags: [User Streaks]
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
 *           default: 10
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Course leaderboard
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       rank:
 *                         type: integer
 *                       userId:
 *                         type: string
 *                       userName:
 *                         type: string
 *                       currentStreak:
 *                         type: integer
 *                       longestStreak:
 *                         type: integer
 *                       isActive:
 *                         type: boolean
 */
router.get('/leaderboard/:courseId', 
    authenticateUser, 
    rateLimiter(50, 15 * 60 * 1000), // 50 requests per 15 minutes
    streakController.getCourseLeaderboard
);

module.exports = router;