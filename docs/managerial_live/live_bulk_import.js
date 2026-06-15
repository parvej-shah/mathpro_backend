module.exports = {
  post: {
    security: [{ bearerAuth: [] }],
    tags: ["Live Class Management"],
    description: "Bulk import live classes from JSON. Validates all entries, verifies course and teacher IDs exist, and inserts using a transaction (all-or-nothing). Maximum 100 entries per request.",
    operationId: "adminLiveBulkImport",
    parameters: [],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["live_classes"],
            properties: {
              live_classes: {
                type: "array",
                description: "Array of live class objects to import (max 100)",
                items: {
                  type: "object",
                  required: ["course_id", "title", "scheduled_at"],
                  properties: {
                    course_id: { type: "integer", description: "Course ID (required)", example: 1 },
                    title: { type: "string", description: "Title (required)", example: "Live Session 1" },
                    description: { type: "string", description: "Description", example: "Session description" },
                    thumbnail: { type: "string", description: "Thumbnail URL", example: "https://example.com/thumb.jpg" },
                    can_join: { type: "boolean", description: "Can join (default: false)", example: true },
                    scheduled_at: { type: "integer", description: "Unix timestamp (required)", example: 1735200000 },
                    duration: { type: "string", description: "Duration", example: "60" },
                    meeting_id: { type: "string", description: "Meeting ID", example: "123456789" },
                    meeting_pass: { type: "string", description: "Meeting password", example: "abc123" },
                    teacher_id: { type: "integer", description: "Teacher ID", example: 5 },
                    data: { type: "object", description: "Additional JSON data", example: {} },
                  },
                },
              },
            },
          },
          examples: {
            singleEntry: {
              summary: "Import single live class",
              value: {
                live_classes: [
                  {
                    course_id: 1,
                    title: "Introduction to Programming",
                    scheduled_at: 1735200000,
                    can_join: true,
                    meeting_id: "123456789",
                    meeting_pass: "abc123",
                    teacher_id: 5,
                  },
                ],
              },
            },
            multipleEntries: {
              summary: "Import multiple live classes",
              value: {
                live_classes: [
                  {
                    course_id: 1,
                    title: "Session 1: Basics",
                    scheduled_at: 1735200000,
                    duration: "60",
                    teacher_id: 5,
                  },
                  {
                    course_id: 1,
                    title: "Session 2: Advanced Topics",
                    scheduled_at: 1735286400,
                    duration: "90",
                    teacher_id: 5,
                  },
                ],
              },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: "Live classes imported successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                message: { type: "string", example: "Successfully imported 2 live class(es)" },
                data: {
                  type: "object",
                  properties: {
                    imported_count: { type: "integer", example: 2 },
                    imported: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          index: { type: "integer", example: 0 },
                          id: { type: "integer", example: 10 },
                          title: { type: "string", example: "Session 1: Basics" },
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
      400: {
        description: "Import failed - invalid course/teacher IDs or partial failure",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
                error: { type: "string", example: "Invalid course IDs: 999, 1000" },
                code: { type: "string", example: "INVALID_COURSE_IDS" },
              },
            },
          },
        },
      },
      422: {
        description: "Validation error - field validation failed",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
                error: { type: "string", example: "Validation failed" },
                code: { type: "string", example: "VALIDATION_ERROR" },
                details: {
                  type: "array",
                  items: { type: "string" },
                  example: ["Entry 1: course_id is required and must be an integer", "Entry 2: scheduled_at is required and must be a unix timestamp (integer)"],
                },
                validCount: { type: "integer", example: 1 },
                invalidCount: { type: "integer", example: 2 },
              },
            },
          },
        },
      },
      401: { description: "Unauthorized" },
    },
  },
};

