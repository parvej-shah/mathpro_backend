module.exports = {
  get: {
    security: [],
    tags: ["Coupon Management"],
    description: "Check if a coupon is applicable to a specific course",
    operationId: "userCouponCheckApplicability",
    parameters: [
      {
        in: "query",
        name: "coupon_id",
        required: true,
        schema: { type: "integer" },
        description: "Coupon ID",
        example: 1,
      },
      {
        in: "query",
        name: "course_id",
        required: true,
        schema: { type: "integer" },
        description: "Course ID",
        example: 5,
      },
    ],
    responses: {
      200: {
        description: "Applicability check result",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                applicable: { type: "boolean", example: true },
                data: {
                  type: "object",
                  nullable: true,
                  properties: {
                    id: { type: "integer", example: 1 },
                    course_title: { type: "string", example: "React Fundamentals" },
                    coupon_name: { type: "string", example: "Summer Sale 20%" },
                  },
                },
              },
            },
          },
        },
      },
      400: {
        description: "Failed to check applicability",
      },
    },
  },
};
