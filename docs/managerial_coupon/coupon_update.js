module.exports = {
  put: {
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: ["Coupon Management"],
    description: "Update a coupon",
    operationId: "adminCouponUpdate",
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
            $ref: "#/components/schemas/updateCoupon",
          },
          example: {
            name: "Updated Summer Sale",
            description: "Updated description",
            discount_type: "percentage",
            discount_value: 25,
            usage_limit: 2000,
            end_time: 1768335846,
            status: "active",
          },
        },
      },
    },
    responses: {
      200: {
        description: "Coupon updated successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                data: { $ref: "#/components/schemas/coupon" },
                message: { type: "string", example: "Coupon updated successfully" },
              },
            },
          },
        },
      },
      400: {
        description: "Validation error or update failed",
      },
    },
  },
};
