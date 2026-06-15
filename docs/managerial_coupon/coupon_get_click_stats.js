module.exports = {
  get: {
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: ["Coupon Management"],
    description: "Get aggregated click statistics for a specific coupon",
    operationId: "getCouponClickStats",
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        schema: {
          type: "integer",
        },
        description: "Coupon ID",
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
    ],
    responses: {
      200: {
        description: "Coupon click statistics retrieved successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                data: {
                  type: "object",
                  properties: {
                    total_clicks: { type: "integer", example: 25 },
                    unique_users: { type: "integer", example: 18 },
                    purchases_completed: { type: "integer", example: 8 },
                    conversion_rate: { type: "number", example: 32.0, description: "Percentage" },
                    total_revenue: { type: "number", example: 16000.00 },
                  },
                },
              },
            },
          },
        },
      },
      400: {
        description: "Bad request - Invalid parameters",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
                error: { type: "string", example: "Valid coupon ID is required" },
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

