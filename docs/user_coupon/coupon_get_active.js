module.exports = {
  get: {
    security: [],
    tags: ["Coupon Management"],
    description: "Get active coupons for a specific course",
    operationId: "userCouponGetActive",
    parameters: [
      {
        in: "path",
        name: "course_id",
        required: true,
        schema: { type: "integer" },
        description: "Course ID",
        example: 5,
      },
    ],
    responses: {
      200: {
        description: "Active coupons retrieved successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                data: {
                  type: "array",
                  items: { $ref: "#/components/schemas/coupon" },
                },
              },
            },
          },
        },
      },
      400: {
        description: "Failed to retrieve active coupons",
      },
    },
  },
};
