module.exports = {
  post: {
    security: [],
    tags: ["Coupon Management"],
    description: "Apply a coupon to calculate discounted price for a course or bundle. Provide either course_id OR bundle_id (not both).",
    operationId: "userCouponApply",
    parameters: [],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["coupon_code", "original_price"],
            oneOf: [
              {
                required: ["course_id"],
                properties: {
                  coupon_code: {
                    type: "string",
                    description: "Coupon code to apply",
                    example: "SUMMER20",
                  },
                  course_id: {
                    type: "integer",
                    description: "Course ID (required if bundle_id not provided)",
                    example: 5,
                  },
                  original_price: {
                    type: "number",
                    description: "Original course price",
                    example: 1000,
                  },
                  user_id: {
                    type: "integer",
                    description: "User ID (optional, for logged-in users)",
                    example: 123,
                  },
                },
              },
              {
                required: ["bundle_id"],
                properties: {
                  coupon_code: {
                    type: "string",
                    description: "Coupon code to apply",
                    example: "BUNDLE50",
                  },
                  bundle_id: {
                    type: "integer",
                    description: "Bundle ID (required if course_id not provided)",
                    example: 10,
                  },
                  original_price: {
                    type: "number",
                    description: "Original bundle price",
                    example: 5000,
                  },
                  user_id: {
                    type: "integer",
                    description: "User ID (optional, for logged-in users)",
                    example: 123,
                  },
                },
              },
            ],
          },
        },
      },
    },
    responses: {
      200: {
        description: "Coupon applied successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                data: {
                  type: "object",
                  properties: {
                    coupon: { $ref: "#/components/schemas/coupon" },
                    original_price: { type: "number", example: 1000 },
                    discount_amount: { type: "number", example: 200 },
                    final_price: { type: "number", example: 800 },
                  },
                },
              },
            },
          },
        },
      },
      400: {
        description: "Failed to apply coupon",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
                error: { type: "string", example: "Coupon not found" },
              },
            },
          },
        },
      },
    },
  },
};
