module.exports = {
  post: {
    security: [{ bearerAuth: [] }],
    tags: ["Testimonial Management"],
    description: "Select an existing feedback entry for public testimonials",
    operationId: "adminTestimonialCreate",
    requestBody: {
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/publicTestimonial" },
        },
      },
    },
    responses: {
      200: { description: "Testimonial selected successfully" },
      400: { description: "Failed to select testimonial" },
    },
  },
};
