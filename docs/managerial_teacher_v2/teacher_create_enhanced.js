module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Teacher V2'],
  description: 'Create teacher with enhanced fields',
  operationId: 'teacherCreateEnhanced',
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['name', 'login'],
          properties: {
            name: { type: 'string', example: 'Arghya Pal' },
            login: { type: 'string', example: '01712345678' },
            role: { type: 'string', example: 'Instructor at Math Pro' },
            university: { type: 'string', example: 'BUET' },
            bio: { type: 'string', example: 'Software Engineer at Google' },
            image: { type: 'string', example: '/CP instructors/arghya_pal_linkedin.jpeg' },
            achievements: { type: 'array', items: { type: 'string' } },
            social: { type: 'object' },
            courses_teaching: { type: 'array', items: { type: 'integer' } },
            bundles_teaching: { type: 'array', items: { type: 'integer' } },
            category: { type: 'string', example: 'instructor' },
            isActive: { type: 'boolean', example: true },
            isPrivileged: { type: 'boolean', example: false },
          },
        },
      },
    },
  },
  responses: {
    201: { description: 'Teacher created successfully' },
    409: { description: 'Login already exists' },
    422: { description: 'Validation error' },
    401: { description: 'Unauthorized' },
  },
};
