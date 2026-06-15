module.exports = {
  get: {
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: ["Coupon Management"],
    description: "Get available bundles that can be associated with coupons",
    operationId: "adminCouponGetAvailableBundles",
    parameters: [
      {
        in: "query",
        name: "couponId",
        schema: { type: "integer" },
        description: "Optional coupon ID to exclude already associated bundles",
        example: 1,
      },
    ],
    responses: {
      200: {
        description: "Available bundles retrieved successfully",
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
                      id: { type: "integer", example: 10 },
                      title: { type: "string", example: "Full Stack Web Development Bundle" },
                      price: { type: "number", example: 5000 },
                    },
                  },
                },
                totalBundles: { type: "integer", example: 8 },
              },
            },
          },
        },
      },
      400: {
        description: "Failed to retrieve available bundles",
      },
    },
  },
};
