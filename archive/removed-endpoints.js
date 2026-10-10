/* eslint-disable */
// ARCHIVED ENDPOINTS — not loaded by the app (nothing requires this file).
//
// Removed 2026-10-10 (REFACTOR_PLAN.md task D5): no caller in MathPro_Frontend or
// mathpro_admin. Kept here for reference only; git history has the original context.
//
//   POST   /user/course/takes/:id               SECURITY: enrolled any student in any paid course for free
//   GET    /user/course/getScore/:id
//   POST   /user/course/prebookBundle/:id
//   GET    /user/course/getWishList             (service getWishList stays: used by the dashboard)
//   GET    /user/course/getMyCoursesPage
//   GET    /user/course/getMyCourses
//   GET    /user/module/recentViews/:courseId
//   DELETE /user/module/recentViews/:courseId
//   GET    /user/coupon/check-applicability     (service isCouponApplicableToCourse stays)
//   POST   /user/notification/bellIconClicked   (superseded by the unread-count badge, 2026-06-19)
//   GET    /user/feedback/course/:courseId/average
//
// To restore one: copy the route line back into its router, and the handler/service
// methods back into their classes.

// ---- route lines ----
// routes/user/course.js: router.route("/takes/:id").post(authenticateUser, courseWriteLimit, courseController.takes);
// routes/user/course.js: router.route("/getScore/:id").get(optAuthenticateUser, authenticatedCourseReadLimit, courseController.getScore);
// routes/user/course.js: router.route("/prebookBundle/:id").post(optAuthenticateUser, courseWriteLimit, courseController.prebookBundle);
// routes/user/course.js: router.route("/getWishList").get(authenticateUser, authenticatedCourseReadLimit, courseController.getWishList);
// routes/user/course.js: router.route("/getMyCoursesPage").get(authenticateUser, authenticatedCourseReadLimit, courseController.getMyCoursesPage);
// routes/user/course.js: router.route("/getMyCourses").get(authenticateUser, authenticatedCourseReadLimit, courseController.getMyCourses);
// routes/user/module.js: router.route("/recentViews/:courseId").get(userAuthMiddleWare, moduleReadLimit, moduleViewsController.getRecentViews);
// routes/user/module.js: router.route("/recentViews/:courseId").delete(userAuthMiddleWare, moduleWriteLimit, moduleViewsController.clearRecentViews);
// routes/user/notification.js: router.route("/bellIconClicked").post(authenticateUser, notificationLimit, notificationController.bellIconClicked);
// routes/user/coupon.js:
// // Check coupon applicability to course (public endpoint for frontend validation)
// router
//   .route("/check-applicability")
//   .get(couponPublicLimit, userCouponController.checkCouponApplicability);
// routes/user/feedback.js:
// // Get course average rating (public)
// router.route("/course/:courseId/average").get(feedbackReadLimit, feedbackController.getCourseAverage);
// ---- controller + service methods ----

// ---- from controllers/user/course.js ----
    takes = async (req, res) => {
        var result = await courseService.takes(req.body.user_id, req.params.id)
        return res.status(result.success ? 200 : 400).json(result)
    }

// ---- from controllers/user/course.js ----
    getScore = async (req, res) => {
        var result = await courseService.getScore(req.body, parseInt(req.params.id))
        return res.status(result.success ? 200 : 400).json(result)
    }


