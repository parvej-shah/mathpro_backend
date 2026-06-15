module.exports = {
  delete: {
    security: [{ bearerAuth: [] }],
    tags: ["Live Class Management"],
    description: "Bulk delete live classes by IDs. Deletes related interests and feeds. Uses transaction (all-or-nothing). Maximum 50 entries per request.",
    operationId: "adminLiveBulkDelete",
    parameters: [],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["ids"],
            properties: {
              ids: {
                type: "array",
                description: "Array of live class IDs to delete (max 50)",
                items: { type: "integer" },
                example: [1, 2, 3, 4, 5],
              },
            },
          },
          examples: {
            singleDelete: {
              summary: "Delete single live class",
              value: { ids: [1] },
            },
            multipleDelete: {
              summary: "Delete multiple live classes",
              value: { ids: [1, 2, 3, 4, 5] },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: "Live classes deleted successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                message: { type: "string", example: "Successfully deleted 5 live class(es)" },
                data: {
                  type: "object",
                  properties: {
                    deleted_count: { type: "integer", example: 5 },
                    deleted: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "integer", example: 1 },
                          title: { type: "string", example: "Introduction to React" },
                        },
                      },
                    },
                    not_found: {
                      type: "array",
                      items: { type: "integer" },
                      description: "IDs that were not found (only present if some IDs were not found)",
                      example: [99, 100],
                    },
                  },
                },
              },
            },
          },
        },
      },
      400: {
        description: "Validation error or delete failed",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
                error: { type: "string", example: "All IDs must be integers" },
                code: { type: "string", example: "VALIDATION_ERROR" },
                invalidIds: {
                  type: "array",
                  items: { type: "string" },
                  example: ["abc", "xyz"],
                },
              },
            },
          },
        },
      },
      404: {
        description: "None of the provided IDs exist",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
                error: { type: "string", example: "None of the provided IDs exist" },
                code: { type: "string", example: "NOT_FOUND" },
                notFoundIds: {
                  type: "array",
                  items: { type: "integer" },
                  example: [999, 1000],
                },
              },
            },
          },
        },
      },
      401: { description: "Unauthorized" },
      422: {
        description: "Validation error",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
                error: { type: "string", example: "Validation failed" },
                code: { type: "string", example: "VALIDATION_ERROR" },
                details: {
                  type: "object",
                  properties: {
                    ids: { type: "string", example: "ids array is required" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

