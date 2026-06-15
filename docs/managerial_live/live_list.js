module.exports = {
  get: {
    security: [{ bearerAuth: [] }],
    tags: ["Live Class Management"],
    description: "Get list of all live classes. Admins see all live classes, teachers see only their assigned live classes.",
    operationId: "adminLiveList",
    parameters: [],
    responses: {
      200: {
        description: "Live classes retrieved successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                data: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "integer", example: 1 },
                      course_id: { type: "integer", example: 1 },
                      course_title: { type: "string", example: "React Fundamentals" },
                      title: { type: "string", example: "Introduction to React" },
                      description: { type: "string", example: "A live session on React basics" },
                      thumbnail: { type: "string", example: "https://example.com/thumb.jpg" },
                      can_join: { type: "boolean", example: true },
                      scheduled_at: { type: "integer", example: 1735200000 },
                      duration: { type: "string", example: "60" },
                      meeting_id: { type: "string", example: "123456789" },
                      meeting_pass: { type: "string", example: "abc123" },
                      teacher_id: { type: "integer", example: 5 },
                      data: { type: "object", example: {} },
                      interested: { type: "integer", example: 25 },
                    },
                  },
                },
              },
            },
          },
        },
      },
      401: { description: "Unauthorized" },
    },
  },
};

