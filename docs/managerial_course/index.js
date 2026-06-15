const managerialCourseList = require("./course_list");
const managerialCourseCreate = require("./course_create");
const managerialCourseUpdate = require("./course_update");
const managerialCourseGet = require("./course_get");
const managerialCourseGetFull = require("./course_getfull");

const managerialCourseDelete = require("./course_delete");

module.exports = {
  paths: {
    "/admin/course/list": {
      ...managerialCourseList,
    },
    "/admin/course/get/{id}": {
      ...managerialCourseGet,
    },
    "/admin/course/getfull/{id}": {
      ...managerialCourseGetFull,
    },
    "/admin/course/create": {
      ...managerialCourseCreate,
    },
    "/admin/course/update/{id}": {
      ...managerialCourseUpdate,
    },
    "/admin/course/delete/{id}": {
      ...managerialCourseDelete,
    },
    "/user/course/list": {
      get: {
        tags: ["Course Management"], // operation's tag
        description: "Get list of all available courses for users", // short desc
        operationId: "userCourseList", // unique operation id
        parameters: [], // expected params
        requestBody: {
          // expected request body
        },
        responses: {
          200: {
            description: "List of courses",
          },
          400: {
            description: "Failed to get courses",
          },
        },
      },
    },
    "/user/course/takes/{id}": {
      post: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Course Management"], // operation's tag
        description: "Take a course", // short desc
        operationId: "userCourseTakes", // unique operation id
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
          },
        ], // expected params
        requestBody: {
          // expected request body
        },
        responses: {
          200: {
            description: "Course Taken",
          },
          400: {
            description: "Course Take Failed",
          },
        },
      },
    },
    "/user/course/getfull/{id}": {
      get: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Course Management"], // operation's tag
        description: "Get full hierarchy of a single course", // short desc
        operationId: "userCourseGetFull", // unique operation id
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
          },
        ], // expected params
        // requestBody: {
        //   // expected request body
        //   content: {
        //     // content-type
        //     "application/json": {
        //       schema: {
        //         $ref: "#/components/schemas/managerial_", // todo input data model
        //       },
        //     },
        //   },
        // },
        responses: {
          200: {
            description: "Course Detailed Body",
          },
          400: {
            description: "Failed",
          },
        },
      },
    },
    "/user/course/dashboard/{id}": {
      get: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Course Management"],
        description: "Get lightweight dashboard data for enrolled students only. Returns essential course information including progress, instructor, and community links.",
        operationId: "userCourseDashboard",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            description: "Course ID",
            schema: {
              type: "integer",
            },
          },
        ],
        responses: {
          200: {
            description: "Dashboard data retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },
                    data: {
                      type: "object",
                      properties: {
                        id: { type: "integer", example: 10 },
                        title: { type: "string", example: "Discrete Mathematics" },
                        short_description: { type: "string", example: "Learn fundamental mathematics concepts..." },
                        thumbnails: {
                          type: "object",
                          properties: {
                            course_thumbnail_16_9: { type: "string", example: "https://Math Promedia.s3.ap-south-1.amazonaws.com/DM-169.png" },
                            trailer_video_thumb_16_9: { type: "string", nullable: true },
                            facebook_community_thumb_16_9: { type: "string", nullable: true },
                          },
                        },
                        media: {
                          type: "object",
                          properties: {
                            intro_video: { type: "string", nullable: true, example: "https://www.youtube.com/embed/TX8AX9FBZfg" },
                          },
                        },
                        progress: {
                          type: "object",
                          properties: {
                            maxModuleSerialProgress: { type: "integer", example: 15 },
                            totalModules: { type: "integer", example: 244 },
                            totalChapters: { type: "integer", example: 17 },
                            completedModules: { type: "integer", example: 15 },
                            progressPercentage: { type: "integer", example: 6 },
                          },
                        },
                        instructor: {
                          type: "object",
                          properties: {
                            name: { type: "string", example: "Farhan Feroz" },
                            credibility: { type: "string", example: "- Program Owner and Instructor @ Math Pro\\n- CSE'15, BUET..." },
                          },
                        },
                        community: {
                          type: "object",
                          description: "Private links (facebook_private_group, telegram_group) are returned only to enrolled students; this endpoint is enrolled-only.",
                          properties: {
                            facebook_community: { type: "string", example: "https://www.facebook.com/groups/mathprocommunity" },
                            facebook_page: { type: "string", nullable: true, example: "https://www.facebook.com/mathprobd" },
                            facebook_private_group: { type: "string", nullable: true, example: "https://www.facebook.com/groups/mathpro.csefundamental.dm.batch01" },
                            telegram_group: { type: "string", nullable: true, example: "https://t.me/+abcdEFGhij" },
                            whatsapp: { type: "string", example: "https://wa.me/8801768976036" },
                            phone: { type: "string", example: "tel:+8801768976036" },
                            email: { type: "string", example: "mailto:support@mathpro.com" },
                          },
                        },
                        enrollment: {
                          type: "object",
                          properties: {
                            enrollment_date: { type: "integer", example: 1704067200 },
                            is_enrolled: { type: "boolean", example: true },
                            total_seats: { type: "integer", nullable: true, example: 500 },
                            enrolled: { type: "integer", nullable: true, example: 452 },
                          },
                        },
                        enrollment_details: {
                          type: "object",
                          description: "Optional course schedule dates (sourced from chips.enrollment_details) as unix seconds (nullable).",
                          properties: {
                            prebooking_end_date: { type: "integer", nullable: true, example: 1732473599 },
                            enrollment_end_date: { type: "integer", nullable: true, example: 1738367999 },
                            course_start_date: { type: "integer", nullable: true, example: 1734480000 },
                          },
                        },
                        metadata: {
                          type: "object",
                          properties: {
                            is_live: { type: "boolean", example: true },
                            language: { type: "string", example: "বাংলা" },
                            url: { type: "string", example: "https://courses.mathpro.com/course-details/10" },
                            slug: { type: "string", nullable: true, example: "discrete-math" },
                            tags: { type: "array", items: { type: "string" }, example: ["CSE", "Math"] },
                            course_outline: { type: "string", nullable: true, example: "https://drive.google.com/file/d/.../view" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "Authentication required or access denied",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: false },
                    error: { type: "string" },
                  },
                },
                examples: {
                  notAuthenticated: {
                    summary: "Not Authenticated",
                    value: {
                      success: false,
                      error: "Authentication required. Please login and enroll in the course to access dashboard.",
                    },
                  },
                  notEnrolled: {
                    summary: "Not Enrolled",
                    value: {
                      success: false,
                      error: "You do not have access to this course. Please enroll to view course details.",
                    },
                  },
                  courseNotFound: {
                    summary: "Course Not Found",
                    value: {
                      success: false,
                      error: "Course not found",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/user/course/getScore/{id}": {
      get: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Rewarding System"], // operation's tag
        description: "Get current score of a user within a course", // short desc
        operationId: "usergetScoreOfACourse", // unique operation id
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
          },
        ], // expected params
        // requestBody: {
        //   // expected request body
        //   content: {
        //     // content-type
        //     "application/json": {
        //       schema: {
        //         $ref: "#/components/schemas/managerial_", // todo input data model
        //       },
        //     },
        //   },
        // },
        responses: {
          200: {
            description: "score object",
          },
          400: {
            description: "Failed",
          },
        },
      },
    },
    "/user/course/getRanking/{id}": {
      get: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Rewarding System"], // operation's tag
        description: "Get ranking of users within a course", // short desc
        operationId: "usersgetRankingOfACourse", // unique operation id
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
          },
          {
            in: "query",
            name: "offset",
            required: true,
          },
          {
            in: "query",
            name: "limit",
            required: true,
          },
        ], // expected params
        // requestBody: {
        //   // expected request body
        //   content: {
        //     // content-type
        //     "application/json": {
        //       schema: {
        //         $ref: "#/components/schemas/managerial_", // todo input data model
        //       },
        //     },
        //   },
        // },
        responses: {
          200: {
            description: "ranking object",
          },
          400: {
            description: "Failed",
          },
        },
      },
    },
    "/user/course/prebook/{id}": {
      post: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Course Management"], // operation's tag
        description:
          "Prebook a course - Express interest in a course before it's available. Optionally include utm parameter to track campaign source. Authentication is optional - if provided, the user_id will be associated with the prebooking.", // short desc
        operationId: "usersBooksACourse", // unique operation id
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            description: "Course ID",
            schema: {
              type: "integer",
            },
          },
        ], // expected params
        requestBody: {
          // expected request body
          content: {
            // content-type
            "application/json": {
              schema: {
                type: "object",
                description: "Prebook course data",
                properties: {
                  name: {
                    type: "string",
                    description: "User's full name",
                    example: "John Doe",
                  },
                  email: {
                    type: "string",
                    description: "User's email address",
                    example: "john@example.com",
                  },
                  phone: {
                    type: "string",
                    description: "User's phone number",
                    example: "+8801234567890",
                  },
                  utm: {
                    type: "string",
                    description:
                      "UTM parameter to track campaign source (e.g., courseDemo, bootcampClass). Optional field.",
                    example: "courseDemo",
                  },
                },
                required: ["name", "email", "phone"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Course prebooked successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },
                    data: {
                      type: "object",
                      properties: {
                        id: {
                          type: "integer",
                          example: 1,
                        },
                        course_id: {
                          type: "integer",
                          example: 5,
                        },
                        name: {
                          type: "string",
                          example: "John Doe",
                        },
                        email: {
                          type: "string",
                          example: "john@example.com",
                        },
                        phone: {
                          type: "string",
                          example: "+8801234567890",
                        },
                        utm: {
                          type: "string",
                          description: "UTM parameter value",
                          example: "courseDemo",
                        },
                        timestamp: {
                          type: "integer",
                          example: 1732464000,
                        },
                        user_id: {
                          type: "integer",
                          example: null,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "Validation error or failed to prebook course",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      example: false,
                    },
                    error: {
                      type: "string",
                      description: "Error message. For validation errors, indicates which required fields are missing.",
                      example: "Missing required fields: email, name, phone. Name, email, and phone are required for prebooking.",
                    },
                  },
                },
                examples: {
                  validationError: {
                    summary: "Validation Error - Missing Required Fields",
                    value: {
                      success: false,
                      error: "Missing required fields: email, name, phone. Name, email, and phone are required for prebooking.",
                    },
                  },
                  partialValidationError: {
                    summary: "Validation Error - Partial Missing Fields",
                    value: {
                      success: false,
                      error: "Missing required fields: name, phone. Name, email, and phone are required for prebooking.",
                    },
                  },
                  serverError: {
                    summary: "Server Error",
                    value: {
                      success: false,
                      error: "Failed to create prebooking",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/user/course/getWishList": {
      get: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Course Management"], // operation's tag
        description: "Get wishlist of a user", // short desc
        operationId: "usersGetWishList", // unique operation id
        parameters: [], // expected params
        requestBody: {
          // expected request body
        },
        responses: {
          200: {
            description: "Wishes",
          },
          400: {
            description: "Failed",
          },
        },
      },
    },
    "/user/course/applyCoupon/{course_id}": {
      post: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Course Management"], // operation's tag
        description: "Apply Coupon to a course", // short desc
        operationId: "usersApplyCoupon", // unique operation id
        parameters: [
          {
            in: "path",
            name: "course_id",
            required: true,
          },
        ], // expected params
        requestBody: {
          // expected request body
          content: {
            // content-type
            "application/json": {
              schema: {
                type: "object",
                description: "data",
                example: {
                  coupon: "Coupon",
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Wishes",
          },
          400: {
            description: "Failed",
          },
        },
      },
    },
    "/user/course/getAnalytics": {
      get: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Course Management"], // operation's tag
        description: "Get Analytics", // short desc
        operationId: "adminGetAnalytics", // unique operation id
        parameters: [], // expected params
        requestBody: {
          // expected request body
        },
        responses: {
          200: {
            description: "Analytics",
          },
          400: {
            description: "Failed",
          },
        },
      },
    },
    "/admin/course/getAllPrebookings": {
      get: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Course Management"], // operation's tag
        description: "Export all course prebookings as CSV file with utm field",
        operationId: "adminGetAllCoursePrebookingsCSV",
        parameters: [
          {
            in: "query",
            name: "identifier",
            required: true,
            description: "Encrypted course ID",
          },
        ],
        requestBody: {
          // expected request body
        },
        responses: {
          200: {
            description: "CSV file with prebooking data including utm field",
            content: {
              "text/csv": {
                schema: {
                  type: "string",
                  example:
                    "Name,Phone,Email,UTM,Date and Time\nJohn Doe,+8801234567890,john@example.com,courseDemo,11/24/2025, 2:00:00 PM",
                },
              },
            },
          },
          400: {
            description: "Failed to export prebookings",
          },
        },
      },
    },
    "/admin/course/getAllPrebookingsApi": {
      get: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Course Management"], // operation's tag
        description:
          "Get all course prebookings as JSON response with utm field",
        operationId: "adminGetAllCoursePrebookingsJSON",
        parameters: [
          {
            in: "query",
            name: "identifier",
            required: true,
            description: "Encrypted course ID",
          },
        ],
        requestBody: {
          // expected request body
        },
        responses: {
          200: {
            description: "List of course prebookings with utm field",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: {
                            type: "string",
                            example: "John Doe",
                          },
                          phone: {
                            type: "string",
                            example: "+8801234567890",
                          },
                          email: {
                            type: "string",
                            example: "john@example.com",
                          },
                          utm: {
                            type: "string",
                            description: "UTM parameter value",
                            example: "courseDemo",
                          },
                          timestamp: {
                            type: "integer",
                            example: 1732464000,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "Failed to fetch prebookings",
          },
        },
      },
    },
    "/admin/course/prebooking/{prebookingId}/utm": {
      put: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Course Management"],
        description: "Update UTM field for a course prebooking record",
        operationId: "adminUpdateCoursePrebookingUtm",
        parameters: [
          {
            in: "path",
            name: "prebookingId",
            required: true,
            description: "Prebooking record ID",
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  utm: {
                    type: "string",
                    description:
                      "UTM parameter value (e.g., courseDemo, bootcampClass). Set to null to clear.",
                    example: "courseDemo",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "UTM field updated successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    message: {
                      type: "string",
                      example: "UTM field updated successfully",
                    },
                    data: {
                      type: "object",
                      properties: {
                        id: { type: "integer", example: 1 },
                        course_id: { type: "integer", example: 5 },
                        name: { type: "string", example: "John Doe" },
                        email: { type: "string", example: "john@example.com" },
                        phone: {
                          type: "string",
                          example: "+8801234567890",
                        },
                        utm: {
                          type: "string",
                          example: "courseDemo",
                        },
                        timestamp: { type: "integer", example: 1732464000 },
                        user_id: { type: "integer", example: null },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "Failed to update UTM field or prebooking not found",
          },
        },
      },
      delete: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Course Management"],
        description: "Delete/clear UTM field for a course prebooking record",
        operationId: "adminDeleteCoursePrebookingUtm",
        parameters: [
          {
            in: "path",
            name: "prebookingId",
            required: true,
            description: "Prebooking record ID",
            schema: { type: "integer" },
          },
        ],
        responses: {
          200: {
            description: "UTM field deleted successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    message: {
                      type: "string",
                      example: "UTM field deleted successfully",
                    },
                    data: {
                      type: "object",
                      properties: {
                        id: { type: "integer", example: 1 },
                        course_id: { type: "integer", example: 5 },
                        name: { type: "string", example: "John Doe" },
                        email: { type: "string", example: "john@example.com" },
                        phone: {
                          type: "string",
                          example: "+8801234567890",
                        },
                        utm: { type: "string", example: null },
                        timestamp: { type: "integer", example: 1732464000 },
                        user_id: { type: "integer", example: null },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "Failed to delete UTM field or prebooking not found",
          },
        },
      },
    },
    "/user/course/{courseId}/routine": {
      get: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Course Management"],
        description: "Get current week's routine banner for a course (user-facing)",
        operationId: "userCourseGetRoutine",
        parameters: [
          {
            in: "path",
            name: "courseId",
            required: true,
            description: "Course ID",
            schema: {
              type: "integer",
            },
          },
        ],
        responses: {
          200: {
            description: "Current routine retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },
                    data: {
                      type: "object",
                      nullable: true,
                      properties: {
                        routine_image_url: {
                          type: "string",
                          example: "https://Math Promedia.s3.ap-south-1.amazonaws.com/routines/course-15-week-1.jpg",
                        },
                        week_number: {
                          type: "integer",
                          example: 1,
                        },
                        week_start_date: {
                          type: "string",
                          format: "date",
                          example: "2025-11-25",
                        },
                        week_end_date: {
                          type: "string",
                          format: "date",
                          example: "2025-12-01",
                        },
                        course_title: {
                          type: "string",
                          example: "Structured Programming Language",
                        },
                      },
                    },
                    message: {
                      type: "string",
                      description: "Message when no routine found",
                      example: "No active routine found for current week",
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "Failed to retrieve routine",
          },
        },
      },
    },
    // '/todos/{id}':{
    //     ...getTodo,
    //     ...updateTodo,
    //     ...deleteTodo
    // }
  },
};
