module.exports = {
  delete: {
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: ["Coupon Management"],
    description: "Delete a coupon",
    operationId: "adminCouponDelete",
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
        description: "Coupon deleted successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                message: { type: "string", example: "Coupon deleted successfully" },
              },
            },
          },
        },
      },
      400: {
        description: "Failed to delete coupon",
      },
    },
  },
};
