module.exports = {
  post: {
    security: [{ bearerAuth: [] }],
    tags: ["Testimonial Management"],
    description: "Create a new admin-authored review (no real student user_id) that can later be featured as a public testimonial",
    operationId: "adminTestimonialManualReview",
    requestBody: {
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/manualReview" },
        },
      },
    },
    responses: {
      200: { description: "Manual review created successfully" },
      400: { description: "Failed to create manual review" },
      403: { description: "No access to this course" },
    },
  },
};
