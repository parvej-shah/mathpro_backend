module.exports = {
  get: {
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: ["Coupon Management"],
    description: "Get a specific coupon by ID",
    operationId: "adminCouponGet",
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
        description: "Coupon retrieved successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                data: { $ref: "#/components/schemas/coupon" },
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
