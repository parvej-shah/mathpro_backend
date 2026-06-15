module.exports = {
  schemas: {
    afterMessage: {
      type: "object",
      properties: {
        id: {
          type: "integer",
          description: "Unique identifier for the message",
          example: 1,
        },
        type: {
          type: "string",
          description: "Type of message",
          example: "afterPurchaseMessage",
        },
        course_ids: {
          type: "string",
          nullable: true,
          description: "Comma-separated course IDs",
          example: "1,2,3",
        },
        bundle_ids: {
          type: "string",
          nullable: true,
          description: "Comma-separated bundle IDs",
          example: "5,6",
        },
        messages: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Array of message strings",
          example: [
            "আমাদের Bundle এ তোমার আগ্রহ দেখে আমরা অত্যন্ত খুশী! 🔥",
            "প্রি-বুকিং এর মেয়াদ শেষ হলে তোমার ফোন নাম্বার ও ইমেইলে আমরা বিস্তারিত জানিয়ে দেব!",
            "অবশ্যই তোমার টেক্সট মেসেজ এবং ইমেইলে লক্ষ্য রাখবে।",
            "প্রি-বুকিং শেষ হওয়ার পরেই তুমি আমাদের Bundle এ এনরোল করতে পারবে! 💪",
          ],
        },
        created_at: {
          type: "string",
          format: "date-time",
          description: "Timestamp when the message was created",
          example: "2025-11-23T10:30:00Z",
        },
        updated_at: {
          type: "string",
          format: "date-time",
          description: "Timestamp when the message was last updated",
          example: "2025-11-23T10:30:00Z",
        },
      },
    },
    createAfterMessage: {
      type: "object",
      required: ["type", "messages"],
      properties: {
        type: {
          type: "string",
          description: "Type of message (use 'afterPurchaseMessage')",
          example: "afterPurchaseMessage",
        },
        course_ids: {
          type: "string",
          nullable: true,
          description: "Comma-separated course IDs (e.g., '1,2,3')",
          example: "1,2,3",
        },
        bundle_ids: {
          type: "string",
          nullable: true,
          description: "Comma-separated bundle IDs (e.g., '5,6')",
          example: null,
        },
        messages: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Array of message strings to display",
          example: [
            "Welcome to the course!",
            "Check your email for more details",
            "Start learning today!",
          ],
        },
      },
    },
    updateAfterMessage: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description: "Type of message (optional)",
          example: "afterPurchaseMessage",
        },
        course_ids: {
          type: "string",
          nullable: true,
          description: "Comma-separated course IDs (optional)",
          example: "1,2,3,4",
        },
        bundle_ids: {
          type: "string",
          nullable: true,
          description: "Comma-separated bundle IDs (optional)",
          example: null,
        },
        messages: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Array of message strings (optional)",
          example: ["Updated message 1", "Updated message 2"],
        },
      },
    },
  },
};
