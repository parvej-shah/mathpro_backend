module.exports = {
  get: {
    security: [{ bearerAuth: [] }],
    tags: ["FAQ Management"],
    description: "Get a single shared FAQ",
    operationId: "adminFaqGet",
    parameters: [{ in: "path", name: "id", required: true }],
    responses: {
      200: { description: "FAQ retrieved successfully" },
      400: { description: "Failed to fetch FAQ" },
    },
  },
};
