const dateParams = [
  { in: "query", name: "start_date", schema: { type: "integer" }, description: "Start date (Unix timestamp seconds)", example: 1704067200 },
  { in: "query", name: "end_date", schema: { type: "integer" }, description: "End date (Unix timestamp seconds)", example: 1706659200 },
];

module.exports = {
  "/admin/analytics/engagement/submissions": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Analytics"],
      summary: "Get assignment submission analytics",
      operationId: "analyticsGetSubmissionAnalytics",
      parameters: [
        ...dateParams,
        { in: "query", name: "course_id", schema: { type: "integer" }, description: "Filter by specific course ID", example: 1 },
      ],
      responses: {
        200: {
          description: "Submission analytics retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      total_submissions: { type: "integer", example: 2000 },
                      submissions_this_month: { type: "integer", example: 200 },
                      unique_submitters: { type: "integer", example: 500 },
                      average_submissions_per_user: { type: "number", example: 4.0 },
                      top_submitters: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            user_id: { type: "integer", example: 123 },
                            name: { type: "string", example: "User Name" },
                            submissions: { type: "integer", example: 50 },
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
};