// ---- from controllers/user/course.js ----
    prebookBundle = async (req, res) => {
        // Validate required fields
        const { email, name, phone } = req.body;
        const missingFields = [];

        if (!email || email.trim() === '') missingFields.push('email');
        if (!name || name.trim() === '') missingFields.push('name');
        if (!phone || phone.trim() === '') missingFields.push('phone');

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Missing required fields: ${missingFields.join(', ')}. Name, email, and phone are required for prebooking.`
            });
        }

        var result = await courseService.prebookBundle(req.params.id, req.body)
        return res.status(result.success ? 200 : 400).json(result)
    }


// ---- from controllers/user/course.js ----
    getWishList = async (req, res) => {
        var result = await courseService.getWishList(req.body.user_id)
        return res.status(result.success ? 200 : 400).json(result)
    }


// ---- from controllers/user/course.js ----
    getMyCoursesPage = async (req, res) => {
        var result = await courseService.getMyCoursesPage(req.body.user_id)
        return res.status(result.success ? 200 : 400).json(result)
    }


// ---- from controllers/user/course.js ----
    getMyCourses = async (req, res) => {
        var result = await courseService.getMyCourses(req.body.user_id)
        return res.status(result.success ? 200 : 400).json(result)
    }


// ---- from service/managerial/course.js ----
  getScore = async (reqBody, id) => {
    if (!reqBody.user_id) return { success: true, data: { score: 0 } };
    else {
      //SELECT MAX(p.module_id) as mid from progress p,module m,chapter c where p.user_id=6 and p.module_id=m.id and m.chapter_id=c.id and c.course_id=5
      var query = `
        SELECT COALESCE(SUM(module_points.point), 0) as s
        FROM (
          SELECT p.module_id, MAX(p.point) as point
          FROM progress p
          JOIN module m ON p.module_id = m.id
          JOIN chapter c ON m.chapter_id = c.id
          WHERE p.user_id = $1 AND c.course_id = $2
          GROUP BY p.module_id
        ) module_points
      `;
      var params = [reqBody.user_id, id];
      var result = await this.query(query, params);
      if (!result.success || result.data[0].s === null)
        return { success: true, data: { score: 0 } };
      return { success: true, data: { score: parseInt(result.data[0].s) } };
    }
  };

// ---- from service/managerial/course.js ----
  prebookBundle = async (bundle_id, reqObj) => {
    // console.log(bundle_id, reqObj)
    const utm = reqObj.utm || null;

    // Build params array first to determine correct parameter indices
    var params = [
      bundle_id,
      reqObj.email,
      reqObj.name,
      reqObj.phone,
      parseInt(Date.now() / 1000),
    ];
    if (reqObj.auth) params.push(reqObj.user_id);
    if (utm) params.push(utm);

    // Build parameter placeholders dynamically based on actual params array
    let paramPlaceholders = "$1,$2,$3,$4,$5";
    let paramIndex = 6;
    if (reqObj.auth) {
      paramPlaceholders += `,$${paramIndex}`;
      paramIndex++;
    }
    if (utm) {
      paramPlaceholders += `,$${paramIndex}`;
    }

    var query = `INSERT INTO prebooking_bundle(bundle_id,email,name,phone,timestamp${reqObj.auth ? ",user_id" : ""
      }${utm ? ",utm" : ""}) VALUES (${paramPlaceholders})`;

    var result = await this.query(query, params);
    if (result.success) {
      var bundleQuery = `SELECT * FROM bundle WHERE id=$1`;
      var bundleParams = [bundle_id];
      var bundleResult = await this.query(bundleQuery, bundleParams);
      if (bundleResult.data.length > 0) {
        try {
          await Promise.all([
            messagingService.sendMessage(
              reqObj.phone,
              `Dear ${reqObj.name}, welcome to Math Pro, you have successfully prebooked the "${bundleResult.data[0].title}" bundle, we'll send your coupon when the course gets available.`
            ),
            messagingService.sendMail(
              reqObj.email,
              "Prebooking Successful !!!",
              `
                            <div>
                                Dear ${reqObj.name}, welcome to Math Pro, you have successfully prebooked the "${bundleResult.data[0].title}" bundle, we'll send your coupon when the course gets available.
                            </div>
                        `
            ),
          ]);
        } catch { }
      }
    }
    return result;
  };


