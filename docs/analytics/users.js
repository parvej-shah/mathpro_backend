const dateParams = [
  { in: "query", name: "start_date", schema: { type: "integer" }, description: "Start date (Unix timestamp seconds)", example: 1704067200 },
  { in: "query", name: "end_date", schema: { type: "integer" }, description: "End date (Unix timestamp seconds)", example: 1706659200 },
];

module.exports = {
  "/admin/analytics/users/overview": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Analytics"],
      summary: "Get user overview statistics",
      operationId: "analyticsGetUserOverview",
      parameters: dateParams,
      responses: {
        200: {
          description: "User overview retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      total_users: { type: "integer", example: 1000 },
                      regular_users: { type: "integer", example: 950 },
                      admins: { type: "integer", example: 50 },
                      new_users_today: { type: "integer", example: 10 },
                      new_users_this_month: { type: "integer", example: 100 },
                      new_users_in_range: { type: "integer", example: 100 },
                      active_users_7d: { type: "integer", example: 300 },
                      active_users_30d: { type: "integer", example: 500 },
                      paying_users: { type: "integer", example: 600 },
                      conversion_rate: { type: "number", example: 63.16 },
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

  "/admin/analytics/users/growth": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Analytics"],
      summary: "Get user growth trends",
      operationId: "analyticsGetUserGrowth",
      parameters: [
        { in: "query", name: "start_date", required: true, schema: { type: "integer" }, description: "Start date (Unix timestamp seconds) — required", example: 1704067200 },
        { in: "query", name: "end_date", required: true, schema: { type: "integer" }, description: "End date (Unix timestamp seconds) — required", example: 1706659200 },
        { in: "query", name: "group_by", schema: { type: "string", enum: ["day", "week", "month", "quarter", "year"], default: "month" }, description: "Group by period", example: "month" },
      ],
      responses: {
        200: {
          description: "User growth retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      growth: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            period: { type: "string", example: "2025-01" },
                            new_users: { type: "integer", example: 100 },
                            total_users: { type: "integer", example: 1000 },
                            paying_users: { type: "integer", example: 60 },
                          },
                        },
                      },
                      summary: {
                        type: "object",
                        properties: {
                          total_new_users: { type: "integer", example: 100 },
                          average_daily_new_users: { type: "number", example: 3.33 },
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

  "/admin/analytics/users/engagement": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Analytics"],
      summary: "Get user engagement metrics",
      operationId: "analyticsGetUserEngagement",
      parameters: [
        ...dateParams,
        { in: "query", name: "user_id", schema: { type: "integer" }, description: "Filter by specific user ID", example: 123 },
      ],
      responses: {
        200: {
          description: "User engagement retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      active_users_7d: { type: "integer", example: 300 },
                      active_users_30d: { type: "integer", example: 500 },
                      users_with_progress: { type: "integer", example: 400 },
                      users_with_submissions: { type: "integer", example: 150 },
                      average_modules_completed: { type: "number", example: 5.5 },
                      average_streak_days: { type: "number", example: 7.2 },
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
