module.exports = {
  delete: {
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: ["Coupon Management"],
    description: "Remove bundles from a coupon",
    operationId: "adminCouponRemoveBundles",
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        schema: { type: "integer" },
        description: "Coupon ID",
        example: 1,
      },
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["bundleIds"],
            properties: {
              bundleIds: {
                type: "array",
                items: { type: "integer" },
                description: "Array of bundle IDs to remove from the coupon",
                example: [1, 2],
              },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: "Bundles removed successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                message: { type: "string", example: "Successfully removed 2 bundle associations" },
                data: {
                  type: "object",
                  properties: {
                    removedCount: { type: "integer", example: 2 },
                    removedBundles: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "integer", example: 1 },
                          bundle_id: { type: "integer", example: 1 },
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
        description: "Validation error or failed to remove bundles",
      },
    },
  },
};
