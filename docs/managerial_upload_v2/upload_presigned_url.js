module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ["Course V2"],
  summary: "Create presigned upload URL (admin)",
  description:
    "Generates a validated presigned PUT URL for direct S3 upload. Backend validates purpose, file type, and file size before issuing URL.",
  operationId: "adminCreatePresignedUploadUrl",
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["purpose", "file_name", "content_type", "content_length"],
          properties: {
            purpose: { type: "string", example: "course-thumbnail" },
            file_name: { type: "string", example: "thumbnail.png" },
            content_type: { type: "string", example: "image/png" },
            content_length: { type: "integer", example: 523412 },
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: "Presigned URL generated",
    },
    422: {
      description: "Validation error",
    },
    500: {
      description: "Upload configuration error",
    },
  },
};
