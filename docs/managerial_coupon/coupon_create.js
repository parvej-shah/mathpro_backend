module.exports = {
  post: {
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: ["Coupon Management"],
    description: "Create a new coupon",
    operationId: "adminCouponCreate",
    parameters: [],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            $ref: "#/components/schemas/createCoupon",
          },
          examples: {
            percentageCoupon: {
              summary: "Percentage Discount Coupon",
              value: {
                name: "Summer Sale 20%",
                description: "Get 20% off on all courses",
                code: "SUMMER20",
                discount_type: "percentage",
                discount_value: 20,
                usage_limit: 1000,
                start_time: 1640995200,
                end_time: 1735689600,
                status: "active",
              },
            },
            fixedCoupon: {
              summary: "Fixed Discount Coupon",
              value: {
                name: "Fixed 500 Off",
                description: "Get 500 BDT off",
                code: "FIXED500",
                discount_type: "fixed",
                discount_value: 500,
                usage_limit: 500,
                start_time: 1640995200,
                end_time: 1735689600,
                status: "active",
              },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: "Coupon created successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                data: { $ref: "#/components/schemas/coupon" },
                message: { type: "string", example: "Coupon created successfully" },
              },
            },
          },
        },
      },
      400: {
        description: "Validation error or coupon code already exists",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
                error: { type: "string", example: "Discount value is required" },
              },
            },
          },
        },
      },
    },
  },
};
