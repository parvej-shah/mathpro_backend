// Which courses and bundles a coupon applies to (coupon_courses / coupon_bundles).
// Part of CouponService (service/managerial/coupon.js), which callers use.
const { Service } = require("../../base");
const logger = require('../../../util/logger');

class CouponTargetingService extends Service {
  constructor() {
    super();
  }

  /**
   * Add course associations to a coupon
   * @param {number} couponId - Coupon ID
   * @param {Array} courseIds - Array of course IDs to associate
   * @returns {Object} Result object with success status
   */
  addCoursesToCoupon = async (couponId, courseIds) => {
    try {
      if (!couponId || !Array.isArray(courseIds) || courseIds.length === 0) {
        return {
          success: false,
          error: "Coupon ID and course IDs array are required",
        };
      }

      // Check if coupon exists
      const couponCheck = await this.query(
        "SELECT id FROM coupons WHERE id = $1 AND status != $2",
        [couponId, "deleted"]
      );

      if (!couponCheck.success || couponCheck.data.length === 0) {
        return {
          success: false,
          error: "Coupon not found",
        };
      }

      // Validate that all course IDs exist
      const courseCheck = await this.query(
        `SELECT id FROM course WHERE id = ANY($1)`,
        [courseIds]
      );

      if (!courseCheck.success) {
        return {
          success: false,
          error: "Failed to validate course IDs",
        };
      }

      const validCourseIds = courseCheck.data.map((row) => row.id);
      const invalidCourseIds = courseIds.filter(
        (id) => !validCourseIds.includes(parseInt(id))
      );

      if (invalidCourseIds.length > 0) {
        return {
          success: false,
          error: `Invalid course IDs: ${invalidCourseIds.join(", ")}`,
        };
      }

      // Get existing associations to avoid duplicates
      const existingAssociations = await this.query(
        "SELECT course_id FROM coupon_courses WHERE coupon_id = $1",
        [couponId]
      );

      const existingCourseIds = existingAssociations.success
        ? existingAssociations.data.map((row) => row.course_id)
        : [];

      // Filter out already associated courses
      const newCourseIds = courseIds.filter(
        (id) => !existingCourseIds.includes(parseInt(id))
      );

      if (newCourseIds.length === 0) {
        return {
          success: true,
          message: "All courses are already associated with this coupon",
          data: { addedCount: 0, existingCount: courseIds.length },
        };
      }

      // Insert new associations
      const currentTime = Math.floor(Date.now() / 1000);
      const insertValues = newCourseIds
        .map(
          (courseId, index) =>
            `($1, $${index + 2}, $${newCourseIds.length + 2})`
        )
        .join(", ");

      const insertParams = [couponId, ...newCourseIds, currentTime];

      const insertResult = await this.query(
        `
        INSERT INTO coupon_courses (coupon_id, course_id, created_at)
        VALUES ${insertValues}
        RETURNING id, course_id
      `,
        insertParams
      );

      if (insertResult.success) {
        return {
          success: true,
          message: `Successfully associated ${insertResult.data.length} courses with coupon`,
          data: {
            addedCount: insertResult.data.length,
            existingCount: courseIds.length - insertResult.data.length,
            addedCourses: insertResult.data,
          },
        };
      }

      return {
        success: false,
        error: "Failed to create course associations",
      };
    } catch (error) {
      logger.error("Error adding courses to coupon:", error);
      return {
        success: false,
        error: "Failed to add courses to coupon",
      };
    }
  };

  /**
   * Remove course associations from a coupon
   * @param {number} couponId - Coupon ID
   * @param {Array} courseIds - Array of course IDs to remove
   * @returns {Object} Result object with success status
   */
  removeCoursesFromCoupon = async (couponId, courseIds) => {
    try {
      if (!couponId || !Array.isArray(courseIds) || courseIds.length === 0) {
        return {
          success: false,
          error: "Coupon ID and course IDs array are required",
        };
      }

      // Check if coupon exists
      const couponCheck = await this.query(
        "SELECT id FROM coupons WHERE id = $1 AND status != $2",
        [couponId, "deleted"]
      );

      if (!couponCheck.success || couponCheck.data.length === 0) {
        return {
          success: false,
          error: "Coupon not found",
        };
      }

      // Remove associations
      const deleteResult = await this.query(
        `
        DELETE FROM coupon_courses 
        WHERE coupon_id = $1 AND course_id = ANY($2)
        RETURNING id, course_id
      `,
        [couponId, courseIds]
      );

      if (deleteResult.success) {
        return {
          success: true,
          message: `Successfully removed ${deleteResult.data.length} course associations`,
          data: {
            removedCount: deleteResult.data.length,
            removedCourses: deleteResult.data,
          },
        };
      }

      return {
        success: false,
        error: "Failed to remove course associations",
      };
    } catch (error) {
      logger.error("Error removing courses from coupon:", error);
      return {
        success: false,
        error: "Failed to remove courses from coupon",
      };
    }
  };

