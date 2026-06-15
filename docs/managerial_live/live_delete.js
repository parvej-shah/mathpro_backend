module.exports = {
  delete: {
    security: [{ bearerAuth: [] }],
    tags: ["Live Class Management"],
    description: "Delete a live class by ID",
    operationId: "adminLiveDelete",
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        schema: { type: "integer" },
        description: "Live class ID",
      },
    ],
    responses: {
      200: {
        description: "Live class deleted successfully",
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
      400: { description: "Delete failed" },
      401: { description: "Unauthorized" },
    },
  },
};

