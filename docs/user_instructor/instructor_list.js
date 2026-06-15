/**
 * GET /user/instructor/list
 * Get all instructors for public display
 */

module.exports = {
  tags: ['User Instructor'],
  summary: 'Get all instructors',
  description: 'Returns a list of all active instructors with their profile information and assigned course IDs. Public endpoint, no authentication required.',
  operationId: 'getInstructorList',
  security: [], // Public endpoint
  parameters: [],
  responses: {
    200: {
      description: 'Successfully retrieved instructors',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                example: true,
              },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: {
                      type: 'integer',
                      description: 'Instructor ID',
                      example: 4084,
                    },
                    name: {
                      type: 'string',
                      description: 'Instructor full name',
                      example: 'Sohaib Bin Musa',
                    },
                    image: {
                      type: 'string',
                      nullable: true,
                      description: 'Profile image URL',
                      example: 'https://Math Promedia.s3.ap-south-1.amazonaws.com/teachers/abc123.jpg',
                    },
                    role: {
                      type: 'string',
                      nullable: true,
                      description: 'Instructor role/title',
                      example: 'Instructor, Problem Setter, Moderator @ Math Pro',
                    },
                    university: {
                      type: 'string',
                      nullable: true,
                      description: 'University name',
                      example: 'BUET',
                    },
                    bio: {
                      type: 'string',
                      nullable: true,
                      description: 'Biography/description',
                      example: 'Experienced instructor with expertise in algorithms and competitive programming.',
                    },
                    achievements: {
                      type: 'array',
                      items: {
                        type: 'string',
                      },
                      description: 'Array of achievement strings',
                      example: ['BUET CSE\'18', 'Phd Student @ UC Santa Barbara'],
                    },
                    social: {
                      type: 'object',
                      description: 'Social media links',
                      properties: {
                        facebook: {
                          type: 'string',
                          nullable: true,
                          example: 'https://www.facebook.com/sohaib.561',
                        },
                        linkedin: {
                          type: 'string',
                          nullable: true,
                          example: 'https://www.linkedin.com/in/sohaib-bm/',
                        },
                        twitter: {
                          type: 'string',
                          nullable: true,
                        },
                        github: {
                          type: 'string',
                          nullable: true,
                        },
                        website: {
                          type: 'string',
                          nullable: true,
                        },
                      },
                    },
                    assignedCourses: {
                      type: 'array',
                      items: {
                        type: 'integer',
                      },
                      description: 'Array of course IDs (only live courses)',
                      example: [11, 12, 15],
                    },
                    isActive: {
                      type: 'boolean',
                      description: 'Active status (always true, filtered)',
                      example: true,
                    },
                    coursesCount: {
                      type: 'integer',
                      description: 'Number of courses taught by this instructor',
                      example: 5,
                    },
                    totalStudents: {
                      type: 'integer',
                      description: 'Total enrolled students across all courses',
                      example: 12500,
                    },
                  },
                  required: ['id', 'name', 'image', 'role', 'university', 'bio', 'achievements', 'social', 'assignedCourses', 'isActive', 'coursesCount', 'totalStudents'],
                },
              },
            },
            required: ['success', 'data'],
          },
          examples: {
            success: {
              summary: 'Successful response',
              value: {
                success: true,
                data: [
                  {
                    id: 4084,
                    name: 'Sohaib Bin Musa',
                    image: 'https://Math Promedia.s3.ap-south-1.amazonaws.com/teachers/abc123.jpg',
                    role: 'Instructor, Problem Setter, Moderator @ Math Pro',
                    university: 'BUET',
                    bio: 'Experienced instructor with expertise in algorithms and competitive programming.',
                    achievements: [
                      'BUET CSE\'18',
                      'Phd Student @ UC Santa Barbara',
                      'Ex-Lecturer @ BUET',
                    ],
                    social: {
                      facebook: 'https://www.facebook.com/sohaib.561',
                      linkedin: 'https://www.linkedin.com/in/sohaib-bm/',
                    },
                    assignedCourses: [11, 12, 15],
                    isActive: true,
                    coursesCount: 5,
                    totalStudents: 12500,
                  },
                ],
              },
            },
          },
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                example: false,
              },
              error: {
                type: 'string',
                example: 'Internal server error',
              },
              data: {
                type: 'null',
              },
            },
            required: ['success', 'error', 'data'],
          },
        },
      },
    },
  },
};
