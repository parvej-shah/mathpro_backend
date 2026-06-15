module.exports = {
  get: {
    security: [{ bearerAuth: [] }],
    tags: ["Live Class Management"],
    description: "Get the count of users interested in a specific live class",
    operationId: "adminLiveInterestCount",
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
        description: "Interest count retrieved successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                data: {
                  type: "object",
                  properties: {
                    count: { type: "integer", example: 25 },
                  },
                },
              },
            },
          },
        },
      },
      400: { description: "Invalid ID" },
      401: { description: "Unauthorized" },
    },
  },
};

