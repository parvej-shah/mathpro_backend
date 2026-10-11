const Controller = require("../base").Controller;
const { respond, catchAs, handle } = require('../base');
const { BundleService } = require("../../service/managerial/bundle");

const bundleService = new BundleService();

// 400 "User ID is required" when `userId` is missing (and returns null); otherwise its integer.
const parseUserId = (res, userId) => {
  if (!userId) {
    res.status(400).json({
      success: false,
      error: "User ID is required",
    });
    return null;
  }
  return parseInt(userId);
};

// Handler for "everything of one user" lookups: user_id from the URL, else (backward
// compatibility) the one the auth middleware put in the body.
const forUser = (serviceCall) => async (req, res) => {
  const userIdInt = parseUserId(res, req.params.user_id || req.body.user_id);
  if (userIdInt === null) return;
  return respond(res, await serviceCall(userIdInt));
};

class UserBundleController extends Controller {
  constructor() {
    super();
  }

  // Get all available bundles for users
  list = catchAs({ success: false, error: "Internal server error" }, handle(() => bundleService.list({ isLiveOnly: true })));

  // Get specific bundle details
  get = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const { id } = req.params;
    if (!/^\d+$/.test(String(id))) {
      return res.status(400).json({
        success: false,
        error: "Bundle ID must be numeric",
      });
    }

    const userId = req.body?.user_id ? parseInt(req.body.user_id) : null;
    const result = await bundleService.get(parseInt(id, 10), userId);
    
    if (result.success && Array.isArray(result.data) && result.data.length > 0 && result.data[0].is_live === false) {
      return res.status(404).json({ success: false, error: "Bundle not found" });
    }
    
    return respond(res, result);
  });

  getBySlug = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const { slug } = req.params;
    const userId = req.body?.user_id ? parseInt(req.body.user_id) : null;

    const result = await bundleService.getBySlug(slug, userId);
    
    if (result.success && Array.isArray(result.data) && result.data.length > 0 && result.data[0].is_live === false) {
      return res.status(404).json({ success: false, error: "Bundle not found" });
    }
    
    return respond(res, result);
  });

  // Get user's purchased bundles
  getMyBundles = catchAs((error) => ({ success: false, error: "Internal server error", details: error.message }), forUser((userId) => bundleService.getUserBundles(userId)));

  // Check if user has purchased a specific bundle
  checkPurchaseStatus = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const { id, user_id } = req.params;
    const userIdInt = parseUserId(res, user_id);
    if (userIdInt === null) return;
    const hasPurchased = await bundleService.hasUserPurchasedBundle(
      userIdInt,
      parseInt(id)
    );

    return res.status(200).json({
      success: true,
      data: { purchased: hasPurchased },
    });
  });

  // Check if user has prebooked a specific bundle
  checkPrebookStatus = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const { id, user_id } = req.params;
    const userIdInt = parseUserId(res, user_id);
    if (userIdInt === null) return;
    const hasPrebooked = await bundleService.hasUserPrebookedBundle(
      userIdInt,
      parseInt(id)
    );

    return res.status(200).json({
      success: true,
      data: { prebooked: hasPrebooked },
    });
  });

  // Get user's bundle courses (courses from purchased bundles)
  getBundleCourses = catchAs((error) => ({ success: false, error: "Internal server error", details: error.message }), forUser((userId) => bundleService.getUserBundleCourses(userId)));

  // Check for duplicate courses before bundle purchase
  checkDuplicateCourses = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const { id, user_id } = req.params;
    const userIdInt = parseUserId(res, user_id);
    if (userIdInt === null) return;
    const result = await bundleService.checkBundleCourseDuplicates(
      userIdInt,
      parseInt(id)
    );

    return respond(res, result);
  });

  // Get all user courses (both individual and bundle courses)
  getAllCourses = catchAs((error) => ({ success: false, error: "Internal server error", details: error.message }), forUser((userId) => bundleService.getUserAllCourses(userId)));

  // Get course access for a specific bundle (NEW API)
  getCourseAccess = catchAs((error) => ({ success: false, error: "Internal server error", details: error.message }), async (req, res) => {
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

    return respond(res, result);
  });
}

module.exports = { UserBundleController };
