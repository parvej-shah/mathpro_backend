require("csv-express"); // registers res.csv()
const Controller = require("../base").Controller;
const { respond, catchAs } = require('../base');
const { BundleService } = require("../../service/managerial/bundle");

const bundleService = new BundleService();

class BundleController extends Controller {
  constructor() {
    super();
  }

  // Create new bundle
  create = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const { title, price, url } = req.body;

    if (!title || !price) {
      return res.status(400).json({
        success: false,
        error: "Title and price are required",
      });
    }

    const result = await bundleService.create({
      title,
      price: parseInt(price),
      url: url || null,
    });

    return respond(res, result);
  });

  // Create enhanced bundle with all fields
  createEnhanced = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const {
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
      is_active,
    } = req.body;

    if (!title || !price) {
      return res.status(400).json({
        success: false,
        error: "Title and price are required",
      });
    }

    const result = await bundleService.createEnhanced({
      title,
      price: parseInt(price),
      url: url || null,
      you_get: you_get || null,
      chips: chips || null,
      short_description: short_description || null,
      faq_list: faq_list || null,
      feedback_list: feedback_list || null,
      intro_video: intro_video || null,
      is_live: is_live !== undefined ? is_live : false,
      is_active: is_active !== undefined ? is_active : true,
    });

    return respond(res, result);
  });

  // Update existing bundle
  update = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const { id } = req.params;
    const { title, price, url } = req.body;

    if (!title || !price) {
      return res.status(400).json({
        success: false,
        error: "Title and price are required",
      });
    }

    const result = await bundleService.update(parseInt(id), {
      title,
      price: parseInt(price),
      url: url || null,
    });

    return respond(res, result);
  });

  // Update enhanced bundle with all fields
  updateEnhanced = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const { id } = req.params;
    const {
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
      is_active,
    } = req.body;

    if (!title || !price) {
      return res.status(400).json({
        success: false,
        error: "Title and price are required",
      });
    }

    const result = await bundleService.updateEnhanced(parseInt(id), {
      title,
      price: parseInt(price),
      url: url || null,
      you_get: you_get || null,
      chips: chips || null,
      short_description: short_description || null,
      faq_list: faq_list || null,
      feedback_list: feedback_list || null,
      intro_video: intro_video || null,
      is_live: is_live !== undefined ? is_live : false,
      is_active: is_active !== undefined ? is_active : true,
    });

    return respond(res, result);
  });

  // Delete bundle
  delete = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const { id } = req.params;
    const result = await bundleService.delete(parseInt(id));
    return respond(res, result);
  });

  // List all bundles
  list = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const result = await bundleService.list();
    return respond(res, result);
  });

  // Get specific bundle
  get = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const { id } = req.params;
    if (!/^\d+$/.test(String(id))) {
      return res.status(400).json({
        success: false,
        error: "Bundle ID must be numeric",
      });
    }
    const userId = req.body?.user_id ? parseInt(req.body.user_id) : null;
    const result = await bundleService.get(parseInt(id), userId);
    return respond(res, result);
  });

  getBySlug = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const { slug } = req.params;
    const userId = req.body?.user_id ? parseInt(req.body.user_id) : null;
    const result = await bundleService.getBySlug(slug, userId);
    return respond(res, result);
  });

  // Add courses to bundle
  addCoursesToBundle = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const { id } = req.params;
    const { courseIds } = req.body;

    if (!Array.isArray(courseIds)) {
      return res.status(400).json({
        success: false,
        error: "courseIds must be an array",
      });
    }

    const result = await bundleService.addCoursesToBundle(
      parseInt(id),
      courseIds.map((id) => parseInt(id))
    );

    return respond(res, result);
  });

  // Get bundle statistics
  getBundleStats = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const { id } = req.params;
    const result = await bundleService.getBundleStats(parseInt(id));
    return respond(res, result);
  });

  // Get all bundle purchases
  getAllBundlePurchases = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    // Support both path parameter (:id) and query parameter (bundle_id)
    const { id } = req.params;
    const bundleIdFromQuery = req.query.bundle_id
      ? parseInt(req.query.bundle_id)
      : null;
    
    // Use path param if available, otherwise use query param
    const bundleId = id ? parseInt(id) : bundleIdFromQuery;
    
    // Validate bundle_id if provided
    if (req.query.bundle_id && isNaN(parseInt(req.query.bundle_id))) {
      return res.status(400).json({
        success: false,
        error: "Invalid bundle_id parameter. Must be a valid integer.",
      });
    }
    
    const result = await bundleService.getAllBundlePurchases(bundleId);
    return respond(res, result);
  });

  // Get all bundle purchases - JSON API Response
  getAllBundlePurchasesApi = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const bundleId = req.query.bundle_id
      ? parseInt(req.query.bundle_id)
      : null;
    
    // Validate bundle_id if provided
    if (req.query.bundle_id && isNaN(parseInt(req.query.bundle_id))) {
      return res.status(400).json({
        success: false,
        error: "Invalid bundle_id parameter. Must be a valid integer.",
      });
    }

    const result = await bundleService.getAllBundlePurchasesApi(bundleId);
    return respond(res, result);
  });

  // Export bundle purchases as CSV
  exportBundlePurchases = async (req, res) => {
    // Support both path parameter (:id) and query parameter (bundle_id)
    const { id } = req.params;
    const bundleIdFromQuery = req.query.bundle_id
      ? parseInt(req.query.bundle_id)
      : null;
    
    // Use path param if available, otherwise use query param
    const bundleId = id ? parseInt(id) : bundleIdFromQuery;
    
    const result = await bundleService.getAllBundlePurchases(bundleId);

    res.csv([
      ["Bundle Title", "User Name", "Phone", "Email", "Amount", "Transaction ID", "Purchase Date"],
      ...result.data.map((purchase) => {
        return [
          purchase.bundle_title,
          purchase.user_name,
          purchase.user_phone,
          purchase.user_email || "",
          purchase.amount,
          purchase.transaction_id,
          new Date(purchase.timestamp * 1000).toLocaleString("en-US", {
            timeZone: "Asia/Dhaka",
          }),
        ];
      }),
    ]);
  };

  // Get all bundle prebookings - CSV Export
  getAllBundlePrebookings = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const bundleId = req.query.bundle_id
      ? parseInt(req.query.bundle_id)
      : null;
    const result = await bundleService.getAllBundlePrebookings(bundleId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    const csvHeaders = [
      "Name",
      "Phone",
      "Email",
      "Bundle Title",
      "UTM",
      "Date and Time",
    ];
    const csvData = result.data.map((prebooking) => [
      prebooking.name,
      prebooking.phone,
      prebooking.email,
      prebooking.bundle_title || "",
      prebooking.utm || "",
      new Date(prebooking.timestamp * 1000).toLocaleString("en-US", {
        timeZone: "Asia/Dhaka",
      }),
    ]);

    res.csv([csvHeaders, ...csvData]);
  });

  // Get all bundle prebookings - JSON Response
  getAllBundlePrebookingsApi = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const bundleId = req.query.bundle_id
      ? parseInt(req.query.bundle_id)
      : null;
    const result = await bundleService.getAllBundlePrebookings(bundleId);
    return respond(res, result);
  });

  // Update UTM field for a bundle prebooking
  updateBundlePrebookingUtm = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const { prebookingId } = req.params;
    const { utm } = req.body;

    if (!prebookingId) {
      return res.status(400).json({
        success: false,
        error: "Prebooking ID is required",
      });
    }

    const result = await bundleService.setPrebookingUtm(parseInt(prebookingId), utm || null);

    if (result.success && result.data.length > 0) {
      return res.status(200).json({
        success: true,
        message: "UTM field updated successfully",
        data: result.data[0],
      });
    } else {
      return res.status(400).json({
        success: false,
        error: "Failed to update UTM field or prebooking not found",
      });
    }
  });

  // Delete UTM field for a bundle prebooking (set to NULL)
  deleteBundlePrebookingUtm = catchAs({ success: false, error: "Internal server error" }, async (req, res) => {
    const { prebookingId } = req.params;

    if (!prebookingId) {
      return res.status(400).json({
        success: false,
        error: "Prebooking ID is required",
      });
    }

    const result = await bundleService.setPrebookingUtm(parseInt(prebookingId), null);

    if (result.success && result.data.length > 0) {
      return res.status(200).json({
        success: true,
        message: "UTM field deleted successfully",
        data: result.data[0],
      });
    } else {
      return res.status(400).json({
        success: false,
        error: "Failed to delete UTM field or prebooking not found",
      });
    }
  });
}

module.exports = { BundleController };
