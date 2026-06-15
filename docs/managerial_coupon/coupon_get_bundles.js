module.exports = {
  get: {
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: ["Coupon Management"],
    description: "Get all bundles associated with a coupon",
    operationId: "adminCouponGetBundles",
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
    responses: {
      200: {
        description: "Bundles retrieved successfully",
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
                      url: { type: "string", example: "full-stack-bundle" },
                      associated_at: { type: "integer", example: 1640995200 },
                    },
                  },
                },
                totalBundles: { type: "integer", example: 3 },
              },
            },
          },
        },
      },
      404: {
        description: "Coupon not found",
      },
    },
  },
};
