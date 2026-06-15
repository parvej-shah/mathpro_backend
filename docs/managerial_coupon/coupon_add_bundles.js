module.exports = {
  post: {
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: ["Coupon Management"],
    description: "Add bundles to a coupon",
    operationId: "adminCouponAddBundles",
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
                description: "Array of bundle IDs to associate with the coupon",
                example: [1, 2, 3],
              },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: "Bundles added successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                message: { type: "string", example: "Successfully associated 3 bundles with coupon" },
                data: {
                  type: "object",
                  properties: {
                    addedCount: { type: "integer", example: 3 },
                    existingCount: { type: "integer", example: 0 },
                    addedBundles: {
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
        description: "Validation error or failed to add bundles",
      },
    },
  },
};
