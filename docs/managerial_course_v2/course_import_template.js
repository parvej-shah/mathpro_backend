module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Course V2'],
  description: 'Get import template file (JSON or CSV)',
  operationId: 'courseImportTemplate',
  parameters: [
    {
      name: 'format',
      in: 'query',
      schema: { type: 'string', enum: ['json', 'csv'], default: 'json' },
      description: 'Template format',
    },
    {
      name: 'example_data',
      in: 'query',
      schema: { type: 'string', enum: ['true', 'false'], default: 'true' },
      description: 'Include example data',
    },
  ],
  responses: {
    200: {
      description: 'Template file download',
      content: {
        'application/json': {
          schema: { type: 'object' },
        },
        'text/csv': {
          schema: { type: 'string' },
        },
      },
    },
    401: { description: 'Unauthorized' },
  },
};
