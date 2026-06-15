const Service = require("../base").Service;

class BundleService extends Service {
  constructor() {
    super();
  }

  // CRUD Operations for Bundles
  create = async (bundleData) => {
    const query = `
            INSERT INTO bundle (title, price, url) 
            VALUES ($1, $2, $3) 
            RETURNING *
        `;
    const params = [bundleData.title, bundleData.price, bundleData.url];
    return await this.query(query, params);
  };

  // Enhanced bundle creation with all fields
  createEnhanced = async (bundleData) => {
    const query = `
            INSERT INTO bundle (
                title, 
                price, 
                url, 
                you_get, 
                chips, 
                short_description, 
                faq_list, 
                feedback_list, 
                intro_video, 
                is_live, 
                is_active
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
            RETURNING *
        `;
    const params = [
      bundleData.title,
      bundleData.price,
      bundleData.url,
      bundleData.you_get ? JSON.stringify(bundleData.you_get) : null,
      bundleData.chips ? JSON.stringify(bundleData.chips) : null,
      bundleData.short_description || null,
      bundleData.faq_list ? JSON.stringify(bundleData.faq_list) : null,
      bundleData.feedback_list
        ? JSON.stringify(bundleData.feedback_list)
        : null,
      bundleData.intro_video || null,
      bundleData.is_live !== undefined ? bundleData.is_live : false,
      bundleData.is_active !== undefined ? bundleData.is_active : true,
    ];
    return await this.query(query, params);
  };

  update = async (id, bundleData) => {
    const query = `
            UPDATE bundle 
            SET title = $1, price = $2, url = $3 
            WHERE id = $4 
            RETURNING *
        `;
    const params = [bundleData.title, bundleData.price, bundleData.url, id];
    return await this.query(query, params);
  };

  // Enhanced bundle update with all fields
  updateEnhanced = async (id, bundleData) => {
    const query = `
            UPDATE bundle 
            SET 
                title = $1, 
                price = $2, 
                url = $3, 
                you_get = $4, 
                chips = $5, 
                short_description = $6, 
                faq_list = $7, 
                feedback_list = $8, 
                intro_video = $9, 
                is_live = $10, 
                is_active = $11
            WHERE id = $12 
            RETURNING *
        `;
    const params = [
      bundleData.title,
      bundleData.price,
      bundleData.url,
      bundleData.you_get ? JSON.stringify(bundleData.you_get) : null,
      bundleData.chips ? JSON.stringify(bundleData.chips) : null,
      bundleData.short_description || null,
      bundleData.faq_list ? JSON.stringify(bundleData.faq_list) : null,
      bundleData.feedback_list
        ? JSON.stringify(bundleData.feedback_list)
        : null,
      bundleData.intro_video || null,
      bundleData.is_live !== undefined ? bundleData.is_live : false,
      bundleData.is_active !== undefined ? bundleData.is_active : true,
      id,
    ];
    return await this.query(query, params);
  };

  delete = async (id) => {
    try {
      // Start transaction
      await this.query("BEGIN");

      // First remove all course associations
      await this.query(`DELETE FROM bundle_course WHERE bundle_id = $1`, [id]);

      // Remove any prebookings for this bundle
      await this.query(`DELETE FROM prebooking_bundle WHERE bundle_id = $1`, [
        id,
      ]);

      // Then remove the bundle
      const query = `DELETE FROM bundle WHERE id = $1 RETURNING *`;
      const result = await this.query(query, [id]);

      // Commit transaction
      await this.query("COMMIT");

      return result;
    } catch (error) {
      await this.query("ROLLBACK");
      console.error("Bundle delete error:", error);
      return { success: false, error: error.message };
    }
  };

