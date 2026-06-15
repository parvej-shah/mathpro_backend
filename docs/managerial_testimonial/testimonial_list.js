module.exports = {
  get: {
    security: [{ bearerAuth: [] }],
    tags: ["Testimonial Management"],
    description: "List selected public testimonials",
    operationId: "adminTestimonialList",
    responses: {
      200: { description: "Selected testimonials retrieved successfully" },
      400: { description: "Failed to fetch testimonials" },
    },
  },
};
