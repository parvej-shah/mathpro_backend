module.exports = {
  delete: {
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: ["Coupon Management"],
    description: "Remove courses from a coupon",
    operationId: "adminCouponRemoveCourses",
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
                description: "Array of course IDs to remove from the coupon",
                example: [1, 2],
              },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: "Courses removed successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                message: { type: "string", example: "Courses removed successfully" },
              },
            },
          },
        },
      },
      400: {
        description: "Validation error or failed to remove courses",
      },
    },
  },
};