  list = async () => {
    const query = `
            SELECT 
                b.*,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', c.id,
                            'title', c.title,
                            'price', c.price,
                            'url', c.url,
                            'chips', c.chips
                        )
                    ) FILTER (WHERE c.id IS NOT NULL), 
                    '[]'::json
                ) as courses,
                COUNT(c.id) as course_count,
                (SELECT COUNT(*) FROM prebooking_bundle WHERE bundle_id = b.id) as prebooking,
                (SELECT COUNT(*) FROM bundle_purchase WHERE bundle_id = b.id) as enrolled
            FROM bundle b
            LEFT JOIN bundle_course bc ON b.id = bc.bundle_id
            LEFT JOIN course c ON bc.course_id = c.id
            GROUP BY b.id
            ORDER BY b.id DESC
        `;
    return await this.query(query);
  };

  getBundleDetails = async (lookupColumn, lookupValue, userId = null) => {
    let result;
    const whereClause =
      lookupColumn === "url" ? "b.url = $1" : "b.id = $1";

    if (userId) {
      const query = `
                SELECT 
                    b.*,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'id', c.id,
                                'title', c.title,
                                'price', c.price,
                                'url', c.url,
                                'short_description', c.short_description,
                                'intro_video', c.intro_video,
                                'chips', c.chips,
                                'enrolled', (
                                    (SELECT COUNT(*) FROM takes WHERE course_id IN (SELECT course_id FROM bundle_course WHERE bundle_id = b.id)) + 
                                    (SELECT COUNT(*) FROM bundle_purchase WHERE bundle_id = b.id)
                                )
                            )
                        ) FILTER (WHERE c.id IS NOT NULL), 
                        '[]'::json
                    ) as courses,
                    COUNT(c.id) as course_count,
                    CASE WHEN bp.id IS NOT NULL THEN true ELSE false END as purchased,
                    bp.timestamp as purchase_date,
                    bp.transaction_id,
                    COALESCE(
                        array_agg(DISTINCT t.course_id) FILTER (WHERE t.course_id IS NOT NULL),
                        ARRAY[]::integer[]
                    ) as owned_courses,
                    (SELECT COUNT(*) FROM prebooking_bundle WHERE bundle_id = b.id) as prebooking,
                    (SELECT COUNT(*) FROM bundle_purchase WHERE bundle_id = b.id) as bundle_purchases
                FROM bundle b
                LEFT JOIN bundle_course bc ON b.id = bc.bundle_id
                LEFT JOIN course c ON bc.course_id = c.id
                LEFT JOIN bundle_purchase bp ON b.id = bp.bundle_id AND bp.user_id = $2
                LEFT JOIN takes t ON t.user_id = $2 AND t.course_id = c.id
                WHERE ${whereClause}
                GROUP BY b.id, bp.id, bp.timestamp, bp.transaction_id
            `;
      result = await this.query(query, [lookupValue, userId]);
    } else {
      const query = `
                SELECT 
                    b.*,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'id', c.id,
                                'title', c.title,
                                'price', c.price,
                                'url', c.url,
                                'short_description', c.short_description,
                                'intro_video', c.intro_video,
                                'chips', c.chips,
                                'enrolled', (
                                    (SELECT COUNT(*) FROM takes WHERE course_id IN (SELECT course_id FROM bundle_course WHERE bundle_id = b.id)) + 
                                    (SELECT COUNT(*) FROM bundle_purchase WHERE bundle_id = b.id)
                                )
                            )
                        ) FILTER (WHERE c.id IS NOT NULL), 
                        '[]'::json
                    ) as courses,
                    COUNT(c.id) as course_count,
                    false as purchased,
                    null as purchase_date,
                    null as transaction_id,
                    ARRAY[]::integer[] as owned_courses,
                    (SELECT COUNT(*) FROM prebooking_bundle WHERE bundle_id = b.id) as prebooking,
                    (SELECT COUNT(*) FROM bundle_purchase WHERE bundle_id = b.id) as bundle_purchases
                FROM bundle b
                LEFT JOIN bundle_course bc ON b.id = bc.bundle_id
                LEFT JOIN course c ON bc.course_id = c.id
                WHERE ${whereClause}
                GROUP BY b.id
            `;
      result = await this.query(query, [lookupValue]);
    }

    if (result.success && result.data && result.data.length > 0) {
      try {
        const CouponService = require('./coupon');
        const couponService = new CouponService();
        const bundleData = result.data[0];
        const activeCouponsResult = await couponService.getActiveCouponsForBundle(bundleData.id);
        
        if (activeCouponsResult.success && activeCouponsResult.data) {
          bundleData.active_coupons = activeCouponsResult.data.map(coupon => ({
            id: coupon.id,
            code: coupon.code,
            name: coupon.name,
            discount_type: coupon.discount_type,
            discount_value: coupon.discount_value,
            description: coupon.description,
            // Calculate potential savings for this bundle
            potential_savings: coupon.discount_type === 'percentage' 
              ? (parseFloat(bundleData.price || 0) * parseFloat(coupon.discount_value) / 100)
              : Math.min(parseFloat(coupon.discount_value), parseFloat(bundleData.price || 0))
          }));
        } else {
          result.data[0].active_coupons = [];
        }
      } catch (error) {
        console.error('Error fetching active coupons for bundle:', error);
        if (result.data && result.data.length > 0) {
          result.data[0].active_coupons = [];
        }
      }
      
      const bundleData = result.data[0];
      
      if (bundleData.courses && Array.isArray(bundleData.courses) && bundleData.courses.length > 0) {
        bundleData.enrolled = parseInt(bundleData.courses[0].enrolled || 0);
      } else {
        const bundlePurchases = parseInt(bundleData.bundle_purchases || 0);
        bundleData.enrolled = bundlePurchases;
      }
      
      delete bundleData.bundle_purchases;

      try {
        const BookService = require('./book').BookService;
        const bookService = new BookService();
        const booksResult = await bookService.booksForBundle(bundleData.id);
        const attachedBooks = booksResult.success ? booksResult.data : [];
        bundleData.attached_books = attachedBooks;
        bundleData.books_total = attachedBooks.reduce(
          (sum, b) => sum + parseInt(b.price || 0),
          0
        );
      } catch (error) {
        console.error('Error fetching attached books for bundle:', error);
        bundleData.attached_books = [];
        bundleData.books_total = 0;
      }
    }

    return result;
  };

