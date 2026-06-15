module.exports = {
  get: {
    security: [{ bearerAuth: [] }],
    tags: ["FAQ Management"],
    description: "List all shared public FAQs for admin management",
    operationId: "adminFaqList",
    responses: {
      200: { description: "FAQ list retrieved successfully" },
      400: { description: "Failed to fetch FAQ list" },
    },
  },
};
