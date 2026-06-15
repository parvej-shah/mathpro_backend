module.exports = {
  post: {
    security: [{ bearerAuth: [] }],
    tags: ["FAQ Management"],
    description: "Create a shared FAQ for homepage, courses, and course detail pages",
    operationId: "adminFaqCreate",
    requestBody: {
      content: {
        "application/json": {
          schema: {
            $ref: "#/components/schemas/publicFaq",
          },
        },
      },
    },
    responses: {
      200: { description: "FAQ created successfully" },
      400: { description: "Failed to create FAQ" },
    },
  },
};
