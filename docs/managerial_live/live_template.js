module.exports = {
  get: {
    security: [{ bearerAuth: [] }],
    tags: ["Live Class Management"],
    description: "Get JSON template for bulk importing live classes. Includes field descriptions and optional example data.",
    operationId: "adminLiveTemplate",
    parameters: [
      {
        in: "query",
        name: "example",
        required: false,
        schema: { type: "string", enum: ["true", "false"], default: "true" },
        description: "Include example data in template (default: true)",
      },
    ],
    responses: {
      200: {
        description: "Template retrieved successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                data: {
                  type: "object",
                  properties: {
                    description: { type: "string", example: "JSON template for bulk importing live classes" },
                    version: { type: "string", example: "1.0" },
                    live_classes: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          course_id: { type: "integer", example: 1 },
                          title: { type: "string", example: "Introduction to Programming - Live Session" },
                          description: { type: "string", example: "A live session covering the basics" },
                          thumbnail: { type: "string", example: "https://example.com/thumbnails/live1.jpg" },
                          can_join: { type: "boolean", example: true },
                          scheduled_at: { type: "integer", example: 1735200000 },
                          duration: { type: "string", example: "60" },
                          meeting_id: { type: "string", example: "123456789" },
                          meeting_pass: { type: "string", example: "abc123" },
                          teacher_id: { type: "integer", example: 1 },
                          data: { type: "object", example: { topics: ["variables", "loops"] } },
                        },
                      },
                    },
                    field_descriptions: {
                      type: "object",
                      properties: {
                        course_id: { type: "string", example: "Required. Integer. ID of the course this live class belongs to." },
                        title: { type: "string", example: "Required. String. Title of the live class." },
                        description: { type: "string", example: "Optional. String. Description of the live class." },
                        thumbnail: { type: "string", example: "Optional. String. URL of the thumbnail image." },
                        can_join: { type: "string", example: "Optional. Boolean. Whether users can join the meeting. Defaults to false." },
                        scheduled_at: { type: "string", example: "Required. Integer. Unix timestamp of when the live class is scheduled." },
                        duration: { type: "string", example: "Optional. String. Duration of the live class." },
                        meeting_id: { type: "string", example: "Optional. String. Zoom/Meeting ID." },
                        meeting_pass: { type: "string", example: "Optional. String. Meeting password." },
                        teacher_id: { type: "string", example: "Optional. Integer. ID of the assigned teacher." },
                        data: { type: "string", example: "Optional. Object. Additional JSON data for the live class." },
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
    },
  },
};

