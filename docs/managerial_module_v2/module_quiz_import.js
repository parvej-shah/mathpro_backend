module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Module V2'],
  description: 'Import quiz data (JSON) - Questions and options only, no answers/explanations',
  operationId: 'moduleQuizImport',
  parameters: [
    {
      name: 'moduleId',
      in: 'path',
      required: true,
      schema: { type: 'integer' },
      description: 'Module ID',
    },
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['quiz'],
          properties: {
            quiz: {
              type: 'array',
              items: {
                type: 'object',
                required: ['question', 'options'],
                properties: {
                  question: { 
                    type: 'string', 
                    example: 'What is 2+2?',
                    description: 'Plain text question (required)'
                  },
                  question_html: { 
                    type: 'string', 
                    nullable: true,
                    description: 'HTML formatted question (optional - if missing, same as question)'
                  },
                  question_latex: { 
                    type: 'string', 
                    nullable: true,
                    description: 'LaTeX question (optional, for backward compatibility)'
                  },
                  options: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['2', '3', '4', '5'],
                    description: 'Plain text options array (required, minimum 2 items)'
                  },
                  options_html: {
                    type: 'array',
                    items: { type: 'string' },
                    nullable: true,
                    example: ['2', '3', '4', '5'],
                    description: 'HTML formatted options array (optional - if missing, same as options)'
                  },
                  points: { 
                    type: 'integer', 
                    default: 1, 
                    example: 1,
                    description: 'Points for this question (optional, defaults to 1)'
                  },
                  explanation_latex: { 
                    type: 'string', 
                    nullable: true,
                    description: 'LaTeX explanation (optional, for backward compatibility)'
                  },
                },
              },
            },
            metadata: {
              type: 'object',
              properties: {
                time_limit: { type: 'integer', nullable: true, example: 30 },
                attempt_limit: { type: 'integer', nullable: true, example: 3 },
              },
            },
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Quiz imported successfully',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: {
                type: 'object',
                properties: {
                  imported_count: { type: 'integer', example: 10 },
                  total_questions: { type: 'integer', example: 10 },
                },
              },
            },
          },
        },
      },
    },
    400: { description: 'Invalid quiz structure or validation error' },
    404: { description: 'Module not found or not a quiz' },
    401: { description: 'Unauthorized' },
  },
};
