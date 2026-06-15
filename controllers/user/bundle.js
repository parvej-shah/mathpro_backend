const Controller = require("../base").Controller;
const { BundleService } = require("../../service/managerial/bundle");

const bundleService = new BundleService();

class UserBundleController extends Controller {
  constructor() {
    super();
  }

  // Get all available bundles for users
  list = async (req, res) => {
    try {
      const result = await bundleService.list();
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("User bundle list error:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  // Get specific bundle details
  get = async (req, res) => {
    try {
      const { id } = req.params;
      if (!/^\d+$/.test(String(id))) {
        return res.status(400).json({
          success: false,
          error: "Bundle ID must be numeric",
        });
      }

      const userId = req.body?.user_id ? parseInt(req.body.user_id) : null;
      const result = await bundleService.get(parseInt(id, 10), userId);
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("User bundle get error:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  getBySlug = async (req, res) => {
    try {
      const { slug } = req.params;
      const userId = req.body?.user_id ? parseInt(req.body.user_id) : null;

      const result = await bundleService.getBySlug(slug, userId);
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("User bundle get by slug error:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  // Get user's purchased bundles
  getMyBundles = async (req, res) => {
    try {
      console.log("=== GET MY BUNDLES API ===");
      console.log("Request params:", req.params);
      console.log("Request body:", req.body);

      // Try URL parameter first, then request body (for backward compatibility)
      const user_id = req.params.user_id || req.body.user_id;
      console.log(
        "User ID source:",
        req.params.user_id ? "URL params" : "Request body"
      );
      console.log("Extracted user_id:", user_id, typeof user_id);

      if (!user_id) {
        console.log("❌ No user_id provided");
        return res.status(400).json({
          success: false,
          error: "User ID is required",
        });
      }

      const userIdInt = parseInt(user_id);
      console.log("Converted to integer:", userIdInt, typeof userIdInt);

      const result = await bundleService.getUserBundles(userIdInt);
      console.log("Service result:", result.success ? "SUCCESS" : "ERROR");
      console.log("=== END GET MY BUNDLES API ===");

      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("❌ Get my bundles error:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
        details: error.message,
      });
    }
  };

  // Check if user has purchased a specific bundle
  checkPurchaseStatus = async (req, res) => {
    try {
      const { id, user_id } = req.params;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          error: "User ID is required",
        });
      }

      const userIdInt = parseInt(user_id);
      const hasPurchased = await bundleService.hasUserPurchasedBundle(
        userIdInt,
        parseInt(id)
      );

      return res.status(200).json({
        success: true,
        data: { purchased: hasPurchased },
      });
    } catch (error) {
      console.error("Check bundle purchase status error:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  // Check if user has prebooked a specific bundle
  checkPrebookStatus = async (req, res) => {
    try {
      const { id, user_id } = req.params;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          error: "User ID is required",
        });
      }

      const userIdInt = parseInt(user_id);
      const hasPrebooked = await bundleService.hasUserPrebookedBundle(
        userIdInt,
        parseInt(id)
      );

      return res.status(200).json({
        success: true,
        data: { prebooked: hasPrebooked },
      });
    } catch (error) {
      console.error("Check bundle prebook status error:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  // Get user's bundle courses (courses from purchased bundles)
  getBundleCourses = async (req, res) => {
    try {
      console.log("=== GET BUNDLE COURSES API ===");
      console.log("Request params:", req.params);
      console.log("Request body:", req.body);
      console.log("Request URL:", req.url);

      // Try URL parameter first, then request body (for backward compatibility)
      const user_id = req.params.user_id || req.body.user_id;
      console.log(
        "User ID source:",
        req.params.user_id ? "URL params" : "Request body"
      );
      console.log("Extracted user_id:", user_id, typeof user_id);

      if (!user_id) {
        console.log("❌ No user_id provided");
        return res.status(400).json({
          success: false,
          error: "User ID is required",
        });
      }

      const userIdInt = parseInt(user_id);
      console.log("Converted to integer:", userIdInt, typeof userIdInt);

      console.log("Calling bundleService.getUserBundleCourses...");
      const result = await bundleService.getUserBundleCourses(userIdInt);
      console.log(
        "Service result:",
        result.success ? "SUCCESS" : "ERROR",
        result.error || "No error"
      );
      console.log("=== END GET BUNDLE COURSES API ===");

      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("❌ Get bundle courses error:", error);
      console.error("Error stack:", error.stack);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
        details: error.message,
      });
    }
  };

  // Check for duplicate courses before bundle purchase
  checkDuplicateCourses = async (req, res) => {
    try {
      const { id, user_id } = req.params;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          error: "User ID is required",
        });
      }

      const userIdInt = parseInt(user_id);
      const result = await bundleService.checkBundleCourseDuplicates(
        userIdInt,
        parseInt(id)
      );

      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("Check duplicate courses error:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  // Get all user courses (both individual and bundle courses)
  getAllCourses = async (req, res) => {
    try {
      console.log("=== GET ALL COURSES API ===");
      console.log("Request params:", req.params);
      console.log("Request body:", req.body);
      console.log("Request URL:", req.url);

      // Try URL parameter first, then request body (for backward compatibility)
      const user_id = req.params.user_id || req.body.user_id;
      console.log(
        "User ID source:",
        req.params.user_id ? "URL params" : "Request body"
      );
      console.log("Extracted user_id:", user_id, typeof user_id);

      if (!user_id) {
        console.log("❌ No user_id provided");
        return res.status(400).json({
          success: false,
          error: "User ID is required",
        });
      }

      const userIdInt = parseInt(user_id);
      console.log("Converted to integer:", userIdInt, typeof userIdInt);

      console.log("Calling bundleService.getUserAllCourses...");
      const result = await bundleService.getUserAllCourses(userIdInt);
      console.log(
        "Service result:",
        result.success ? "SUCCESS" : "ERROR",
        result.error || "No error"
      );
      console.log("=== END GET ALL COURSES API ===");

      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("❌ Get all courses error:", error);
      console.error("Error stack:", error.stack);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
        details: error.message,
      });
    }
  };

  // Get course access for a specific bundle (NEW API)
  getCourseAccess = async (req, res) => {
    try {
      console.log("=== GET COURSE ACCESS API ===");
      console.log("Request params:", req.params);

      const { id } = req.params; // bundle_id
      const { user_id } = req.body || req.params;

      console.log("Bundle ID:", id, "User ID:", user_id);

      if (!user_id) {
        return res.status(400).json({
          success: false,
          error: "User ID is required",
        });
      }

      const userIdInt = parseInt(user_id);
      const bundleIdInt = parseInt(id);

      // Check if user has purchased this bundle
      const hasPurchased = await bundleService.hasUserPurchasedBundle(
        userIdInt,
        bundleIdInt
      );

      if (!hasPurchased) {
        return res.status(403).json({
          success: false,
          error: "Bundle not purchased",
        });
      }

      // Get bundle courses that user has access to
      const result = await bundleService.get(bundleIdInt, userIdInt);
      console.log("=== END GET COURSE ACCESS API ===");

      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("❌ Get course access error:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
        details: error.message,
      });
    }
  };
}

module.exports = { UserBundleController };
