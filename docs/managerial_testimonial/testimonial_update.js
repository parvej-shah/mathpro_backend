module.exports = {
  put: {
    security: [{ bearerAuth: [] }],
    tags: ["Testimonial Management"],
    description:
      "Update featured testimonial ordering, publish state, video URL, student avatar URL, institution name/logo, or hook text",
    operationId: "adminTestimonialUpdate",
    parameters: [{ in: "path", name: "feedbackId", required: true }],
    requestBody: {
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/publicTestimonial" },
        },
      },
    },
    responses: {
      200: { description: "Testimonial updated successfully" },
      400: { description: "Failed to update testimonial" },
    },
  },
};
