const dateParams = [
  { in: "query", name: "start_date", schema: { type: "integer" }, description: "Start date (Unix timestamp seconds)", example: 1704067200 },
  { in: "query", name: "end_date", schema: { type: "integer" }, description: "End date (Unix timestamp seconds)", example: 1706659200 },
];

module.exports = {
  "/admin/analytics/courses/overview": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Analytics"],
      summary: "Get course overview statistics",
      operationId: "analyticsGetCourseOverview",
      parameters: [
        ...dateParams,
        { in: "query", name: "course_id", schema: { type: "integer" }, description: "Filter by specific course ID", example: 1 },
      ],
      responses: {
        200: {
          description: "Course overview retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      total_courses: { type: "integer", example: 50 },
                      live_courses: { type: "integer", example: 45 },
                      total_enrollments: { type: "integer", example: 2000 },
                      average_enrollments_per_course: { type: "number", example: 40 },
                      top_courses: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            course_id: { type: "integer", example: 1 },
                            title: { type: "string", example: "Course Name" },
                            enrollments: { type: "integer", example: 200 },
                            revenue: { type: "number", example: 2000000 },
                            completion_rate: { type: "number", example: 65.5 },
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

  "/admin/analytics/courses/completion": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Analytics"],
      summary: "Get course completion rates",
      operationId: "analyticsGetCourseCompletion",
      parameters: [
        { in: "query", name: "course_id", schema: { type: "integer" }, description: "Filter by specific course ID", example: 1 },
        { in: "query", name: "limit", schema: { type: "integer", default: 20, maximum: 100 }, description: "Results per page", example: 20 },
        { in: "query", name: "offset", schema: { type: "integer", default: 0 }, description: "Pagination offset", example: 0 },
      ],
      responses: {
        200: {
          description: "Course completion rates retrieved",
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
                            total_enrolled: { type: "integer", example: 200 },
                            completed: { type: "integer", example: 131 },
                            completion_rate: { type: "number", example: 65.5 },
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

  "/admin/analytics/courses/{courseId}/detailed": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Analytics"],
      summary: "Get detailed analytics for a specific course",
      operationId: "analyticsGetCourseDetailed",
      parameters: [
        { in: "path", name: "courseId", required: true, schema: { type: "integer" }, description: "Course ID", example: 1 },
        ...dateParams,
      ],
      responses: {
        200: {
          description: "Course detailed analytics retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      course: {
                        type: "object",
                        properties: {
                          id: { type: "integer", example: 1 },
                          title: { type: "string", example: "Course Name" },
                          price: { type: "number", example: 10000 },
                        },
                      },
                      enrollments: {
                        type: "object",
                        properties: {
                          total: { type: "integer", example: 200 },
                          this_month: { type: "integer", example: 20 },
                          last_month: { type: "integer", example: 15 },
                          growth_percentage: { type: "string", example: "33.33" },
                        },
                      },
                      revenue: {
                        type: "object",
                        properties: {
                          total: { type: "number", example: 2000000 },
                          this_month: { type: "number", example: 200000 },
                          last_month: { type: "number", example: 150000 },
                        },
                      },
                      completion: {
                        type: "object",
                        properties: {
                          total_enrolled: { type: "integer", example: 200 },
                          completed: { type: "integer", example: 131 },
                          in_progress: { type: "integer", example: 50 },
                          not_started: { type: "integer", example: 19 },
                          completion_rate: { type: "number", example: 65.5 },
                        },
                      },
                      engagement: {
                        type: "object",
                        properties: {
                          submissions: { type: "integer", example: 150 },
                          average_streak: { type: "number", example: 7.2 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: "Invalid course ID" },
        401: { description: "Unauthorized" },
        403: { description: "No access to this course" },
        500: { description: "Internal server error" },
      },
    },
  },
};
