module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Module V2'],
  description: 'Duplicate module with optional content',
  operationId: 'moduleDuplicate',
  parameters: [
    {
      name: 'moduleId',
      in: 'path',
      required: true,
      schema: { type: 'integer' },
      description: 'Module ID to duplicate',
    },
    {
      name: 'include_content',
      in: 'query',
      schema: { type: 'string', enum: ['true', 'false'], default: 'true' },
      description: 'Include module content in duplicate',
    },
    {
      name: 'new_chapter_id',
      in: 'query',
      schema: { type: 'integer', nullable: true },
      description: 'Chapter ID to place duplicate in (default: same chapter)',
    },
  ],
  responses: {
    200: {
      description: 'Module duplicated successfully',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: {
                type: 'object',
                properties: {
                  original_module_id: { type: 'integer', example: 25 },
                  new_module_id: { type: 'integer', example: 26 },
                  new_module: {
                    type: 'object',
                    properties: {
                      id: { type: 'integer', example: 26 },
                      title: { type: 'string', example: 'Module 1 (Copy)' },
                    },
                  },
                  message: { type: 'string', example: 'Module duplicated successfully' },
                },
              },
            },
          },
        },
      },
    },
    404: { description: 'Module or chapter not found' },
    401: { description: 'Unauthorized' },
  },
};
