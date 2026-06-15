const Controller = require("../base").Controller;
const { AfterMessageService } = require("../../service/user/aftermessage");
const { getAccessibleCourseIds, checkCourseAccess } = require("../../util/courseAccessHelpers");

const afterMessageService = new AfterMessageService();

class AdminAfterMessageController extends Controller {
  constructor() {
    super();
  }

  /**
   * Check if user has access to manage a message linked to specific courses/bundles
   * @private
   */
  async _hasMessageAccess(req, courseIdsStr, bundleIdsStr) {
    const userId = req.user?.id || req.body.user_id;
    const permissions = req.user?.permissions || [];

    // Optimization: Check JWT permissions for global access first
    if (permissions.includes('message.manage.all')) return true;

    const access = await getAccessibleCourseIds(userId, 'message', 'manage');
    if (access.hasGlobalAccess) return true;

    // Convert comma-separated strings to arrays of integers
    const courseIds = courseIdsStr ? courseIdsStr.split(',').filter(id => id.trim()).map(id => parseInt(id.trim())) : [];
    const bundleIds = bundleIdsStr ? bundleIdsStr.split(',').filter(id => id.trim()).map(id => parseInt(id.trim())) : [];

    // User must have access to ALL specified courses
    for (const cid of courseIds) {
      if (!access.courseIds.includes(cid)) return false;
    }

    // User must have access to ALL specified bundles
    // Access to a bundle is granted if the user has access to at least one course in that bundle
    if (bundleIds.length > 0) {
      const { BundleService } = require('../../service/managerial/bundle');
      const bundleService = new BundleService();
      
      for (const bid of bundleIds) {
        const bundleResult = await bundleService.get(bid);
        if (bundleResult.success && bundleResult.data && bundleResult.data.length > 0) {
          const bundleCourses = bundleResult.data[0].courses || [];
          const hasAccessToBundle = bundleCourses.some(bc => access.courseIds.includes(bc.id));
          if (!hasAccessToBundle) return false;
        } else {
          return false; // Bundle not found
        }
      }
    }

    return (courseIds.length > 0 || bundleIds.length > 0);
  }

  // Get all messages
  getAllMessages = async (req, res) => {
    try {
      const userId = req.user?.id || req.body.user_id;
      const access = await getAccessibleCourseIds(userId, 'message', 'manage');
      
      const result = await afterMessageService.getAllMessages(
        access.hasGlobalAccess ? null : access.courseIds
      );
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("Error in getAllMessages:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  // Create new message
  createMessage = async (req, res) => {
    try {
      const userId = req.user?.id || req.body.user_id;
      const { course_ids, bundle_ids } = req.body;

      // Verify access to all specified courses/bundles
      const hasAccess = await this._hasMessageAccess(req, course_ids, bundle_ids);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: "NO_COURSE_ACCESS",
          message: "You don't have access to one or more courses/bundles specified."
        });
      }

      const result = await afterMessageService.createMessage(req.body);
      return res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      console.error("Error in createMessage:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  // Update message
  updateMessage = async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id || req.body.user_id;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: "Invalid message ID",
        });
      }

      // Check access to the existing message
      const existingMessage = await afterMessageService.query(
        "SELECT course_ids, bundle_ids FROM aftermessage WHERE id = $1",
        [parseInt(id)]
      );

      if (!existingMessage.success || existingMessage.data.length === 0) {
        return res.status(404).json({ success: false, error: "Message not found" });
      }

      const hasAccessToExisting = await this._hasMessageAccess(
        req, 
        existingMessage.data[0].course_ids, 
        existingMessage.data[0].bundle_ids
      );

      if (!hasAccessToExisting) {
        return res.status(403).json({
          success: false,
          error: "NO_COURSE_ACCESS",
          message: "You don't have access to manage this message."
        });
      }

      // If updating courses/bundles, check access to new ones too
      if (req.body.course_ids || req.body.bundle_ids) {
        const hasAccessToNew = await this._hasMessageAccess(
          req,
          req.body.course_ids || existingMessage.data[0].course_ids,
          req.body.bundle_ids || existingMessage.data[0].bundle_ids
        );
        if (!hasAccessToNew) {
          return res.status(403).json({
            success: false,
            error: "NO_COURSE_ACCESS",
            message: "You don't have access to one or more new courses/bundles specified."
          });
        }
      }

      const result = await afterMessageService.updateMessage(
        parseInt(id),
        req.body
      );
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("Error in updateMessage:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  // Delete message
  deleteMessage = async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id || req.body.user_id;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: "Invalid message ID",
        });
      }

      // Check access to the existing message
      const existingMessage = await afterMessageService.query(
        "SELECT course_ids, bundle_ids FROM aftermessage WHERE id = $1",
        [parseInt(id)]
      );

      if (!existingMessage.success || existingMessage.data.length === 0) {
        return res.status(404).json({ success: false, error: "Message not found" });
      }

      const hasAccess = await this._hasMessageAccess(
        req, 
        existingMessage.data[0].course_ids, 
        existingMessage.data[0].bundle_ids
      );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: "NO_COURSE_ACCESS",
          message: "You don't have access to delete this message."
        });
      }

      const result = await afterMessageService.deleteMessage(parseInt(id));
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("Error in deleteMessage:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };
}

module.exports = { AdminAfterMessageController };
