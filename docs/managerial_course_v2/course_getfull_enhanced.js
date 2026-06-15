module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Course V2'],
  description: 'Get full course data with all Phase 8 fields (enhanced)',
  operationId: 'courseGetFullEnhanced',
  parameters: [
    {
      name: 'courseId',
      in: 'path',
      required: true,
      schema: { type: 'integer' },
      description: 'Course ID',
    },
  ],
  responses: {
    200: {
      description: 'Course data with all Phase 8 fields',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'integer', example: 5 },
                  title: { type: 'string', example: 'React Fundamentals' },
                  description: { type: 'string', example: 'Learn React from scratch' },
                  chapters: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer', example: 10 },
                        title: { type: 'string', example: 'Chapter 1' },
                        modules: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'integer', example: 25 },
                              title: { type: 'string', example: 'Module 1' },
                              instructor_id: { type: 'integer', nullable: true, example: 5 },
                              instructor: {
                                type: 'object',
                                nullable: true,
                                properties: {
                                  id: { type: 'integer', example: 5 },
                                  name: { type: 'string', example: 'John Doe' },
                                },
                              },
                              will_evaluated: { type: 'boolean', nullable: true, example: true },
                              quiz_time_limit: { type: 'integer', nullable: true, example: 30 },
                              quiz_attempt_limit: { type: 'integer', nullable: true, example: 3 },
                              pdf_drive_link: { type: 'string', nullable: true },
                              assignment_question_doc_url: { type: 'string', nullable: true },
                              assignment_question_doc_type: { type: 'string', nullable: true, enum: ['s3', 'drive'] },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    404: { description: 'Course not found' },
    401: { description: 'Unauthorized' },
  },
};