// ---- from service/managerial/course.js ----
  getMyCoursesPage = async (user_id) => {
    var result = await Promise.all([
      this.query(
        `
                SELECT 
                    p.user_id AS progress_user_id, 
                    p.module_id AS progress_module_id, 
                    p.point AS progress_point, 
                    p.timestamp AS progress_timestamp,
                
                    m.id AS module_id, 
                    m.chapter_id AS module_chapter_id,
                    m.title AS module_title, 
                    m.description AS module_description, 
                    m.metadata AS module_metadata, 
                    m.data AS module_data, 
                    m.is_live AS module_is_live, 
                    m.is_free AS module_is_free, 
                    m.serial AS module_serial, 
                    m.score AS module_score,
                
                    ch.id AS chapter_id, 
                    ch.course_id AS chapter_course_id,
                    ch.title AS chapter_title, 
                    ch.serial_string AS chapter_serial_string, 
                    ch.chips_list AS chapter_chips_list, 
                    ch.is_free AS chapter_is_free, 
                    ch.is_live AS chapter_is_live,
                    ch.serial AS chapter_serial,
                
                    co.id AS course_id, 
                    co.title AS course_title, 
                    co.x_price AS course_x_price, 
                    co.price AS course_price, 
                    co.language AS course_language, 
                    co.enrolled AS course_enrolled, 
                    co.you_get AS course_you_get, 
                    co.chips AS course_chips, 
                    co.short_description AS course_short_description,
                    co.instructor_list AS course_instructor_list,
                    co.faq_list AS course_faq_list, 
                    co.description AS course_description, 
                    co.feedback_list AS course_feedback_list, 
                    co.intro_video AS course_intro_video, 
                    co.is_live AS course_is_live, 
                    co.serial AS course_serial, 
                    co.url AS course_url,
                    (select count(module.id) from module,chapter where module.chapter_id=chapter.id and chapter.course_id=co.id) AS n_modules
                
                FROM 
                    progress p
                JOIN 
                    module m ON p.module_id = m.id
                JOIN 
                    chapter ch ON m.chapter_id = ch.id
                JOIN 
                    course co ON ch.course_id = co.id
                WHERE 
                    p.user_id = $1
                ORDER BY 
                    p.timestamp DESC
                LIMIT 1;
        
            `,
        [user_id]
      ),
      this.query(`select * from course where is_live=$1`, [true]),
      this.getWishList(user_id),
    ]);
    return {
      success: result[0].success && result[1].success && result[2].success,
      data: {
        continueWatching: result[0].data.length > 0 ? result[0].data[0] : {},
        allLiveCourses: result[1].data,
        wishlist: result[2].data,
      },
    };
  };


// ---- from service/managerial/course.js ----
  getMyCourses = async (user_id) => {
    var result = await this.query(
      `
                select c.* 
                from course c, takes t
                where t.user_id=$1 and t.course_id=c.id
            `,
      [user_id]
    );
    return result;
  };


// ---- from controllers/user/moduleViews.js ----
    /**
     * Get recent viewed modules
     * GET /user/module/recentViews/:courseId
     */
    getRecentViews = async (req, res) => {
        try {
            const courseId = parseInt(req.params.courseId);
            const userId = req.body.user_id; // From auth middleware

            // Validate user_id is set by middleware
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: "Authentication required"
                });
            }

            if (!courseId || isNaN(courseId)) {
                return res.status(400).json({
                    success: false,
                    error: "Valid courseId is required"
                });
            }

            const result = await moduleViewsService.getRecentViews(userId, courseId);

            if (!result.success) {
                // Check if it's an enrollment error
                const errorMessage = result.error?.message || result.error || 'Unknown error';
                if (typeof errorMessage === 'string' && errorMessage.includes("not enrolled")) {
                    return res.status(403).json({
                        success: false,
                        error: errorMessage
                    });
                }
                return res.status(400).json({
                    success: false,
                    error: typeof errorMessage === 'string' ? errorMessage : 'An error occurred'
                });
            }

            return res.status(200).json({
                success: true,
                data: result.data
            });
        } catch (error) {
            console.error('Error in getRecentViews controller:', error);
            return res.status(500).json({
                success: false,
                error: "Internal server error"
            });
        }
    };


