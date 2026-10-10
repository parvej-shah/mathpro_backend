// Which courses and bundles a coupon applies to (coupon_courses / coupon_bundles).
// Part of CouponService (service/managerial/coupon.js), which callers use.
const { Service } = require("../../base");
const logger = require('../../../util/logger');

// The item tables a coupon can target and the words used in replies about them.
const TARGETS = {
  course: { noun: "course", Plural: "Courses", table: "course", link: "coupon_courses", column: "course_id" },
  bundle: { noun: "bundle", Plural: "Bundles", table: "bundle", link: "coupon_bundles", column: "bundle_id" },
};

class CouponTargetingService extends Service {
  constructor() {
    super();
  }

  // Links coupon → items for one target type (TARGETS.course / TARGETS.bundle); ids that
  // are already linked are skipped. Replies name the type ("course IDs", addedCourses, …).
  addTargets = async (target, couponId, ids) => {
    const { noun, Plural, table, link, column } = target;
    try {
      if (!couponId || !Array.isArray(ids) || ids.length === 0) {
        return { success: false, error: `Coupon ID and ${noun} IDs array are required` };
      }

      const couponCheck = await this.query(
        "SELECT id FROM coupons WHERE id = $1 AND status != $2",
        [couponId, "deleted"]
      );
      if (!couponCheck.success || couponCheck.data.length === 0) {
        return { success: false, error: "Coupon not found" };
      }

      // Validate that all ids exist
      const itemCheck = await this.query(`SELECT id FROM ${table} WHERE id = ANY($1)`, [ids]);
      if (!itemCheck.success) {
        return { success: false, error: `Failed to validate ${noun} IDs` };
      }
      const validIds = itemCheck.data.map((row) => row.id);
      const invalidIds = ids.filter((id) => !validIds.includes(parseInt(id)));
      if (invalidIds.length > 0) {
        return { success: false, error: `Invalid ${noun} IDs: ${invalidIds.join(", ")}` };
      }

      // Skip ids already linked to this coupon
      const existing = await this.query(`SELECT ${column} FROM ${link} WHERE coupon_id = $1`, [couponId]);
      const existingIds = existing.success ? existing.data.map((row) => row[column]) : [];
      const newIds = ids.filter((id) => !existingIds.includes(parseInt(id)));
      if (newIds.length === 0) {
        return {
          success: true,
          message: `All ${noun}s are already associated with this coupon`,
          data: { addedCount: 0, existingCount: ids.length },
        };
      }

      const currentTime = Math.floor(Date.now() / 1000);
      const insertValues = newIds.map((_id, index) => `($1, $${index + 2}, $${newIds.length + 2})`).join(", ");
      const insertResult = await this.query(
        `
        INSERT INTO ${link} (coupon_id, ${column}, created_at)
        VALUES ${insertValues}
        RETURNING id, ${column}
      `,
        [couponId, ...newIds, currentTime]
      );

      if (insertResult.success) {
        return {
          success: true,
          message: `Successfully associated ${insertResult.data.length} ${noun}s with coupon`,
          data: {
            addedCount: insertResult.data.length,
            existingCount: ids.length - insertResult.data.length,
            [`added${Plural}`]: insertResult.data,
          },
        };
      }
      return { success: false, error: `Failed to create ${noun} associations` };
    } catch (error) {
      logger.error(`Error adding ${noun}s to coupon:`, error);
      return { success: false, error: `Failed to add ${noun}s to coupon` };
    }
  };

  removeTargets = async (target, couponId, ids) => {
    const { noun, Plural, link, column } = target;
    try {
      if (!couponId || !Array.isArray(ids) || ids.length === 0) {
        return { success: false, error: `Coupon ID and ${noun} IDs array are required` };
      }

      const couponCheck = await this.query(
        "SELECT id FROM coupons WHERE id = $1 AND status != $2",
        [couponId, "deleted"]
      );
      if (!couponCheck.success || couponCheck.data.length === 0) {
        return { success: false, error: "Coupon not found" };
      }

      const deleteResult = await this.query(
        `
        DELETE FROM ${link}
        WHERE coupon_id = $1 AND ${column} = ANY($2)
        RETURNING id, ${column}
      `,
        [couponId, ids]
      );

      if (deleteResult.success) {
        return {
          success: true,
          message: `Successfully removed ${deleteResult.data.length} ${noun} associations`,
          data: {
            removedCount: deleteResult.data.length,
            [`removed${Plural}`]: deleteResult.data,
          },
        };
      }
      return { success: false, error: `Failed to remove ${noun} associations` };
    } catch (error) {
      logger.error(`Error removing ${noun}s from coupon:`, error);
      return { success: false, error: `Failed to remove ${noun}s from coupon` };
    }
  };

  addCoursesToCoupon = (couponId, courseIds) => this.addTargets(TARGETS.course, couponId, courseIds);

  removeCoursesFromCoupon = (couponId, courseIds) => this.removeTargets(TARGETS.course, couponId, courseIds);

  addBundlesToCoupon = (couponId, bundleIds) => this.addTargets(TARGETS.bundle, couponId, bundleIds);

  removeBundlesFromCoupon = (couponId, bundleIds) => this.removeTargets(TARGETS.bundle, couponId, bundleIds);

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
