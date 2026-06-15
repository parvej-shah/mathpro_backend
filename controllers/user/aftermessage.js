const Controller = require("../base").Controller;
const { AfterMessageService } = require("../../service/user/aftermessage");

const afterMessageService = new AfterMessageService();

class AfterMessageController extends Controller {
  constructor() {
    super();
  }

  // Get messages for a specific course or bundle
  getMessagesByItem = async (req, res) => {
    try {
      const { itemType, itemId } = req.params;

      // Validate itemType
      if (!["course", "bundle"].includes(itemType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid itemType. Must be "course" or "bundle"',
        });
      }

      // Validate itemId
      if (!itemId || isNaN(itemId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid itemId",
        });
      }

      const result = await afterMessageService.getMessagesByItem(
        itemType,
        parseInt(itemId)
      );
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error("Error in getMessagesByItem:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };
}

module.exports = { AfterMessageController };
