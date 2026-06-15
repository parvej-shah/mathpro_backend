const testimonialList = require("./testimonial_list");
const testimonialCreate = require("./testimonial_create");
const testimonialUpdate = require("./testimonial_update");
const testimonialDelete = require("./testimonial_delete");

module.exports = {
  paths: {
    "/admin/testimonial/list": {
      ...testimonialList,
    },
    "/admin/testimonial/create": {
      ...testimonialCreate,
    },
    "/admin/testimonial/update/{feedbackId}": {
      ...testimonialUpdate,
    },
    "/admin/testimonial/delete/{feedbackId}": {
      ...testimonialDelete,
    },
    "/user/testimonial/list": {
      get: {
        tags: ["Testimonial Management"],
        description: "List active public testimonials selected from existing feedbacks",
        operationId: "userTestimonialList",
        responses: {
          200: { description: "Public testimonials retrieved successfully" },
          400: { description: "Failed to fetch public testimonials" },
        },
      },
    },
  },
};
