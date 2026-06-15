const dateParams = [
  { in: "query", name: "start_date", schema: { type: "integer" }, description: "Start date (Unix timestamp seconds)", example: 1704067200 },
  { in: "query", name: "end_date", schema: { type: "integer" }, description: "End date (Unix timestamp seconds)", example: 1706659200 },
];

const paginationParams = [
  { in: "query", name: "limit", schema: { type: "integer", default: 20, minimum: 1, maximum: 100 }, description: "Results per page", example: 20 },
  { in: "query", name: "offset", schema: { type: "integer", default: 0 }, description: "Pagination offset", example: 0 },
];

module.exports = {
  "/admin/analytics/revenue/summary": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Analytics"],
      summary: "Get revenue summary",
      operationId: "analyticsGetRevenueSummary",
      parameters: [
        ...dateParams,
        { in: "query", name: "group_by", schema: { type: "string", enum: ["day", "week", "month", "quarter", "year"] }, description: "Group trends by period", example: "month" },
        { in: "query", name: "course_id", schema: { type: "integer" }, description: "Filter by course ID", example: 1 },
        { in: "query", name: "bundle_id", schema: { type: "integer" }, description: "Filter by bundle ID", example: 1 },
      ],
      responses: {
        200: {
          description: "Revenue summary retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      total_revenue: { type: "number", example: 5000000 },
                      course_revenue: { type: "number", example: 4000000 },
                      bundle_revenue: { type: "number", example: 1000000 },
                      with_coupon_revenue: { type: "number", example: 500000 },
                      without_coupon_revenue: { type: "number", example: 4500000 },
                      discount_given: { type: "number", example: 500000 },
                      average_order_value: { type: "number", example: 2500 },
                      total_transactions: { type: "integer", example: 2000 },
                      trends: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            period: { type: "string", example: "2025-01" },
                            revenue: { type: "number", example: 500000 },
                            enrollments: { type: "integer", example: 200 },
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

  "/admin/analytics/revenue/trends": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Analytics"],
      summary: "Get revenue trends over time",
      operationId: "analyticsGetRevenueTrends",
      parameters: [
        { in: "query", name: "start_date", required: true, schema: { type: "integer" }, description: "Start date (Unix timestamp seconds) — required", example: 1704067200 },
        { in: "query", name: "end_date", required: true, schema: { type: "integer" }, description: "End date (Unix timestamp seconds) — required", example: 1706659200 },
        { in: "query", name: "group_by", schema: { type: "string", enum: ["day", "week", "month", "quarter", "year"], default: "day" }, description: "Group by period", example: "day" },
        { in: "query", name: "course_id", schema: { type: "integer" }, description: "Filter by course ID", example: 1 },
        { in: "query", name: "bundle_id", schema: { type: "integer" }, description: "Filter by bundle ID", example: 1 },
      ],
      responses: {
        200: {
          description: "Revenue trends retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      trends: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            period: { type: "string", example: "2025-01-01" },
                            revenue: { type: "number", example: 50000 },
                            enrollments: { type: "integer", example: 20 },
                            course_revenue: { type: "number", example: 40000 },
                            bundle_revenue: { type: "number", example: 10000 },
                          },
                        },
                      },
                      summary: {
                        type: "object",
                        properties: {
                          total_revenue: { type: "number", example: 500000 },
                          average_daily_revenue: { type: "number", example: 16666.67 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: "start_date and end_date are required" },
        401: { description: "Unauthorized" },
        500: { description: "Internal server error" },
      },
    },
  },

  "/admin/analytics/revenue/by-course": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Analytics"],
      summary: "Get revenue by course",
      operationId: "analyticsGetRevenueByCourse",
      parameters: [
        ...dateParams,
        ...paginationParams,
        { in: "query", name: "sort_by", schema: { type: "string", enum: ["revenue", "enrollments"], default: "revenue" }, example: "revenue" },
        { in: "query", name: "order", schema: { type: "string", enum: ["asc", "desc"], default: "desc" }, example: "desc" },
      ],
      responses: {
        200: {
          description: "Revenue by course retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      courses: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            course_id: { type: "integer", example: 1 },
                            title: { type: "string", example: "Course Name" },
                            revenue: { type: "number", example: 2000000 },
                            enrollments: { type: "integer", example: 200 },
                            average_revenue_per_student: { type: "number", example: 10000 },
                            with_coupon_revenue: { type: "number", example: 200000 },
                            without_coupon_revenue: { type: "number", example: 1800000 },
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

  "/admin/analytics/revenue/by-bundle": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Analytics"],
      summary: "Get revenue by bundle",
      operationId: "analyticsGetRevenueByBundle",
      parameters: [
        ...dateParams,
        ...paginationParams,
        { in: "query", name: "sort_by", schema: { type: "string", enum: ["revenue", "purchases"], default: "revenue" }, example: "revenue" },
        { in: "query", name: "order", schema: { type: "string", enum: ["asc", "desc"], default: "desc" }, example: "desc" },
      ],
      responses: {
        200: {
          description: "Revenue by bundle retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      bundles: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            bundle_id: { type: "integer", example: 1 },
                            title: { type: "string", example: "Bundle Name" },
                            revenue: { type: "number", example: 1000000 },
                            purchases: { type: "integer", example: 50 },
                            average_revenue_per_purchase: { type: "number", example: 20000 },
                            with_coupon_revenue: { type: "number", example: 100000 },
                            without_coupon_revenue: { type: "number", example: 900000 },
                          },
                        },
                      },
                      meta: {
                        type: "object",
                        properties: {
                          total: { type: "integer", example: 10 },
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

  "/admin/analytics/revenue/predictions": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Analytics"],
      summary: "Get revenue predictions",
      description: "Statistical revenue forecasts based on historical data. Not AI/ML — uses simple average or trend methods.",
      operationId: "analyticsGetRevenuePredictions",
      parameters: [
        { in: "query", name: "period", required: true, schema: { type: "string", enum: ["week", "month", "quarter", "year"], default: "month" }, description: "Prediction period — required", example: "month" },
        { in: "query", name: "method", schema: { type: "string", enum: ["average", "trend"], default: "average" }, description: "Prediction method", example: "average" },
      ],
      responses: {
        200: {
          description: "Revenue predictions retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      prediction: {
                        type: "object",
                        properties: {
                          period: { type: "string", example: "next_month" },
                          predicted_revenue: { type: "number", example: 550000 },
                          confidence: { type: "string", enum: ["low", "medium", "high"], example: "medium" },
                          method: { type: "string", enum: ["average", "trend"], example: "average" },
                          based_on: {
                            type: "object",
                            properties: {
                              historical_periods: { type: "integer", example: 6 },
                              average_revenue: { type: "number", example: 500000 },
                              growth_rate: { type: "number", example: 0.1 },
                            },
                          },
                        },
                      },
                      disclaimer: { type: "string", example: "Predictions are based on simple historical averages and trends. Actual results may vary." },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: "Invalid period or insufficient data" },
        401: { description: "Unauthorized" },
        500: { description: "Internal server error" },
      },
    },
  },
};
