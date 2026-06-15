module.exports = {
  post: {
    security: [],
    tags: ["Coupon Management"],
    description: "Validate a coupon code for a specific course or bundle. Provide either course_id OR bundle_id (not both).",
    operationId: "userCouponValidate",
    parameters: [],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["coupon_code"],
            oneOf: [
              {
                required: ["course_id"],
                properties: {
                  coupon_code: {
                    type: "string",
                    description: "Coupon code to validate",
                    example: "SUMMER20",
                  },
                  course_id: {
                    type: "integer",
                    description: "Course ID (required if bundle_id not provided)",
                    example: 5,
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
                    description: "Coupon code to validate",
                    example: "BUNDLE50",
                  },
                  bundle_id: {
                    type: "integer",
                    description: "Bundle ID (required if course_id not provided)",
                    example: 10,
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
        description: "Coupon validation result",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                valid: { type: "boolean", example: true },
                coupon: {
                  type: "object",
                  properties: {
                    id: { type: "integer", example: 1 },
                    name: { type: "string", example: "Summer Sale 20%" },
                    code: { type: "string", example: "SUMMER20" },
                    discountType: { type: "string", example: "percentage" },
                    discountValue: { type: "number", example: 20 },
                  },
                },
              },
            },
          },
        },
      },
      400: {
        description: "Coupon validation failed",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                valid: { type: "boolean", example: false },
                error: { type: "string", example: "Coupon not found" },
              },
            },
          },
        },
      },
    },
  },
};