  get = async (id, userId = null) => {
    return this.getBundleDetails("id", id, userId);
  };

  getBySlug = async (slug, userId = null) => {
    return this.getBundleDetails("url", slug, userId);
  };

  // Add courses to bundle
  addCoursesToBundle = async (bundleId, courseIds) => {
    try {
      // Start transaction
      await this.query("BEGIN");

      // First remove existing courses
      await this.query(`DELETE FROM bundle_course WHERE bundle_id = $1`, [
        bundleId,
      ]);

      // Add new courses
      if (courseIds && courseIds.length > 0) {
        const promises = courseIds.map((courseId) =>
          this.query(
            `INSERT INTO bundle_course (bundle_id, course_id) VALUES ($1, $2)`,
            [bundleId, courseId]
          )
        );

        await Promise.all(promises);
      }

      // Commit transaction
      await this.query("COMMIT");

      return { success: true, data: { bundleId, courseIds } };
    } catch (error) {
      await this.query("ROLLBACK");
      console.error("Add courses to bundle error:", error);
      return { success: false, error: error.message };
    }
  };

  // Purchase bundle and enroll in all courses
  purchaseBundle = async (userId, bundleId, amount, transactionId) => {
    // Get a client from the pool for transaction
    const client = await this.getClient();

    try {
      // Start transaction on the same client
      await client.query("BEGIN");

      // 1. Record bundle purchase
      const bundlePurchaseQuery = `
                INSERT INTO bundle_purchase (user_id, bundle_id, amount, transaction_id, timestamp)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (user_id, bundle_id) DO UPDATE SET
                    amount = EXCLUDED.amount,
                    transaction_id = EXCLUDED.transaction_id,
                    timestamp = EXCLUDED.timestamp
                RETURNING *
            `;
      const bundlePurchaseResult = await client.query(bundlePurchaseQuery, [
        userId,
        bundleId,
        amount,
        transactionId,
        parseInt(Date.now() / 1000),
      ]);

      // 2. Get all courses in the bundle
      const coursesQuery = `
                SELECT course_id FROM bundle_course WHERE bundle_id = $1
            `;
      const coursesResult = await client.query(coursesQuery, [bundleId]);

      // 3. Enroll user in all courses (only if not already enrolled)
      if (coursesResult.rows && coursesResult.rows.length > 0) {
        const enrollmentPromises = coursesResult.rows.map((course) =>
          client.query(
            `INSERT INTO takes (user_id, course_id, amount, transaction_id, timestamp)
                         VALUES ($1, $2, $3, $4, $5)
                         ON CONFLICT (user_id, course_id) DO NOTHING`,
            [
              userId,
              course.course_id,
              0,
              transactionId,
              parseInt(Date.now() / 1000),
            ]
          )
        );

        await Promise.all(enrollmentPromises);
      }

      // Commit transaction
      await client.query("COMMIT");

      return {
        success: true,
        data: {
          bundlePurchase: bundlePurchaseResult.rows[0],
          coursesEnrolled: coursesResult.rows ? coursesResult.rows.length : 0,
        },
      };
    } catch (error) {
      // Rollback transaction on error
      await client.query("ROLLBACK");
      console.error("Bundle purchase error:", error);
      return { success: false, error: error.message };
    } finally {
      // Always release the client back to the pool
      client.release();
    }
  };

