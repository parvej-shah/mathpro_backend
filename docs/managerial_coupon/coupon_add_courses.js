module.exports = {
  post: {
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: ["Coupon Management"],
    description: "Add courses to a coupon",
    operationId: "adminCouponAddCourses",
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
            type: "object",
            required: ["courseIds"],
            properties: {
              courseIds: {
                type: "array",
                items: { type: "integer" },
                description: "Array of course IDs to associate with the coupon",
                example: [1, 2, 3],
              },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: "Courses added successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                message: { type: "string", example: "Courses added successfully" },
                data: {
                  type: "object",
                  properties: {
                    added: { type: "integer", example: 3 },
                    skipped: { type: "integer", example: 0 },
                  },
                },
              },
            },
          },
        },
      },
      400: {
        description: "Validation error or failed to add courses",
      },
    },
  },
};
