module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Teacher V2'],
  description: 'Finalize teacher profile image after presigned upload. Send uploaded public URL.',
  operationId: 'teacherUploadImage',
  parameters: [
    {
      name: 'teacherId',
      in: 'path',
      required: true,
      schema: { type: 'integer' },
    },
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['image_url'],
          properties: {
            image_url: {
              type: 'string',
              example: 'https://Math Promedia.s3.ap-south-1.amazonaws.com/teachers/1736000000000_file.webp',
              description: 'Public URL returned from presigned upload',
            },
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Image uploaded successfully',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: {
                type: 'object',
                properties: {
                  teacher_id: { type: 'integer', example: 1 },
                  image: { type: 'string', example: 'https://s3.amazonaws.com/bucket/teachers/1704067200000_profile.jpg' },
                  message: { type: 'string', example: 'Teacher image updated successfully' },
                },
              },
            },
          },
        },
      },
    },
    400: { description: 'Bad request' },
    404: { description: 'Teacher not found' },
    401: { description: 'Unauthorized' },
  },
};