// ---- from controllers/user/moduleViews.js ----
    /**
     * Clear recent views
     * DELETE /user/module/recentViews/:courseId
     */
    clearRecentViews = async (req, res) => {
        try {
            const courseId = parseInt(req.params.courseId);
            const userId = req.body.user_id; // From auth middleware

            // Validate user_id is set by middleware
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: "Authentication required"
                });
            }

            if (!courseId || isNaN(courseId)) {
                return res.status(400).json({
                    success: false,
                    error: "Valid courseId is required"
                });
            }

            const result = await moduleViewsService.clearRecentViews(userId, courseId);

            if (!result.success) {
                // Check if it's an enrollment error
                const errorMessage = result.error?.message || result.error || 'Unknown error';
                if (typeof errorMessage === 'string' && errorMessage.includes("not enrolled")) {
                    return res.status(403).json({
                        success: false,
                        error: errorMessage
                    });
                }
                return res.status(400).json({
                    success: false,
                    error: typeof errorMessage === 'string' ? errorMessage : 'An error occurred'
                });
            }

            return res.status(200).json({
                success: true,
                message: "Recent views cleared successfully",
                data: result.data
            });
        } catch (error) {
            console.error('Error in clearRecentViews controller:', error);
            return res.status(500).json({
                success: false,
                error: "Internal server error"
            });
        }
    };

// ---- from service/user/moduleViews.js ----
    /**
     * Get last 5 recently viewed modules for a course
     * @param {number} userId - User ID
     * @param {number} courseId - Course ID
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    getRecentViews = async (userId, courseId) => {
        try {
            // Validate inputs
            if (!userId || !courseId || isNaN(userId) || isNaN(courseId)) {
                return {
                    success: false,
                    error: "Valid userId and courseId are required"
                };
            }

            // Check enrollment
            const enrollmentCheck = await this.checkEnrollment(userId, courseId);
            if (!enrollmentCheck.success || !enrollmentCheck.enrolled) {
                return {
                    success: false,
                    error: "You are not enrolled in this course"
                };
            }

            // Use LEFT JOIN to handle deleted modules/chapters gracefully
            const query = `
                SELECT 
                    umv.module_id as "moduleId",
                    umv.chapter_id as "chapterId",
                    COALESCE(m.title, 'Deleted Module') as "moduleTitle",
                    COALESCE(c.title, 'Deleted Chapter') as "chapterTitle",
                    umv.last_viewed_at as "timestamp",
                    umv.view_count as "viewCount"
                FROM user_module_views umv
                LEFT JOIN module m ON umv.module_id = m.id
                LEFT JOIN chapter c ON umv.chapter_id = c.id
                WHERE umv.user_id = $1 AND umv.course_id = $2
                ORDER BY umv.last_viewed_at DESC
                LIMIT 5
            `;
            
            const result = await this.query(query, [userId, courseId]);
            
            if (!result.success) {
                return {
                    success: false,
                    error: result.error?.message || (typeof result.error === 'string' ? result.error : 'Failed to get recent views')
                };
            }

            // Get total views count
            const countQuery = `
                SELECT COUNT(*) as total
                FROM user_module_views
                WHERE user_id = $1 AND course_id = $2
            `;
            const countResult = await this.query(countQuery, [userId, courseId]);
            const totalViews = countResult.success && countResult.data && countResult.data.length > 0 
                ? parseInt(countResult.data[0].total) || 0
                : 0;
            
            // Handle case where result.data might be null
            const recentViews = (result.data && Array.isArray(result.data)) ? result.data : [];

            return {
                success: true,
                data: {
                    courseId: courseId,
                    recentViews: recentViews,
                    totalViews: totalViews
                }
            };
        } catch (error) {
            console.error('Error getting recent views:', error);
            return {
                success: false,
                error: error.message || 'Failed to get recent views'
            };
        }
    };


// ---- from service/user/moduleViews.js ----
    /**
     * Clear all recent views for a course
     * @param {number} userId - User ID
     * @param {number} courseId - Course ID
     * @returns {Promise<{success: boolean, data?: object, error?: string}>}
     */
    clearRecentViews = async (userId, courseId) => {
        try {
            // Validate inputs
            if (!userId || !courseId || isNaN(userId) || isNaN(courseId)) {
                return {
                    success: false,
                    error: "Valid userId and courseId are required"
                };
            }

            // Check enrollment
            const enrollmentCheck = await this.checkEnrollment(userId, courseId);
            if (!enrollmentCheck.success || !enrollmentCheck.enrolled) {
                return {
                    success: false,
                    error: "You are not enrolled in this course"
                };
            }

            const query = `
                DELETE FROM user_module_views
                WHERE user_id = $1 AND course_id = $2
            `;
            
            const result = await this.query(query, [userId, courseId]);
            
            if (!result.success) {
                return result;
            }

            return {
                success: true,
                data: {
                    courseId: courseId,
                    deletedCount: result.rowCount || 0
                }
            };
        } catch (error) {
            console.error('Error clearing recent views:', error);
            return {
                success: false,
                error: error.message || 'Failed to clear recent views'
            };
        }
    };