  // Get user's purchased bundles
  getUserBundles = async (userId) => {
    const userIdInt = parseInt(userId);
    const query = `
            SELECT 
                b.*,
                bp.amount,
                bp.transaction_id,
                bp.timestamp as purchase_date,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', c.id,
                            'title', c.title,
                            'url', c.url,
                            'short_description', c.short_description,
                            'chips', c.chips,
                            'enrolled', CASE WHEN t.user_id IS NOT NULL THEN true ELSE false END,
                            'enrollment_date', t.timestamp
                        )
                    ) FILTER (WHERE c.id IS NOT NULL), 
                    '[]'::json
                ) as courses,
                COUNT(c.id) as course_count
            FROM bundle_purchase bp
            JOIN bundle b ON bp.bundle_id = b.id
            LEFT JOIN bundle_course bc ON b.id = bc.bundle_id
            LEFT JOIN course c ON bc.course_id = c.id
            LEFT JOIN takes t ON c.id = t.course_id AND t.user_id = bp.user_id
            WHERE bp.user_id = $1
            GROUP BY b.id, bp.amount, bp.transaction_id, bp.timestamp
            ORDER BY bp.timestamp DESC
        `;
    return await this.query(query, [userIdInt]);
  };

  // Get user's bundle courses (courses from purchased bundles) - SIMPLIFIED
  getUserBundleCourses = async (user_id) => {
    try {
      console.log("=== BUNDLE SERVICE: getUserBundleCourses ===");
      console.log("Input user_id:", user_id, typeof user_id);

      const userIdInt = parseInt(user_id);
      console.log("Converted user_id:", userIdInt, typeof userIdInt);

      if (isNaN(userIdInt)) {
        console.log("❌ Invalid user_id - not a number");
        return { success: false, error: "Invalid user ID" };
      }

      console.log("Executing SQL query...");
      var result = await this.query(
        `
                    select c.*, 'bundle' as enrollment_source
                    from course c, bundle_course bc, bundle_purchase bp
                    where bp.user_id=$1 
                    and bp.bundle_id=bc.bundle_id 
                    and bc.course_id=c.id
                `,
        [userIdInt]
      );

      console.log("Query result:", result.success ? "SUCCESS" : "ERROR");
      if (!result.success) {
        console.log("Query error:", result.error);
      } else {
        console.log("Rows returned:", result.data?.length || 0);
      }
      console.log("=== END BUNDLE SERVICE: getUserBundleCourses ===");

      return result;
    } catch (error) {
      console.error("❌ getUserBundleCourses service error:", error);
      return { success: false, error: error.message };
    }
  };

