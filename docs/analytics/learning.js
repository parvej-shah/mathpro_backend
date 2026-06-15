const dateParams = [
  { in: "query", name: "start_date", schema: { type: "integer" }, description: "Start date (Unix timestamp seconds)", example: 1704067200 },
  { in: "query", name: "end_date", schema: { type: "integer" }, description: "End date (Unix timestamp seconds)", example: 1706659200 },
];

module.exports = {
  "/admin/analytics/learning/progress": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Analytics"],
      summary: "Get learning progress overview",
      operationId: "analyticsGetLearningProgress",
      parameters: [
        ...dateParams,
        { in: "query", name: "course_id", schema: { type: "integer" }, description: "Filter by specific course ID", example: 1 },
      ],
      responses: {
        200: {
          description: "Learning progress retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      total_modules_completed: { type: "integer", example: 5000 },
                      active_learners_30d: { type: "integer", example: 400 },
                      total_progress_records: { type: "integer", example: 10000 },
                      average_completion_rate: { type: "number", example: 65.5 },
                      top_learners: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            user_id: { type: "integer", example: 123 },
                            name: { type: "string", example: "User Name" },
                            modules_completed: { type: "integer", example: 50 },
                            current_streak: { type: "integer", example: 10 },
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
        403: { description: "No access to this course" },
        500: { description: "Internal server error" },
      },
    },
  },

  "/admin/analytics/learning/streaks": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Analytics"],
      summary: "Get learning streak analytics",
      operationId: "analyticsGetStreakAnalytics",
      parameters: [
        { in: "query", name: "course_id", schema: { type: "integer" }, description: "Filter by specific course ID", example: 1 },
        { in: "query", name: "limit", schema: { type: "integer", default: 20, maximum: 100 }, description: "Results per page", example: 20 },
        { in: "query", name: "offset", schema: { type: "integer", default: 0 }, description: "Pagination offset", example: 0 },
      ],
      responses: {
        200: {
          description: "Streak analytics retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      streaks: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            user_id: { type: "integer", example: 123 },
                            course_id: { type: "integer", example: 1 },
                            current_streak: { type: "integer", example: 10 },
                            longest_streak: { type: "integer", example: 15 },
                            last_activity_date: { type: "string", example: "2025-01-15" },
                          },
                        },
                      },
                      summary: {
                        type: "object",
                        properties: {
                          average_current_streak: { type: "number", example: 7.2 },
                          average_longest_streak: { type: "number", example: 10.5 },
                          total_active_streaks: { type: "integer", example: 200 },
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
        403: { description: "No access to this course" },
        500: { description: "Internal server error" },
      },
    },
  },
};
