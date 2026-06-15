const dateParams = [
  { in: "query", name: "start_date", schema: { type: "integer" }, description: "Start date (Unix timestamp seconds)", example: 1704067200 },
  { in: "query", name: "end_date", schema: { type: "integer" }, description: "End date (Unix timestamp seconds)", example: 1706659200 },
];

module.exports = {
  "/admin/analytics/coupons/overview": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Analytics"],
      summary: "Get coupon overview statistics",
      operationId: "analyticsGetCouponOverview",
      parameters: dateParams,
      responses: {
        200: {
          description: "Coupon overview retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      total_coupons: { type: "integer", example: 50 },
                      active_coupons: { type: "integer", example: 30 },
                      total_usage: { type: "integer", example: 1000 },
                      total_discount_given: { type: "number", example: 500000 },
                      total_revenue_with_coupons: { type: "number", example: 2000000 },
                      conversion_rate: { type: "number", example: 10.5 },
                      top_coupons: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            coupon_id: { type: "integer", example: 1 },
                            code: { type: "string", example: "SAVE20" },
                            usage_count: { type: "integer", example: 100 },
                            discount_given: { type: "number", example: 50000 },
                            revenue_generated: { type: "number", example: 200000 },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized" },
        500: { description: "Internal server error" },
      },
    },
  },

  "/admin/analytics/coupons/performance": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Analytics"],
      summary: "Get coupon performance metrics",
      operationId: "analyticsGetCouponPerformance",
      parameters: [
        { in: "query", name: "coupon_id", schema: { type: "integer" }, description: "Filter by specific coupon ID", example: 1 },
        ...dateParams,
        { in: "query", name: "limit", schema: { type: "integer", default: 20, maximum: 100 }, description: "Results per page", example: 20 },
        { in: "query", name: "offset", schema: { type: "integer", default: 0 }, description: "Pagination offset", example: 0 },
      ],
      responses: {
        200: {
          description: "Coupon performance retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      coupons: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            coupon_id: { type: "integer", example: 1 },
                            code: { type: "string", example: "SAVE20" },
                            usage_count: { type: "integer", example: 100 },
                            discount_given: { type: "number", example: 50000 },
                            revenue_generated: { type: "number", example: 200000 },
                            average_discount: { type: "number", example: 500 },
                          },
                        },
                      },
                      meta: {
                        type: "object",
                        properties: {
                          total: { type: "integer", example: 50 },
                          limit: { type: "integer", example: 20 },
                          offset: { type: "integer", example: 0 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized" },
        500: { description: "Internal server error" },
      },
    },
  },
};
