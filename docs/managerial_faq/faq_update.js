module.exports = {
  put: {
    security: [{ bearerAuth: [] }],
    tags: ["FAQ Management"],
    description: "Update a shared FAQ",
    operationId: "adminFaqUpdate",
    parameters: [{ in: "path", name: "id", required: true }],
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
      200: { description: "FAQ updated successfully" },
      400: { description: "Failed to update FAQ" },
    },
  },
};
