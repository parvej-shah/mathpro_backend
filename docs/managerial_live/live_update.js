module.exports = {
  put: {
    security: [{ bearerAuth: [] }],
    tags: ["Live Class Management"],
    description: "Update an existing live class by ID",
    operationId: "adminLiveUpdate",
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        schema: { type: "integer" },
        description: "Live class ID",
      },
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              title: { type: "string", description: "Title of the live class", example: "Updated: Introduction to React" },
              description: { type: "string", description: "Description of the live class", example: "Updated description" },
              thumbnail: { type: "string", description: "URL of the thumbnail image", example: "https://example.com/new-thumb.jpg" },
              can_join: { type: "boolean", description: "Whether users can join the meeting", example: true },
              scheduled_at: { type: "integer", description: "Unix timestamp of scheduled time", example: 1735300000 },
              duration: { type: "string", description: "Duration of the live class", example: "90" },
              meeting_id: { type: "string", description: "Zoom/Meeting ID", example: "987654321" },
              meeting_pass: { type: "string", description: "Meeting password", example: "xyz789" },
              teacher_id: { type: "integer", description: "ID of the assigned teacher", example: 6 },
              data: { type: "object", description: "Additional JSON data", example: { topics: ["advanced"] } },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: "Live class updated successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                rowCount: { type: "integer", example: 1 },
              },
            },
          },
        },
      },
      400: { description: "Validation error or update failed" },
      401: { description: "Unauthorized" },
    },
  },
};

