const Service = require("../base").Service;

class AfterMessageService extends Service {
  constructor() {
    super();
  }

  // Get messages for a specific course or bundle
  async getMessagesByItem(itemType, itemId) {
    try {
      const query = `
                SELECT * FROM aftermessage 
                WHERE type = $1 
                AND (
                    ($2 = 'course' AND course_ids LIKE $3) OR
                    ($2 = 'bundle' AND bundle_ids LIKE $3)
                )
                ORDER BY created_at ASC
            `;

      const itemIdPattern = `%${itemId}%`;
      const result = await this.query(query, [
        "afterPurchaseMessage",
        itemType,
        itemIdPattern,
      ]);

      if (result.success && result.data.length > 0) {
        // Parse messages JSON for each record
        const messages = result.data.map((record) => ({
          ...record,
          messages:
            typeof record.messages === "string"
              ? JSON.parse(record.messages)
              : record.messages,
        }));
        return { success: true, data: messages };
      }

      return { success: true, data: [] };
    } catch (error) {
      console.error("Error fetching aftermessages:", error);
      return { success: false, error: error.message };
    }
  }

  // Get all messages (admin)
  async getAllMessages(accessibleCourseIds = null) {
    try {
      let query = `
                SELECT * FROM aftermessage 
            `;
      const params = [];

      if (accessibleCourseIds && Array.isArray(accessibleCourseIds)) {
        if (accessibleCourseIds.length === 0) {
          return { success: true, data: [] };
        }
        
        // Filter messages where at least one of its course_ids is in accessibleCourseIds
        // This assumes course_ids is a comma-separated string
        query += ` WHERE EXISTS (
          SELECT 1 FROM unnest(string_to_array(course_ids, ',')) AS cid
          WHERE cid::integer = ANY($1)
        ) OR EXISTS (
          SELECT 1 FROM bundle_course bc
          JOIN unnest(string_to_array(bundle_ids, ',')) AS bid ON bid::integer = bc.bundle_id
          WHERE bc.course_id = ANY($1)
        )`;
        params.push(accessibleCourseIds);
      }

      query += ` ORDER BY created_at DESC`;

      const result = await this.query(query, params);

      if (result.success && result.data.length > 0) {
        const messages = result.data.map((record) => ({
          ...record,
          messages:
            typeof record.messages === "string"
              ? JSON.parse(record.messages)
              : record.messages,
        }));
        return { success: true, data: messages };
      }

      return { success: true, data: [] };
    } catch (error) {
      console.error("Error fetching all aftermessages:", error);
      return { success: false, error: error.message };
    }
  }

  // Create new message
  async createMessage(data) {
    try {
      const { type, course_ids, bundle_ids, messages } = data;

      // Validate input
      if (!type || !messages || !Array.isArray(messages)) {
        return {
          success: false,
          error: "Invalid input: type and messages array are required",
        };
      }

      if (!course_ids && !bundle_ids) {
        return {
          success: false,
          error: "At least one of course_ids or bundle_ids must be provided",
        };
      }

      const query = `
                INSERT INTO aftermessage (type, course_ids, bundle_ids, messages)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `;

      const result = await this.query(query, [
        type,
        course_ids || null,
        bundle_ids || null,
        JSON.stringify(messages),
      ]);

      if (result.success && result.data.length > 0) {
        const record = result.data[0];
        return {
          success: true,
          data: {
            ...record,
            messages: messages,
          },
        };
      }

      return { success: false, error: "Failed to create message" };
    } catch (error) {
      console.error("Error creating aftermessage:", error);
      return { success: false, error: error.message };
    }
  }

  // Update message
  async updateMessage(id, data) {
    try {
      const { type, course_ids, bundle_ids, messages } = data;

      // Validate input
      if (messages && !Array.isArray(messages)) {
        return { success: false, error: "Messages must be an array" };
      }

      if (!course_ids && !bundle_ids) {
        return {
          success: false,
          error: "At least one of course_ids or bundle_ids must be provided",
        };
      }

      const query = `
                UPDATE aftermessage 
                SET type = COALESCE($1, type),
                    course_ids = COALESCE($2, course_ids),
                    bundle_ids = COALESCE($3, bundle_ids),
                    messages = COALESCE($4, messages),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $5
                RETURNING *
            `;

      const result = await this.query(query, [
        type || null,
        course_ids || null,
        bundle_ids || null,
        messages ? JSON.stringify(messages) : null,
        id,
      ]);

      if (result.success && result.data.length > 0) {
        const record = result.data[0];
        return {
          success: true,
          data: {
            ...record,
            messages:
              typeof record.messages === "string"
                ? JSON.parse(record.messages)
                : record.messages,
          },
        };
      }

      return { success: false, error: "Message not found" };
    } catch (error) {
      console.error("Error updating aftermessage:", error);
      return { success: false, error: error.message };
    }
  }

  // Delete message
  async deleteMessage(id) {
    try {
      const query = `DELETE FROM aftermessage WHERE id = $1 RETURNING id`;
      const result = await this.query(query, [id]);

      if (result.success && result.data.length > 0) {
        return { success: true, message: "Message deleted successfully" };
      }

      return { success: false, error: "Message not found" };
    } catch (error) {
      console.error("Error deleting aftermessage:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = { AfterMessageService };