  /**
   * Get all courses associated with a coupon
   * @param {number} couponId - Coupon ID
   * @returns {Object} Result object with course list
   */
  getCouponCourses = async (couponId) => {
    try {
      if (!couponId) {
        return {
          success: false,
          error: "Coupon ID is required",
        };
      }

      // Check if coupon exists
      const couponCheck = await this.query(
        "SELECT id, name, code FROM coupons WHERE id = $1 AND status != $2",
        [couponId, "deleted"]
      );

      if (!couponCheck.success || couponCheck.data.length === 0) {
        return {
          success: false,
          error: "Coupon not found",
        };
      }

      // Get associated courses
      const coursesResult = await this.query(
        `
        SELECT c.id, c.title, c.price, cc.created_at as associated_at
        FROM coupon_courses cc
        JOIN course c ON cc.course_id = c.id
        WHERE cc.coupon_id = $1
        ORDER BY c.title
      `,
        [couponId]
      );

      if (coursesResult.success) {
        return {
          success: true,
          data: {
            coupon: couponCheck.data[0],
            courses: coursesResult.data,
            totalCourses: coursesResult.data.length,
          },
        };
      }

      return {
        success: false,
        error: "Failed to retrieve associated courses",
      };
    } catch (error) {
      logger.error("Error getting coupon courses:", error);
      return {
        success: false,
        error: "Failed to retrieve coupon courses",
      };
    }
  };

  /**
   * Get all available courses that can be associated with coupons
   * @param {number} couponId - Optional coupon ID to exclude already associated courses
   * @returns {Object} Result object with available courses
   */
  getAvailableCourses = async (couponId = null) => {
    try {
      let query = "SELECT id, title, price FROM course ORDER BY title";
      let params = [];

      if (couponId) {
        query = `
          SELECT c.id, c.title, c.price 
          FROM course c
          WHERE c.id NOT IN (
            SELECT cc.course_id 
            FROM coupon_courses cc 
            WHERE cc.coupon_id = $1
          )
          ORDER BY c.title
        `;
        params = [couponId];
      }

      const result = await this.query(query, params);

      if (result.success) {
        return {
          success: true,
          data: result.data,
          totalCourses: result.data.length,
        };
      }

      return {
        success: false,
        error: "Failed to retrieve available courses",
      };
    } catch (error) {
      logger.error("Error getting available courses:", error);
      return {
        success: false,
        error: "Failed to retrieve available courses",
      };
    }
  };

  /**
   * Add bundle associations to a coupon
   * @param {number} couponId - Coupon ID
   * @param {Array} bundleIds - Array of bundle IDs to associate
   * @returns {Object} Result object with success status
   */
  addBundlesToCoupon = async (couponId, bundleIds) => {
    try {
      if (!couponId || !Array.isArray(bundleIds) || bundleIds.length === 0) {
        return {
          success: false,
          error: "Coupon ID and bundle IDs array are required",
        };
      }

      // Check if coupon exists
      const couponCheck = await this.query(
        "SELECT id FROM coupons WHERE id = $1 AND status != $2",
        [couponId, "deleted"]
      );

      if (!couponCheck.success || couponCheck.data.length === 0) {
        return {
          success: false,
          error: "Coupon not found",
        };
      }

      // Validate that all bundle IDs exist
      const bundleCheck = await this.query(
        `SELECT id FROM bundle WHERE id = ANY($1)`,
        [bundleIds]
      );

      if (!bundleCheck.success) {
        return {
          success: false,
          error: "Failed to validate bundle IDs",
        };
      }

      const validBundleIds = bundleCheck.data.map((row) => row.id);
      const invalidBundleIds = bundleIds.filter(
        (id) => !validBundleIds.includes(parseInt(id))
      );

      if (invalidBundleIds.length > 0) {
        return {
          success: false,
          error: `Invalid bundle IDs: ${invalidBundleIds.join(", ")}`,
        };
      }

      // Get existing associations to avoid duplicates
      const existingAssociations = await this.query(
        "SELECT bundle_id FROM coupon_bundles WHERE coupon_id = $1",
        [couponId]
      );

      const existingBundleIds = existingAssociations.success
        ? existingAssociations.data.map((row) => row.bundle_id)
        : [];

      // Filter out already associated bundles
      const newBundleIds = bundleIds.filter(
        (id) => !existingBundleIds.includes(parseInt(id))
      );

      if (newBundleIds.length === 0) {
        return {
          success: true,
          message: "All bundles are already associated with this coupon",
          data: { addedCount: 0, existingCount: bundleIds.length },
        };
      }

      // Insert new associations
      const currentTime = Math.floor(Date.now() / 1000);
      const insertValues = newBundleIds
        .map(
          (bundleId, index) =>
            `($1, $${index + 2}, $${newBundleIds.length + 2})`
        )
        .join(", ");

      const insertParams = [couponId, ...newBundleIds, currentTime];

      const insertResult = await this.query(
        `
        INSERT INTO coupon_bundles (coupon_id, bundle_id, created_at)
        VALUES ${insertValues}
        RETURNING id, bundle_id
      `,
        insertParams
      );

      if (insertResult.success) {
        return {
          success: true,
          message: `Successfully associated ${insertResult.data.length} bundles with coupon`,
          data: {
            addedCount: insertResult.data.length,
            existingCount: bundleIds.length - insertResult.data.length,
            addedBundles: insertResult.data,
          },
        };
      }

      return {
        success: false,
        error: "Failed to create bundle associations",
      };
    } catch (error) {
      logger.error("Error adding bundles to coupon:", error);
      return {
        success: false,
        error: "Failed to add bundles to coupon",
      };
    }
  };

