module.exports = {
  post: {
    security: [{ bearerAuth: [] }],
    tags: ["Live Class Management"],
    description: "Create a new live class for a course. Sends SMS notification to assigned teacher and creates notifications for enrolled users.",
    operationId: "adminLiveCreate",
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        schema: { type: "integer" },
        description: "Course ID",
      },
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["title", "scheduled_at"],
            properties: {
              title: { type: "string", description: "Title of the live class", example: "Introduction to React" },
              description: { type: "string", description: "Description of the live class", example: "A live session covering React basics" },
              thumbnail: { type: "string", description: "URL of the thumbnail image", example: "https://example.com/thumb.jpg" },
              can_join: { type: "boolean", description: "Whether users can join the meeting", example: true },
              scheduled_at: { type: "integer", description: "Unix timestamp of scheduled time", example: 1735200000 },
              duration: { type: "string", description: "Duration of the live class", example: "60" },
              meeting_id: { type: "string", description: "Zoom/Meeting ID", example: "123456789" },
              meeting_pass: { type: "string", description: "Meeting password", example: "abc123" },
              teacher_id: { type: "integer", description: "ID of the assigned teacher", example: 5 },
              data: { type: "object", description: "Additional JSON data", example: { topics: ["variables", "loops"] } },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: "Live class created successfully",
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
                    },
                  },
                },
              },
            },
          },
        },
      },
      400: { description: "Validation error" },
      401: { description: "Unauthorized" },
    },
  },
};

