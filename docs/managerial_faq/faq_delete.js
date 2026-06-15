module.exports = {
  delete: {
    security: [{ bearerAuth: [] }],
    tags: ["FAQ Management"],
    description: "Delete a shared FAQ",
    operationId: "adminFaqDelete",
    parameters: [{ in: "path", name: "id", required: true }],
    responses: {
      200: { description: "FAQ deleted successfully" },
      400: { description: "Failed to delete FAQ" },
    },
  },
};
