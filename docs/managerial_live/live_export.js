module.exports = {
  get: {
    security: [{ bearerAuth: [] }],
    tags: ["Live Class Management"],
    description: "Export live classes to CSV or JSON format. Optionally filter by course ID.",
    operationId: "adminLiveExport",
    parameters: [
      {
        in: "query",
        name: "course_id",
        required: false,
        schema: { type: "integer" },
        description: "Filter by course ID (optional)",
      },
      {
        in: "query",
        name: "format",
        required: false,
        schema: { type: "string", enum: ["csv", "json"], default: "csv" },
        description: "Export format (default: csv)",
      },
    ],
    responses: {
      200: {
        description: "Live classes exported successfully",
        content: {
          "text/csv": {
            schema: {
              type: "string",
              example: "ID,Course ID,Course Title,Title,Description,Thumbnail,Can Join,Scheduled At,Scheduled At (Readable),Duration,Meeting ID,Meeting Password,Teacher ID,Teacher Name,Interested Count\n1,1,React Fundamentals,Introduction to React,A live session,https://example.com/thumb.jpg,Yes,1735200000,\"Dec 26, 2024, 10:00 AM\",60,123456789,abc123,5,John Doe,25",
            },
          },
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                exported_at: { type: "string", example: "2024-12-25T10:30:00.000Z" },
                count: { type: "integer", example: 10 },
                live_classes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "integer", example: 1 },
                      course_id: { type: "integer", example: 1 },
                      course_title: { type: "string", example: "React Fundamentals" },
                      title: { type: "string", example: "Introduction to React" },
                      description: { type: "string", example: "A live session" },
                      thumbnail: { type: "string", example: "https://example.com/thumb.jpg" },
                      can_join: { type: "boolean", example: true },
                      scheduled_at: { type: "integer", example: 1735200000 },
                      duration: { type: "string", example: "60" },
                      meeting_id: { type: "string", example: "123456789" },
                      meeting_pass: { type: "string", example: "abc123" },
                      teacher_id: { type: "integer", example: 5 },
                      teacher_name: { type: "string", example: "John Doe" },
                      data: { type: "object", example: {} },
                      interested_count: { type: "integer", example: 25 },
                    },
                  },
                },
              },
            },
          },
        },
      },
      400: { description: "Invalid parameters" },
      401: { description: "Unauthorized" },
    },
  },
};

