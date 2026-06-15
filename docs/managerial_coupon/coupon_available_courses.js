module.exports = {
  get: {
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: ["Coupon Management"],
    description: "Get available courses that can be associated with coupons",
    operationId: "adminCouponGetAvailableCourses",
    parameters: [
      {
        in: "query",
        name: "couponId",
        schema: { type: "integer" },
        description: "Optional coupon ID to exclude already associated courses",
        example: 1,
      },
    ],
    responses: {
      200: {
        description: "Available courses retrieved successfully",
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
                      id: { type: "integer", example: 5 },
                      title: { type: "string", example: "React Fundamentals" },
                      price: { type: "number", example: 1000 },
                    },
                  },
                },
                totalCourses: { type: "integer", example: 15 },
              },
            },
          },
        },
      },
      400: {
        description: "Failed to retrieve available courses",
      },
    },
  },
};
