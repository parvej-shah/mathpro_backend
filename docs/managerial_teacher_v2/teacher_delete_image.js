module.exports = {
  security: [{ bearerAuth: [] }],
  tags: ['Teacher V2'],
  description: 'Delete teacher profile image',
  operationId: 'teacherDeleteImage',
  parameters: [{ name: 'teacherId', in: 'path', required: true, schema: { type: 'integer' } }],
  responses: {
    200: { description: 'Image deleted successfully' },
    404: { description: 'Teacher not found' },
    401: { description: 'Unauthorized' },
  },
};
