module.exports = {
  get: {
    security: [],
    tags: ["Coupon Management"],
    description: "Get public coupon banners for a specific course. Redeemable coupon codes are intentionally not returned.",
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
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "integer", example: 1 },
                      name: { type: "string", example: "Summer Sale 20%" },
                      description: { type: "string", example: "Limited-time discount" },
                      discount_type: { type: "string", example: "percentage" },
                      discount_value: { type: "number", example: 20 },
                      usage_limit: { type: "integer", nullable: true, example: 100 },
                      usage_count: { type: "integer", example: 12 },
                      start_time: { type: "integer", example: 1760000000 },
                      end_time: { type: "integer", example: 1762592000 },
                    },
                  },
                },
                totalCoupons: { type: "integer", example: 1 },
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
