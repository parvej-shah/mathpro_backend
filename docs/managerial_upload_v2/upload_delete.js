module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ["Course V2"],
  summary: "Delete uploaded object (admin)",
  description:
    "Deletes a previously uploaded storage object by key or public URL.",
  operationId: "adminDeleteUploadedObject",
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            key: {
              type: "string",
              example: "courses/thumbnails/1710000000000_abcd_thumbnail.png",
            },
            public_url: {
              type: "string",
              example: "https://cdn.mathpro.com/courses/thumbnails/1710000000000_abcd_thumbnail.png",
            },
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: "Object deleted",
    },
    400: {
      description: "Validation error",
    },
    500: {
      description: "Upload configuration error",
    },
  },
};
