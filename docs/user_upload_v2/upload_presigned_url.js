module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ["Profile+Reward+Level"],
  summary: "Create presigned upload URL (user)",
  description:
    "Generates a validated presigned PUT URL for direct storage upload for user-facing flows.",
  operationId: "userCreatePresignedUploadUrl",
  requestBody: {
    required: true,
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["purpose", "file_name", "content_type", "content_length"],
          properties: {
            purpose: { type: "string", example: "announcement-attachment" },
            file_name: { type: "string", example: "note.pdf" },
            content_type: { type: "string", example: "application/pdf" },
            content_length: { type: "integer", example: 10240 },
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
