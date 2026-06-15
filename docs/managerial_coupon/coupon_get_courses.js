module.exports = {
  get: {
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: ["Coupon Management"],
    description: "Get all courses associated with a coupon",
    operationId: "adminCouponGetCourses",
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
        description: "Courses retrieved successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                data: {
                  type: "object",
                  properties: {
                    coupon: {
                      type: "object",
                      properties: {
                        id: { type: "integer", example: 1 },
                        name: { type: "string", example: "Summer Sale" },
                        code: { type: "string", example: "SUMMER20" },
                      },
                    },
                    courses: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "integer", example: 5 },
                          title: { type: "string", example: "React Fundamentals" },
                          price: { type: "number", example: 1000 },
                          associated_at: { type: "string", format: "date-time" },
                        },
                      },
                    },
                    totalCourses: { type: "integer", example: 3 },
                  },
                },
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
