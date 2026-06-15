module.exports = {
  "/admin/analytics/dashboard/overview": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Analytics"],
      summary: "Get dashboard overview",
      description: "Platform-wide summary metrics: totals, revenue/enrollment comparisons, top courses & bundles, and 24h operational indicators.",
      operationId: "analyticsGetDashboardOverview",
      parameters: [
        { in: "query", name: "start_date", schema: { type: "integer" }, description: "Start date (Unix timestamp seconds)", example: 1704067200 },
        { in: "query", name: "end_date", schema: { type: "integer" }, description: "End date (Unix timestamp seconds)", example: 1706659200 },
        {
          in: "query", name: "period", schema: {
            type: "string",
            enum: ["today", "yesterday", "this_week", "last_week", "this_month", "last_month", "this_quarter", "last_quarter", "this_year", "last_year", "last_7_days", "last_30_days", "last_90_days", "last_365_days", "all_time", "all"],
          }, description: "Date preset (use all_time / all for no date filter)", example: "this_month",
        },
      ],
      responses: {
        200: {
          description: "Dashboard overview retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      summary: {
                        type: "object",
                        properties: {
                          total_users: { type: "integer", example: 1000 },
                          total_courses: { type: "integer", example: 50 },
                          total_bundles: { type: "integer", example: 10 },
                          total_revenue: { type: "number", example: 5000000 },
                          total_enrollments: { type: "integer", example: 2000 },
                          active_users_30d: { type: "integer", example: 500 },
                          conversion_rate: { type: "number", example: 12.5 },
                          revenue_series: { type: "array", items: { $ref: "#/components/schemas/SeriesPoint" } },
                          enrollments_series: { type: "array", items: { $ref: "#/components/schemas/SeriesPoint" } },
                          users_series: { type: "array", items: { $ref: "#/components/schemas/SeriesPoint" } },
                        },
                      },
                      operational: {
                        type: "object",
                        properties: {
                          recent_enrollments_24h: { type: "integer", example: 10 },
                          recent_payments_24h: { type: "integer", example: 10 },
                          recent_payment_amount_24h: { type: "number", example: 50000 },
                          failed_payment_rate_24h: { type: "number", example: 5.0 },
                        },
                      },
                      revenue: {
                        type: "object",
                        properties: {
                          current: { type: "number", example: 500000 },
                          previous: { type: "number", example: 450000 },
                          growth_percentage: { type: "string", example: "11.11" },
                          series: { type: "array", items: { $ref: "#/components/schemas/SeriesPoint" } },
                        },
                      },
                      enrollments: {
                        type: "object",
                        properties: {
                          current: { type: "integer", example: 100 },
                          previous: { type: "integer", example: 90 },
                          growth_percentage: { type: "string", example: "11.11" },
                          series: { type: "array", items: { $ref: "#/components/schemas/SeriesPoint" } },
                        },
                      },
                      trends: {
                        type: "array",
                        description: "Combined per-bucket time series for the trend chart.",
                        items: {
                          type: "object",
                          properties: {
                            period: { type: "string", example: "2026-01-15" },
                            revenue: { type: "number", example: 12000 },
                            enrollments: { type: "integer", example: 8 },
                            users: { type: "integer", example: 14 },
                          },
                        },
                      },
                      top_courses: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            course_id: { type: "integer", example: 1 },
                            title: { type: "string", example: "Course Name" },
                            enrollments: { type: "integer", example: 200 },
                            revenue: { type: "number", example: 2000000 },
                          },
                        },
                      },
                      top_bundles: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            bundle_id: { type: "integer", example: 1 },
                            title: { type: "string", example: "Bundle Name" },
                            purchases: { type: "integer", example: 50 },
                            revenue: { type: "number", example: 500000 },
                          },
                        },
                      },
                    },
                  },
                  meta: {
                    type: "object",
                    properties: {
                      period: { type: "string", example: "this_month" },
                      start_date: { type: "integer", example: 1704067200 },
                      end_date: { type: "integer", example: 1706659200 },
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

  "/admin/analytics/dashboard/timeseries": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Analytics"],
      summary: "Get dashboard time-series",
      description: "Multi-metric per-bucket series (revenue, enrollments, users) for the dashboard trend chart.",
      operationId: "analyticsGetDashboardTimeseries",
      parameters: [
        { in: "query", name: "start_date", schema: { type: "integer" }, description: "Start date (Unix seconds)", example: 1704067200 },
        { in: "query", name: "end_date", schema: { type: "integer" }, description: "End date (Unix seconds)", example: 1706659200 },
        { in: "query", name: "period", schema: { type: "string", enum: ["today", "yesterday", "this_week", "last_week", "this_month", "last_month", "this_quarter", "last_quarter", "this_year", "last_year", "last_7_days", "last_30_days", "last_90_days", "last_365_days"] }, description: "Date preset", example: "this_month" },
        { in: "query", name: "group_by", schema: { type: "string", enum: ["day", "week", "month", "quarter", "year"] }, description: "Bucket grouping (auto-selected from range if omitted)", example: "day" },
      ],
      responses: {
        200: {
          description: "Time-series retrieved",
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
                            period: { type: "string", example: "2026-01-15" },
                            revenue: { type: "number", example: 12000 },
                            enrollments: { type: "integer", example: 8 },
                            users: { type: "integer", example: 14 },
                          },
                        },
                      },
                      summary: {
                        type: "object",
                        properties: {
                          total_revenue: { type: "number", example: 500000 },
                          total_enrollments: { type: "integer", example: 100 },
                          total_users: { type: "integer", example: 200 },
                          average_daily_revenue: { type: "number", example: 16129.03 },
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

  "/admin/analytics/dashboard/breakdown": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Analytics"],
      summary: "Get dashboard breakdown",
      description: "Ranked rows for a given dimension (course or bundle) by revenue.",
      operationId: "analyticsGetDashboardBreakdown",
      parameters: [
        { in: "query", name: "start_date", schema: { type: "integer" }, description: "Start date (Unix seconds)", example: 1704067200 },
        { in: "query", name: "end_date", schema: { type: "integer" }, description: "End date (Unix seconds)", example: 1706659200 },
        { in: "query", name: "period", schema: { type: "string" }, description: "Date preset", example: "this_month" },
        { in: "query", name: "dimension", schema: { type: "string", enum: ["course", "bundle"] }, description: "Breakdown dimension", example: "course" },
        { in: "query", name: "limit", schema: { type: "integer" }, description: "Max rows (1-50)", example: 10 },
      ],
      responses: {
        200: {
          description: "Breakdown retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      dimension: { type: "string", example: "course" },
                      total: { type: "number", example: 500000 },
                      rows: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "integer", example: 1 },
                            label: { type: "string", example: "Course Name" },
                            value: { type: "number", example: 200000 },
                            secondary: { type: "integer", example: 120 },
                            share: { type: "number", example: 0.4 },
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
};
