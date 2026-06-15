module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Teacher V2'],
  description: 'Update teacher with enhanced fields',
  operationId: 'teacherUpdateEnhanced',
  parameters: [{ name: 'teacherId', in: 'path', required: true, schema: { type: 'integer' } }],
  requestBody: {
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            login: { type: 'string' },
            role: { type: 'string' },
            university: { type: 'string' },
            bio: { type: 'string' },
            image: { type: 'string' },
            achievements: { type: 'array', items: { type: 'string' } },
            social: { type: 'object' },
            courses_teaching: { type: 'array', items: { type: 'integer' } },
            bundles_teaching: { type: 'array', items: { type: 'integer' } },
            category: { type: 'string' },
            isActive: { type: 'boolean' },
            isPrivileged: { type: 'boolean' },
          },
        },
      },
    },
  },
  responses: {
    200: { description: 'Teacher updated successfully' },
    404: { description: 'Teacher not found' },
    422: { description: 'Validation error' },
    401: { description: 'Unauthorized' },
  },
};