  /**
   * Remove bundle associations from a coupon
   * @param {number} couponId - Coupon ID
   * @param {Array} bundleIds - Array of bundle IDs to remove
   * @returns {Object} Result object with success status
   */
  removeBundlesFromCoupon = async (couponId, bundleIds) => {
    try {
      if (!couponId || !Array.isArray(bundleIds) || bundleIds.length === 0) {
        return {
          success: false,
          error: "Coupon ID and bundle IDs array are required",
        };
      }

      // Check if coupon exists
      const couponCheck = await this.query(
        "SELECT id FROM coupons WHERE id = $1 AND status != $2",
        [couponId, "deleted"]
      );

      if (!couponCheck.success || couponCheck.data.length === 0) {
        return {
          success: false,
          error: "Coupon not found",
        };
      }

      // Remove associations
      const deleteResult = await this.query(
        `
        DELETE FROM coupon_bundles 
        WHERE coupon_id = $1 AND bundle_id = ANY($2)
        RETURNING id, bundle_id
      `,
        [couponId, bundleIds]
      );

      if (deleteResult.success) {
        return {
          success: true,
          message: `Successfully removed ${deleteResult.data.length} bundle associations`,
          data: {
            removedCount: deleteResult.data.length,
            removedBundles: deleteResult.data,
          },
        };
      }

      return {
        success: false,
        error: "Failed to remove bundle associations",
      };
    } catch (error) {
      logger.error("Error removing bundles from coupon:", error);
      return {
        success: false,
        error: "Failed to remove bundles from coupon",
      };
    }
  };

  /**
   * Get bundles associated with a coupon
   * @param {number} couponId - Coupon ID
   * @returns {Object} Result object with bundle data
   */
  getCouponBundles = async (couponId) => {
    try {
      if (!couponId) {
        return {
          success: false,
          error: "Coupon ID is required",
        };
      }

      // Check if coupon exists
      const couponCheck = await this.query(
        "SELECT id FROM coupons WHERE id = $1 AND status != $2",
        [couponId, "deleted"]
      );

      if (!couponCheck.success || couponCheck.data.length === 0) {
        return {
          success: false,
          error: "Coupon not found",
        };
      }

      // Get associated bundles
      const result = await this.query(
        `
        SELECT 
          b.id,
          b.title,
          b.price,
          b.url,
          cb.created_at as associated_at
        FROM coupon_bundles cb
        JOIN bundle b ON cb.bundle_id = b.id
        WHERE cb.coupon_id = $1
        ORDER BY b.title
      `,
        [couponId]
      );

      if (result.success) {
        return {
          success: true,
          data: result.data,
          totalBundles: result.data.length,
        };
      }

      return {
        success: false,
        error: "Failed to retrieve coupon bundles",
      };
    } catch (error) {
      logger.error("Error getting coupon bundles:", error);
      return {
        success: false,
        error: "Failed to retrieve coupon bundles",
      };
    }
  };

  /**
   * Get available bundles that can be associated with coupons
   * @param {number} couponId - Optional coupon ID to exclude already associated bundles
   * @returns {Object} Result object with available bundle data
   */
  getAvailableBundles = async (couponId = null) => {
    try {
      let query = "SELECT id, title, price FROM bundle ORDER BY title";
      let params = [];

      if (couponId) {
        query = `
          SELECT b.id, b.title, b.price 
          FROM bundle b
          WHERE b.id NOT IN (
            SELECT cb.bundle_id 
            FROM coupon_bundles cb 
            WHERE cb.coupon_id = $1
          )
          ORDER BY b.title
        `;
        params = [couponId];
      }

      const result = await this.query(query, params);

      if (result.success) {
        return {
          success: true,
          data: result.data,
          totalBundles: result.data.length,
        };
      }

      return {
        success: false,
        error: "Failed to retrieve available bundles",
      };
    } catch (error) {
      logger.error("Error getting available bundles:", error);
      return {
        success: false,
        error: "Failed to retrieve available bundles",
      };
    }
  };
}

module.exports = { CouponTargetingService };