  // Check for duplicate courses before bundle purchase
  checkBundleCourseDuplicates = async (userId, bundleId) => {
    const userIdInt = parseInt(userId);
    const bundleIdInt = parseInt(bundleId);
    const query = `
            SELECT 
                c.id,
                c.title,
                c.price,
                t.timestamp as already_enrolled_date,
                t.amount as amount_paid,
                t.transaction_id
            FROM bundle_course bc
            JOIN course c ON bc.course_id = c.id
            JOIN takes t ON c.id = t.course_id AND t.user_id = $1
            WHERE bc.bundle_id = $2
            ORDER BY c.title ASC
        `;
    const result = await this.query(query, [userIdInt, bundleIdInt]);

    if (result.success && result.data.length > 0) {
      // Calculate potential savings/loss
      const bundleQuery = `SELECT price FROM bundle WHERE id = $1`;
      const bundleResult = await this.query(bundleQuery, [bundleIdInt]);
      const bundlePrice = bundleResult.data[0]?.price || 0;

      const alreadyPaidAmount = result.data.reduce(
        (sum, course) => sum + (course.amount_paid || 0),
        0
      );
      const duplicateCoursesValue = result.data.reduce(
        (sum, course) => sum + course.price,
        0
      );

      return {
        success: true,
        data: {
          hasDuplicates: true,
          duplicateCourses: result.data,
          duplicateCount: result.data.length,
          bundlePrice: bundlePrice,
          alreadyPaidAmount: alreadyPaidAmount,
          duplicateCoursesValue: duplicateCoursesValue,
          potentialLoss: alreadyPaidAmount,
          recommendation:
            alreadyPaidAmount > bundlePrice
              ? "Bundle purchase is still economical"
              : "Consider individual course purchases instead",
        },
      };
    }

    return {
      success: true,
      data: {
        hasDuplicates: false,
        duplicateCourses: [],
        duplicateCount: 0,
        recommendation: "Safe to purchase bundle",
      },
    };
  };

  // Get comprehensive user course access (both individual and bundle courses) - SIMPLIFIED
  getUserAllCourses = async (user_id) => {
    try {
      console.log("=== BUNDLE SERVICE: getUserAllCourses ===");
      console.log("Input user_id:", user_id, typeof user_id);

      const userIdInt = parseInt(user_id);
      console.log("Converted user_id:", userIdInt, typeof userIdInt);

      if (isNaN(userIdInt)) {
        console.log("❌ Invalid user_id - not a number");
        return { success: false, error: "Invalid user ID" };
      }

      console.log("Executing SQL query for all courses...");
      var result = await this.query(
        `
                    select c.*, t.timestamp as enrollment_date, t.amount as paid_amount, t.transaction_id
                    from course c, takes t
                    where t.user_id=$1 and t.course_id=c.id
                    order by t.timestamp desc
                `,
        [userIdInt]
      );

      console.log("Query result:", result.success ? "SUCCESS" : "ERROR");
      if (!result.success) {
        console.log("Query error:", result.error);
      } else {
        console.log("Rows returned:", result.data?.length || 0);
      }
      console.log("=== END BUNDLE SERVICE: getUserAllCourses ===");

      return result;
    } catch (error) {
      console.error("❌ getUserAllCourses service error:", error);
      return { success: false, error: error.message };
    }
  };

  // Check if user has purchased a bundle
  hasUserPurchasedBundle = async (userId, bundleId) => {
    const userIdInt = parseInt(userId);
    const bundleIdInt = parseInt(bundleId);
    const query = `
            SELECT COUNT(*) as count FROM bundle_purchase 
            WHERE user_id = $1 AND bundle_id = $2
        `;
    const result = await this.query(query, [userIdInt, bundleIdInt]);
    return result.success && result.data[0].count > 0;
  };

  // Check if user has prebooked a bundle
  hasUserPrebookedBundle = async (userId, bundleId) => {
    const userIdInt = parseInt(userId);
    const bundleIdInt = parseInt(bundleId);
    const query = `
            SELECT COUNT(*) as count FROM prebooking_bundle 
            WHERE user_id = $1 AND bundle_id = $2
        `;
    const result = await this.query(query, [userIdInt, bundleIdInt]);
    return result.success && result.data[0].count > 0;
  };

