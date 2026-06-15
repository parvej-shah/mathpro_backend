module.exports = {
  delete: {
    security: [{ bearerAuth: [] }],
    tags: ["Testimonial Management"],
    description: "Remove a feedback entry from public testimonials",
    operationId: "adminTestimonialDelete",
    parameters: [{ in: "path", name: "feedbackId", required: true }],
    responses: {
      200: { description: "Testimonial removed successfully" },
      400: { description: "Failed to remove testimonial" },
    },
  },
};
