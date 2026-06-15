module.exports = {
  get: {
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: ["Coupon Management"],
    description: "Get all coupon clicks with optional filters",
    operationId: "getAllCouponClicks",
    parameters: [
      {
        in: "query",
        name: "coupon_id",
        schema: {
          type: "integer",
        },
        description: "Filter by coupon ID",
        example: 59,
      },
      {
        in: "query",
        name: "date_from",
        schema: {
          type: "integer",
        },
        description: "Unix timestamp for start date",
        example: 1768828000,
      },
      {
        in: "query",
        name: "date_to",
        schema: {
          type: "integer",
        },
        description: "Unix timestamp for end date",
        example: 1768914400,
      },
      {
        in: "query",
        name: "purchase_completed",
        schema: {
          type: "boolean",
        },
        description: "Filter by purchase completion status (true/false)",
        example: false,
      },
      {
        in: "query",
        name: "page",
        schema: {
          type: "integer",
          default: 1,
        },
        description: "Page number",
        example: 1,
      },
      {
        in: "query",
        name: "limit",
        schema: {
          type: "integer",
          default: 20,
        },
        description: "Items per page",
        example: 20,
      },
    ],
    responses: {
      200: {
        description: "All coupon clicks retrieved successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                data: {
                  type: "object",
                  properties: {
                    clicks: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "integer", example: 1 },
                          coupon_id: { type: "integer", example: 59 },
                          coupon_code: { type: "string", example: "PARVEJSHAH_C_500_35" },
                          user_id: { type: "integer", example: 3969 },
                          user_name: { type: "string", example: "Parvej Shah Labib" },
                          user_email: { type: "string", example: "parvejshahlabib007@gmail.com" },
                          user_phone: { type: "string", example: "01516538025" },
                          course_id: { type: "integer", nullable: true, example: 12 },
                          course_title: { type: "string", nullable: true, example: "Object Oriented Programming" },
                          bundle_id: { type: "integer", nullable: true },
                          bundle_name: { type: "string", nullable: true },
                          clicked_at: { type: "integer", example: 1768828341, description: "Unix timestamp" },
                          user_agent: { type: "string", nullable: true, example: "Mozilla/5.0..." },
                          purchase_completed: { type: "boolean", example: false },
                          purchase_completed_at: { type: "integer", nullable: true, description: "Unix timestamp" },
                          transaction_id: { type: "string", nullable: true },
                          coupon_usage_id: { type: "integer", nullable: true },
                          original_price: { type: "string", nullable: true, example: "2500" },
                          discount_amount: { type: "string", nullable: true, example: "500" },
                          final_price: { type: "string", nullable: true, example: "2000" },
                        },
                      },
                    },
                    pagination: {
                      type: "object",
                      properties: {
                        page: { type: "integer", example: 1 },
                        limit: { type: "integer", example: 20 },
                        total: { type: "integer", example: 1 },
                        totalPages: { type: "integer", example: 1 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      400: {
        description: "Bad request - Failed to retrieve coupon clicks",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
                error: { type: "string", example: "Failed to retrieve coupon clicks" },
              },
            },
          },
        },
      },
      401: {
        description: "Unauthorized - Invalid or missing token",
      },
    },
  },
};
