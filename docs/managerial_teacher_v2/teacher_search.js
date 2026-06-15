module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Teacher V2'],
  description: 'Search and filter teachers',
  operationId: 'teacherSearch',
  parameters: [
    {
      name: 'q',
      in: 'query',
      description: 'Search term (name, role, university)',
      schema: { type: 'string' },
    },
    {
      name: 'category',
      in: 'query',
      description: 'Filter by category',
      schema: { type: 'string' },
    },
    {
      name: 'isActive',
      in: 'query',
      description: 'Filter by active status',
      schema: { type: 'boolean' },
    },
    {
      name: 'isPrivileged',
      in: 'query',
      description: 'Filter by privilege status',
      schema: { type: 'boolean' },
    },
    {
      name: 'hasCourses',
      in: 'query',
      description: 'Filter teachers with/without courses',
      schema: { type: 'boolean' },
    },
    {
      name: 'limit',
      in: 'query',
      description: 'Number of results',
      schema: { type: 'integer' },
    },
    {
      name: 'offset',
      in: 'query',
      description: 'Pagination offset',
      schema: { type: 'integer' },
    },
  ],
  responses: {
    200: {
      description: 'Search results',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer', example: 1 },
                    name: { type: 'string', example: 'Arghya Pal' },
                    login: { type: 'string', example: '01712345678' },
                    role: { type: 'string', example: 'Instructor at CoderVai' },
                    university: { type: 'string', example: 'BUET' },
                    category: { type: 'string', example: 'instructor' },
                    isActive: { type: 'boolean', example: true },
                    isPrivileged: { type: 'boolean', example: false },
                  },
                },
              },
              count: { type: 'integer', example: 1 },
            },
          },
        },
      },
    },
    400: { description: 'Bad request' },
    401: { description: 'Unauthorized' },
  },
};