  // Get bundle statistics
  getBundleStats = async (bundleId) => {
    const bundleIdInt = parseInt(bundleId);
    const query = `
            SELECT 
                COUNT(DISTINCT bp.user_id) as total_purchases,
                COALESCE(SUM(bp.amount), 0) as total_revenue,
                COUNT(DISTINCT bc.course_id) as course_count
            FROM bundle b
            LEFT JOIN bundle_purchase bp ON b.id = bp.bundle_id
            LEFT JOIN bundle_course bc ON b.id = bc.bundle_id
            WHERE b.id = $1
            GROUP BY b.id
        `;
    return await this.query(query, [bundleIdInt]);
  };

  // Get all bundle purchases for admin
  getAllBundlePurchases = async (bundleId = null) => {
    // Fixed: Use phone and email columns instead of login and profile->>'email'
    let query = `
            SELECT 
                bp.*,
                b.title as bundle_title,
                ma.name as user_name,
                ma.phone as user_phone,
                ma.email as user_email
            FROM bundle_purchase bp
            JOIN bundle b ON bp.bundle_id = b.id
            JOIN managerial_auth ma ON bp.user_id = ma.id
        `;

    let params = [];
    if (bundleId) {
      const bundleIdInt = parseInt(bundleId);
      query += ` WHERE bp.bundle_id = $1`;
      params = [bundleIdInt];
    }

    query += ` ORDER BY bp.timestamp DESC`;

    return await this.query(query, params);
  };

  // Get all bundle purchases for admin - JSON API Response with formatted fields
  getAllBundlePurchasesApi = async (bundleId = null) => {
    try {
      // Fixed: Use phone and email columns instead of login and profile->>'email'
      let query = `
            SELECT 
                ma.name,
                ma.phone,
                ma.email,
                bp.timestamp,
                bp.user_id,
                b.title as bundle_title,
                b.id as bundle_id,
                bp.amount,
                bp.transaction_id,
                bp.id as purchase_id,
                -- Coupon information
                CASE WHEN cu.id IS NOT NULL THEN true ELSE false END as coupon_used,
                c.code as coupon_code,
                c.name as coupon_name,
                c.discount_type,
                c.discount_value,
                cu.original_price,
                cu.discount_amount,
                cu.final_price,
                COALESCE(cu.discount_amount, 0) as amount_saved
            FROM bundle_purchase bp
            JOIN bundle b ON bp.bundle_id = b.id
            JOIN managerial_auth ma ON bp.user_id = ma.id
            LEFT JOIN coupon_usage cu ON cu.transaction_id = bp.transaction_id 
                AND cu.bundle_id = bp.bundle_id 
                AND cu.user_id = bp.user_id
                AND cu.payment_status = 'completed'
            LEFT JOIN coupons c ON cu.coupon_id = c.id
        `;

      let params = [];
      if (bundleId) {
        const bundleIdInt = parseInt(bundleId);
        if (isNaN(bundleIdInt)) {
          return {
            success: false,
            error: "Invalid bundle_id parameter. Must be a valid integer.",
          };
        }
        query += ` WHERE bp.bundle_id = $1`;
        params = [bundleIdInt];
      }

      query += ` ORDER BY bp.timestamp DESC`;

      return await this.query(query, params);
    } catch (error) {
      console.error("Get bundle purchases API error:", error);
      return {
        success: false,
        error: error.message || "Failed to retrieve bundle purchases",
      };
    }
  };

  // Get all bundle prebookings for admin
  getAllBundlePrebookings = async (bundleId = null) => {
    let query = `
            SELECT 
                pb.name,
                pb.phone,
                pb.email,
                pb.timestamp,
                pb.user_id,
                pb.utm,
                b.title as bundle_title,
                b.id as bundle_id
            FROM prebooking_bundle pb
            JOIN bundle b ON pb.bundle_id = b.id
        `;

    let params = [];
    if (bundleId) {
      const bundleIdInt = parseInt(bundleId);
      query += ` WHERE pb.bundle_id = $1`;
      params = [bundleIdInt];
    }

    query += ` ORDER BY pb.timestamp DESC`;

    return await this.query(query, params);
  };
}

module.exports = { BundleService };