// ---- from controllers/user/coupon.js ----
  /**
   * Check if a coupon is applicable to a specific course
   * GET /user/coupon/check-applicability
   * Query: coupon_id, course_id
   */
  checkCouponApplicability = async (req, res) => {
    try {
      const { coupon_id, course_id } = req.query;

      if (!coupon_id || !course_id) {
        return res.status(400).json({
          success: false,
          error: "Coupon ID and course ID are required",
        });
      }

      const couponId = parseInt(coupon_id);
      const courseId = parseInt(course_id);

      if (isNaN(couponId) || isNaN(courseId)) {
        return res.status(400).json({
          success: false,
          error: "Valid coupon ID and course ID are required",
        });
      }

      const result = await couponService.isCouponApplicableToCourse(
        couponId,
        courseId
      );
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("Error in check coupon applicability controller:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

// ---- from controllers/user/notification.js ----
  bellIconClicked = async (req, res) => {
    var result = await notificationService.bellIconClicked(
      req.body.user_id,
      parseInt(req.query.courseId)
    );
    return res.status(result.success ? 200 : 400).json(result);
  };

// ---- from service/user/notification.js ----
  async bellIconClicked(userId, courseId) {
    var query = `update notification set is_bell_icon_clicked = $1 where user_id = $2 and course_id = $3`;
    var params = [true, userId, courseId];
    var result = await this.query(query, params);
    return result;
  }

// ---- from controllers/user/feedback.js ----
    // Get course average rating
    getCourseAverage = async (req, res) => {
        try {
            const { courseId } = req.params;
            const result = await feedbackService.getCourseAverage(courseId);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Error in getCourseAverage:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    };


// ---- from service/feedback.js ----
    // Get course average rating
    getCourseAverage = async (courseId) => {
        try {
            const avgResult = await this.query(
                `SELECT 
                    AVG(rating)::NUMERIC(3,2) as average_rating,
                    COUNT(*) as total_feedbacks
                 FROM feedbacks 
                 WHERE course_id = $1`,
                [courseId]
            );

            const distributionResult = await this.query(
                `SELECT 
                    rating,
                    COUNT(*) as count
                 FROM feedbacks 
                 WHERE course_id = $1
                 GROUP BY rating
                 ORDER BY rating DESC`,
                [courseId]
            );

            if (avgResult.success && distributionResult.success) {
                const avgData = avgResult.data[0];
                const distribution = {};
                
                // Initialize all ratings to 0
                for (let i = 1; i <= 5; i++) {
                    distribution[i] = 0;
                }

                // Fill in actual counts
                distributionResult.data.forEach(row => {
                    distribution[row.rating] = parseInt(row.count);
                });

                return {
                    success: true,
                    courseId,
                    averageRating: parseFloat(avgData.average_rating) || 0,
                    totalFeedbacks: parseInt(avgData.total_feedbacks),
                    ratingDistribution: distribution
                };
            }

            return avgResult;
        } catch (error) {
            console.error('Error getting course average:', error);
            return {
                success: false,
                error: 'Internal server error'
            };
        }
    };

