const basicInfo = require("./basicInfo");
const servers = require("./servers");
const components = require("./components");
const tags = require("./tags");
const managerialAuth = require("./managerial_auth");
const managerialAdmin = require("./managerial_admin");
const managerialCourse = require("./managerial_course");
const managerialChapter = require("./managerial_chapter");
const managerialModule = require("./managerial_module");
const managerialRoutine = require("./managerial_routine");
const managerialUser = require("./managerial_user");
const managerialCoupon = require("./managerial_coupon");
const userCoupon = require("./user_coupon");
const streak = require("./streak");
const userFeedback = require("./user_feedback");
const managerialFeedback = require("./managerial_feedback");
const userModuleFeedback = require("./user_module_feedback");
const managerialModuleFeedback = require("./managerial_module_feedback");
const userModuleViews = require("./user_module_views");
const managerialTeacherV2 = require("./managerial_teacher_v2");
const managerialCourseV2 = require("./managerial_course_v2");
const managerialModuleV2 = require("./managerial_module_v2");
const userInstructor = require("./user_instructor");
const managerialUploadV2 = require("./managerial_upload_v2");
const userUploadV2 = require("./user_upload_v2");
const managerialRole = require("./managerial_role");
const analytics = require("./analytics");
const managerialFaq = require("./managerial_faq");
const managerialTestimonial = require("./managerial_testimonial");


module.exports = {
  ...basicInfo,
  ...servers,
  ...components,
  ...tags,
  paths: {
    ...managerialAuth.paths,
    ...managerialAdmin.paths,
    ...managerialUser.paths,
    ...managerialRole.paths,
    ...managerialFaq.paths,
    ...managerialTestimonial.paths,
    ...managerialRoutine,
    ...analytics.paths,
    ...managerialCoupon.paths,
    ...userCoupon.paths,
    ...userFeedback.paths,
    ...managerialFeedback.paths,
    ...userModuleFeedback.paths,
    ...managerialModuleFeedback.paths,
    ...userModuleViews.paths,
    ...managerialTeacherV2.paths,
    ...managerialCourseV2.paths,
    ...managerialModuleV2.paths,
    ...userInstructor.paths,
    ...managerialUploadV2.paths,
    ...userUploadV2.paths,
    ...managerialCourse.paths,
    ...managerialChapter.paths,
    ...managerialModule.paths,
    "/user/assignment/submit/{moduleId}": {
      post: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Assignment Management"], // operation's tag
        description: "Submit an assignment", // short desc
        operationId: "userAssignmentSubmit", // unique operation id
        parameters: [
          {
            in: "path",
            name: "moduleId",
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
                properties: {
                  submission: {
                    type: "object",
                    description: "Submission Object",
                    example: {
                      yt_link: "youtube_link",
                      git_link: "git_link",
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Assignment Submitted",
          },
          400: {
            description: "Submission Failed",
          },
        },
      },
    },
    "/user/assignment/edit/{moduleId}": {
      put: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Assignment Management"], // operation's tag
        description: "Edit a submission", // short desc
        operationId: "userAssignmentEdit", // unique operation id
        parameters: [
          {
            in: "path",
            name: "moduleId",
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
                properties: {
                  submission: {
                    type: "object",
                    description: "Submission Object",
                    example: {
                      yt_link: "youtube_link_new",
                      git_link: "git_link_new",
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Assignment Submission Edited",
          },
          400: {
            description: "Submission Failed",
          },
        },
      },
    },
    "/user/assignment/view/{moduleId}": {
      get: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Assignment Management"], // operation's tag
        description: "View a submission", // short desc
        operationId: "userAssignmentView", // unique operation id
        parameters: [
          {
            in: "path",
            name: "moduleId",
            required: true,
          },
        ], // expected params
        requestBody: {
          // expected request body
        },
        responses: {
          200: {
            description: "Assignment Submission Fetched",
          },
          400: {
            description: "Submission Fetch Failed",
          },
        },
      },
    },
    "/admin/assignment/pendingEvaluations/{moduleId}": {
      get: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Assignment Management"], // operation's tag
        description: "View pending evaluatiions", // short desc
        operationId: "adminPendingEvaluationList", // unique operation id
        parameters: [
          {
            in: "path",
            name: "moduleId",
            required: true,
          },
        ], // expected params
        requestBody: {
          // expected request body
        },
        responses: {
          200: {
            description: "Pending Evaluations Fetched",
          },
          400: {
            description: "Pending Evaluations Fetch Failed",
          },
        },
      },
    },
    "/admin/assignment/evaluate/{moduleId}/{userId}": {
      put: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Assignment Management"], // operation's tag
        description: "Evaluate a submission", // short desc
        operationId: "adminEvaluationEvaluate", // unique operation id
        parameters: [
          {
            in: "path",
            name: "moduleId",
            required: true,
          },
          {
            in: "path",
            name: "userId",
            required: true,
          },
          {
            in: "query",
            name: "points",
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
                properties: {
                  evaluation: {
                    type: "object",
                    description: "Evaluation Object",
                    example: {
                      verdict: "PASSED",
                      comment: "improve indentation",
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Evaluation Done",
          },
          400: {
            description: "Evaluation Failed",
          },
        },
      },
    },
    "/user/payment/initiate/{courseId}": {
      post: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Payment"],
        description: "Initiate payment gateway for course purchase with optional coupon. Generates transaction ID (access code) and redirects to SSLCommerz payment page. **Coupon usage is recorded immediately** during this call (status: 'pending'), ensuring analytics work without waiting for IPN.",
        operationId: "userPaymentInitiate",
        parameters: [
          {
            in: "path",
            name: "courseId",
            required: true,
            schema: { type: "integer" },
            description: "Course ID to purchase",
            example: 5,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["user_id"],
                properties: {
                  user_id: {
                    type: "integer",
                    description: "User ID (also extracted from auth token)",
                    example: 123,
                  },
                  coupon_code: {
                    type: "string",
                    description: "Optional: Coupon code to apply discount. Coupon usage is recorded immediately (status: 'pending') during payment initiation.",
                    example: "SAVE20",
                  },
                  eventId: {
                    type: "number",
                    description: "Optional: Event ID for special pricing",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Payment gateway URL generated successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "string",
                      description: "SSLCommerz payment gateway URL",
                      example: "https://securepay.sslcommerz.com/gwprocess/v4/gw.php?Q=PAY&SESSIONKEY=...",
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "Payment initiation failed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: false },
                    data: { type: "string", example: "error occurred" },
                  },
                },
              },
            },
          },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/in/auth/register": {
      post: {
        security: [],
        tags: ["In"], // operation's tag
        description: "Register", // short desc
        operationId: "inAuthRegister", // unique operation id
        parameters: [], // expected params
        requestBody: {
          // expected request body
          content: {
            // content-type
            "application/json": {
              schema: {
                type: "object",
                description: "Register",
                example: {
                  login: "mehrab.haque.0001@gmail.com",
                  password: "passWord123$$$",
                  name: "Md. Mehrab Haque",
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Registration Successful",
          },
          400: {
            description: "Registration Failed",
          },
        },
      },
    },
    "/in/auth/login": {
      post: {
        security: [],
        tags: ["In"], // operation's tag
        description: "Login", // short desc
        operationId: "inAuthLogin", // unique operation id
        parameters: [], // expected params
        requestBody: {
          // expected request body
          content: {
            // content-type
            "application/json": {
              schema: {
                type: "object",
                description: "Login",
                example: {
                  login: "mehrab.haque.0001@gmail.com",
                  password: "passWord123$$$",
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Login Successful",
          },
          400: {
            description: "Login Failed",
          },
        },
      },
    },
    "/in/item/list/{platform}/{level}/{parentId}": {
      get: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["In"], // operation's tag
        description: "Item List", // short desc
        operationId: "inItemList", // unique operation id
        parameters: [
          {
            in: "path",
            name: "platform",
            required: true,
          },
          {
            in: "path",
            name: "level",
            required: true,
          },
          {
            in: "path",
            name: "parentId",
            required: true,
          },
        ], // expected params
        requestBody: {
          // expected request body
        },
        responses: {
          200: {
            description: "List Successful",
          },
          400: {
            description: "List Failed",
          },
        },
      },
    },
    "/in/item/create/{platform}/{level}/{parentId}": {
      post: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["In"], // operation's tag
        description: "Create", // short desc
        operationId: "inItemCreate", // unique operation id
        parameters: [
          {
            in: "path",
            name: "platform",
            required: true,
          },
          {
            in: "path",
            name: "level",
            required: true,
          },
          {
            in: "path",
            name: "parentId",
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
                  data: {
                    key: "value",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Create Successful",
          },
          400: {
            description: "Create Failed",
          },
        },
      },
    },
    "/in/item/update/{id}": {
      put: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["In"], // operation's tag
        description: "Update", // short desc
        operationId: "inItemUpdate", // unique operation id
        parameters: [
          {
            in: "path",
            name: "id",
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
                  data: {
                    key: "changed value",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Update Successful",
          },
          400: {
            description: "Update Failed",
          },
        },
      },
    },
    "/in/item/delete/{id}": {
      delete: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["In"], // operation's tag
        description: "Delete", // short desc
        operationId: "inItemDelete", // unique operation id
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
            description: "Delete Successful",
          },
          400: {
            description: "Delete Failed",
          },
        },
      },
    },
    "/in/item/qr": {
      get: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["In"], // operation's tag
        description: "qr", // short desc
        operationId: "ibrDelete", // unique operation id
        parameters: [
          {
            in: "query",
            name: "title",
            required: true,
            example: "Marketing Video",
          },
          {
            in: "query",
            name: "link",
            required: true,
            example: "https://youtu.be/-pSznQnOsik?si=EyEQ73RV1sDm1X07",
          },
        ], // expected params
        requestBody: {
          // expected request body
        },
        responses: {
          200: {
            description: "Delete Successful",
          },
          400: {
            description: "Delete Failed",
          },
        },
      },
    },
    "/admin/teacher/list": {
      get: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Teacher Management"], // operation's tag
        description: "List Of Teachers", // short desc
        operationId: "adminTeacherList", // unique operation id
        parameters: [], // expected params
        requestBody: {},
        responses: {
          200: {
            description: "List of Teachers",
          },
          400: {
            description: "teacher list Fetch Failed",
          },
        },
      },
    },
    "/admin/teacher/profile/{id}": {
      get: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Teacher Management"], // operation's tag
        description: "Get Profile of a teacher", // short desc
        operationId: "adminTeacherGet", // unique operation id
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            example: 432,
          },
        ], // expected params
        requestBody: {},
        responses: {
          200: {
            description: "Teacher Profile",
          },
          400: {
            description: "teacher list Get Failed",
          },
        },
      },
    },
    "/admin/teacher/create": {
      post: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Teacher Management"], // operation's tag
        description: "Create teacher", // short desc
        operationId: "adminTeacherCreate", // unique operation id
        parameters: [], // expected params
        requestBody: {
          content: {
            // content-type
            "application/json": {
              schema: {
                $ref: "#/components/schemas/teacher", // todo input data model
              },
            },
          },
        },
        responses: {
          200: {
            description: "Teacher Creation Done",
          },
          400: {
            description: "teacher Creation Failed",
          },
        },
      },
    },
    "/admin/teacher/update/{teacherId}": {
      put: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Teacher Management"], // operation's tag
        description: "Update teacher", // short desc
        operationId: "adminTeacherUpdate", // unique operation id
        parameters: [
          {
            in: "path",
            name: "teacherId",
            required: true,
          },
        ], // expected params
        requestBody: {
          content: {
            // content-type
            "application/json": {
              schema: {
                $ref: "#/components/schemas/teacher", // todo input data model
              },
            },
          },
        },
        responses: {
          200: {
            description: "Teacher Update Done",
          },
          400: {
            description: "teacher Update Failed",
          },
        },
      },
    },
    "/admin/teacher/delete/{teacherId}": {
      delete: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Teacher Management"], // operation's tag
        description: "Delete a teacher", // short desc
        operationId: "adminTeacherDelete", // unique operation id
        parameters: [
          {
            in: "path",
            name: "teacherId",
            required: true,
          },
        ], // expected params
        requestBody: {},
        responses: {
          200: {
            description: "Delete a teacher",
          },
          400: {
            description: "teacher deletion failed",
          },
        },
      },
    },
    "/admin/teacher/reset-password/{teacherId}": {
      put: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Teacher Management"], // operation's tag
        description: "Reset a teacher's password", // short desc
        operationId: "adminTeacherResetPass", // unique operation id
        parameters: [
          {
            in: "path",
            name: "teacherId",
            required: true,
          },
        ], // expected params
        requestBody: {},
        responses: {
          200: {
            description: "Password reset successfully",
          },
          400: {
            description: "Password reset failed",
          },
        },
      },
    },

    "/user/course/getMyCoursesPage": {
      get: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Profile+Reward+Level"], // operation's tag
        description: "Get My Courses Page", // short desc
        operationId: "usersGetMyCoursesPage", // unique operation id
        parameters: [], // expected params
        requestBody: {
          // expected request body
        },
        responses: {
          200: {
            description: "Page Data",
          },
          400: {
            description: "Failed",
          },
        },
      },
    },
    "/admin/auth/getProfile": {
      get: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Profile+Reward+Level"], // operation's tag
        description: "Get profile of a user", // short desc
        operationId: "userGetProfile", // unique operation id
        parameters: [], // expected params
        requestBody: {},
        responses: {
          200: {
            description: "Profile fetched successfully",
          },
          400: {
            description: "Profile fetch failed",
          },
        },
      },
    },
    "/admin/auth/setProfile": {
      put: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["Profile+Reward+Level"], // operation's tag
        description: "Set profile of a user", // short desc
        operationId: "userSetProfile", // unique operation id
        parameters: [], // expected params
        requestBody: {
          // expected request body
          content: {
            // content-type
            "application/json": {
              schema: {
                type: "object",
                description: "data",
                example: {
                  name: "Zehady",
                  profile: {
                    facebookId: "zehady.fb",
                    address: "Dhaka, Bangladesh",
                    schoolCollege: "Dhaka College",
                    group: "Science",
                    guardianName: "Abdul Karim",
                    guardianMobile: "01712345678",
                    relationWithGuardian: "Father",
                    gender: "Male",
                    classLevel: "HSC",
                    version: "Bangla",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Profile set successfully",
          },
          400: {
            description: "Profile set failed",
          },
        },
      },
    },
    // Bundle APIs - User
    "/user/bundle": {
      get: {
        tags: ["User Bundle"],
        description:
          "Get all available bundles with prebooking and enrollment counts",
        operationId: "userBundleList",
        responses: {
          200: {
            description: "Successfully retrieved bundles",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/bundle" },
                    },
                  },
                },
                example: {
                  success: true,
                  data: [
                    {
                      id: 1,
                      title: "Full Stack Development Bundle",
                      price: 5000,
                      url: "full-stack-bundle",
                      short_description: "Master full-stack development",
                      is_live: true,
                      prebooking: 15,
                      enrolled: 8,
                      course_count: 3,
                    },
                  ],
                },
              },
            },
          },
          400: { description: "Failed to retrieve bundles" },
        },
      },
    },
    "/user/bundle/{id}": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["User Bundle"],
        description: "Get bundle details with prebooking and enrollment counts",
        operationId: "userBundleGet",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            description: "Bundle ID",
            schema: { type: "integer" },
            example: 1,
          },
        ],
        responses: {
          200: {
            description: "Successfully retrieved bundle details",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "array",
                      items: {
                        allOf: [
                          { $ref: "#/components/schemas/bundle" },
                          {
                            type: "object",
                            properties: {
                              purchased: {
                                type: "boolean",
                                description:
                                  "Whether current user has purchased this bundle",
                                example: false,
                              },
                              purchase_date: {
                                type: "integer",
                                description: "Unix timestamp of purchase",
                                example: null,
                              },
                              transaction_id: {
                                type: "string",
                                description: "Payment transaction ID",
                                example: null,
                              },
                              owned_courses: {
                                type: "array",
                                items: { type: "integer" },
                                description:
                                  "Array of course IDs user already owns",
                                example: [1, 3],
                              },
                              courses: {
                                type: "array",
                                description: "Courses included in the bundle",
                                items: {
                                  type: "object",
                                  properties: {
                                    id: { type: "integer" },
                                    title: { type: "string" },
                                    price: { type: "integer" },
                                    url: { type: "string" },
                                  },
                                },
                              },
                            },
                          },
                        ],
                      },
                    },
                  },
                },
                example: {
                  success: true,
                  data: [
                    {
                      id: 1,
                      title: "Full Stack Development Bundle",
                      price: 5000,
                      url: "full-stack-bundle",
                      short_description: "Master full-stack development",
                      is_live: true,
                      prebooking: 15,
                      enrolled: 8,
                      course_count: 3,
                      purchased: false,
                      owned_courses: [1],
                      courses: [
                        {
                          id: 1,
                          title: "React Fundamentals",
                          price: 2000,
                          url: "react-fundamentals",
                        },
                        {
                          id: 2,
                          title: "Node.js Backend",
                          price: 2000,
                          url: "nodejs-backend",
                        },
                      ],
                    },
                  ],
                },
              },
            },
          },
          400: { description: "Failed to retrieve bundle" },
        },
      },
    },
    "/user/bundle/my-bundles/{user_id}": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["User Bundle"],
        description: "Get user's purchased bundles",
        operationId: "userBundleMyBundles",
        parameters: [
          {
            in: "path",
            name: "user_id",
            required: true,
            description: "User ID",
          },
        ],
        responses: {
          200: { description: "Successfully retrieved user's bundles" },
          400: { description: "Failed to retrieve bundles" },
        },
      },
    },
    "/user/bundle/bundle-courses/{user_id}": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["User Bundle"],
        description: "Get courses from user's bundles",
        operationId: "userBundleCourses",
        parameters: [
          {
            in: "path",
            name: "user_id",
            required: true,
            description: "User ID",
          },
        ],
        responses: {
          200: { description: "Successfully retrieved bundle courses" },
          400: { description: "Failed to retrieve courses" },
        },
      },
    },
    "/user/bundle/all-courses/{user_id}": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["User Bundle"],
        description: "Get all user's courses (individual + bundle)",
        operationId: "userBundleAllCourses",
        parameters: [
          {
            in: "path",
            name: "user_id",
            required: true,
            description: "User ID",
          },
        ],
        responses: {
          200: { description: "Successfully retrieved all courses" },
          400: { description: "Failed to retrieve courses" },
        },
      },
    },
    "/user/bundle/{id}/check-purchase/{user_id}": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["User Bundle"],
        description: "Check bundle purchase status",
        operationId: "userBundleCheckPurchase",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            description: "Bundle ID",
          },
          {
            in: "path",
            name: "user_id",
            required: true,
            description: "User ID",
          },
        ],
        responses: {
          200: { description: "Purchase status retrieved" },
          400: { description: "Failed to check status" },
        },
      },
    },
    "/user/bundle/{id}/check-prebook/{user_id}": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["User Bundle"],
        description: "Check bundle prebook status",
        operationId: "userBundleCheckPrebook",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            description: "Bundle ID",
          },
          {
            in: "path",
            name: "user_id",
            required: true,
            description: "User ID",
          },
        ],
        responses: {
          200: { description: "Prebook status retrieved" },
          400: { description: "Failed to check status" },
        },
      },
    },
    "/user/bundle/{id}/check-duplicates/{user_id}": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["User Bundle"],
        description: "Check for duplicate courses in bundle",
        operationId: "userBundleCheckDuplicates",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            description: "Bundle ID",
          },
          {
            in: "path",
            name: "user_id",
            required: true,
            description: "User ID",
          },
        ],
        responses: {
          200: { description: "Duplicate check completed" },
          400: { description: "Failed to check duplicates" },
        },
      },
    },
    "/user/prebookBundle/{id}": {
      post: {
        security: [{ bearerAuth: [] }],
        tags: ["User Bundle"],
        description:
          "Prebook a bundle - Express interest in a bundle before it's available. Optionally include utm parameter to track campaign source. Authentication is optional - if provided, the user_id will be associated with the prebooking.",
        operationId: "usersPrebooksABundle",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            description: "Bundle ID",
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                description: "Prebook bundle data",
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
                    example: "bootcampClass",
                  },
                },
                required: ["name", "email", "phone"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Bundle prebooked successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        id: { type: "integer", example: 1 },
                        bundle_id: { type: "integer", example: 3 },
                        name: { type: "string", example: "John Doe" },
                        email: { type: "string", example: "john@example.com" },
                        phone: {
                          type: "string",
                          example: "+8801234567890",
                        },
                        utm: {
                          type: "string",
                          description: "UTM parameter value",
                          example: "bootcampClass",
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
            description: "Validation error or failed to prebook bundle",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: false },
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

    // Bundle APIs - Admin
    "/admin/bundle": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["Admin Bundle"],
        description: "Get all bundles (Admin)",
        operationId: "adminBundleList",
        responses: {
          200: { description: "Successfully retrieved bundles" },
          400: { description: "Failed to retrieve bundles" },
        },
      },
      post: {
        security: [{ bearerAuth: [] }],
        tags: ["Admin Bundle"],
        description: "Create new bundle",
        operationId: "adminBundleCreate",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string", example: "Web Development Bundle" },
                  price: { type: "number", example: 4000 },
                  original_price: { type: "number", example: 5000 },
                  url: { type: "string", example: "web-dev-bundle" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Bundle created successfully" },
          400: { description: "Failed to create bundle" },
        },
      },
    },
    "/admin/bundle/enhanced": {
      post: {
        security: [{ bearerAuth: [] }],
        tags: ["Admin Bundle"],
        description: "Create enhanced bundle with all features",
        operationId: "adminBundleCreateEnhanced",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string", example: "Full Stack Bundle" },
                  price: { type: "number", example: 5000 },
                  short_description: {
                    type: "string",
                    example: "Complete web development course",
                  },
                  you_get: { type: "array", items: { type: "string" } },
                  chips: { type: "array", items: { type: "string" } },
                  faq_list: { type: "array", items: { type: "object" } },
                  feedback_list: { type: "array", items: { type: "object" } },
                  intro_video: {
                    type: "string",
                    example: "https://youtube.com/watch?v=xyz",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Enhanced bundle created successfully" },
          400: { description: "Failed to create bundle" },
        },
      },
    },
    "/admin/bundle/{id}": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["Admin Bundle"],
        description: "Get bundle details (Admin)",
        operationId: "adminBundleGet",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            description: "Bundle ID",
          },
        ],
        responses: {
          200: { description: "Successfully retrieved bundle" },
          400: { description: "Failed to retrieve bundle" },
        },
      },
      put: {
        security: [{ bearerAuth: [] }],
        tags: ["Admin Bundle"],
        description: "Update bundle",
        operationId: "adminBundleUpdate",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            description: "Bundle ID",
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  price: { type: "number" },
                  original_price: { type: "number" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Bundle updated successfully" },
          400: { description: "Failed to update bundle" },
        },
      },
      delete: {
        security: [{ bearerAuth: [] }],
        tags: ["Admin Bundle"],
        description: "Delete bundle",
        operationId: "adminBundleDelete",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            description: "Bundle ID",
          },
        ],
        responses: {
          200: { description: "Bundle deleted successfully" },
          400: { description: "Failed to delete bundle" },
        },
      },
    },
    "/admin/bundle/enhanced/{id}": {
      put: {
        security: [{ bearerAuth: [] }],
        tags: ["Admin Bundle"],
        description: "Update enhanced bundle",
        operationId: "adminBundleUpdateEnhanced",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            description: "Bundle ID",
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  price: { type: "number" },
                  short_description: { type: "string" },
                  you_get: { type: "array", items: { type: "string" } },
                  chips: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Enhanced bundle updated successfully" },
          400: { description: "Failed to update bundle" },
        },
      },
    },
    "/admin/bundle/{id}/stats": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["Admin Bundle"],
        description: "Get bundle statistics",
        operationId: "adminBundleStats",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            description: "Bundle ID",
          },
        ],
        responses: {
          200: { description: "Bundle statistics retrieved" },
          400: { description: "Failed to retrieve statistics" },
        },
      },
    },
    "/admin/bundle/prebookings": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["Admin Bundle"],
        description: "Get all bundle prebookings (CSV Export) with utm field",
        operationId: "adminBundlePrebookings",
        parameters: [
          {
            in: "query",
            name: "bundle_id",
            required: false,
            schema: { type: "integer" },
            description: "Optional bundle ID to filter prebookings",
            example: 5,
          },
        ],
        responses: {
          200: {
            description: "Bundle prebookings exported as CSV with utm field",
            content: {
              "text/csv": {
                schema: {
                  type: "string",
                  example:
                    "Name,Phone,Email,Bundle Title,UTM,Date and Time\nJohn Doe,01712345678,john@example.com,Full Stack Bundle,courseDemo,11/14/2025 10:30:00 AM",
                },
              },
            },
          },
          400: { description: "Failed to retrieve prebookings" },
        },
      },
    },
    "/admin/bundle/prebookings/api": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["Admin Bundle"],
        description:
          "Get all bundle prebookings (JSON Response) with utm field",
        operationId: "adminBundlePrebookingsApi",
        parameters: [
          {
            in: "query",
            name: "bundle_id",
            required: false,
            schema: { type: "integer" },
            description: "Optional bundle ID to filter prebookings",
            example: 5,
          },
        ],
        responses: {
          200: {
            description:
              "Bundle prebookings retrieved successfully with utm field",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string", example: "John Doe" },
                          phone: { type: "string", example: "01712345678" },
                          email: {
                            type: "string",
                            example: "john@example.com",
                          },
                          utm: {
                            type: "string",
                            description: "UTM parameter value",
                            example: "courseDemo",
                          },
                          timestamp: { type: "integer", example: 1731600000 },
                          user_id: {
                            type: "integer",
                            nullable: true,
                            example: 123,
                          },
                          bundle_title: {
                            type: "string",
                            example: "Full Stack Development Bundle",
                          },
                          bundle_id: { type: "integer", example: 5 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: "Failed to retrieve prebookings" },
        },
      },
    },
    "/admin/bundle/prebooking/{prebookingId}/utm": {
      put: {
        security: [{ bearerAuth: [] }],
        tags: ["Admin Bundle"],
        description: "Update UTM field for a bundle prebooking record",
        operationId: "adminUpdateBundlePrebookingUtm",
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
                    example: "bootcampClass",
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
                        bundle_id: { type: "integer", example: 3 },
                        name: { type: "string", example: "John Doe" },
                        email: { type: "string", example: "john@example.com" },
                        phone: {
                          type: "string",
                          example: "+8801234567890",
                        },
                        utm: {
                          type: "string",
                          example: "bootcampClass",
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
        security: [{ bearerAuth: [] }],
        tags: ["Admin Bundle"],
        description: "Delete/clear UTM field for a bundle prebooking record",
        operationId: "adminDeleteBundlePrebookingUtm",
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
                        bundle_id: { type: "integer", example: 3 },
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

    "/admin/bundle/purchases/api": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["Admin Bundle"],
        description: "Get all bundle purchases (JSON Response)",
        operationId: "adminBundlePurchasesApi",
        parameters: [
          {
            in: "query",
            name: "bundle_id",
            required: false,
            schema: { type: "integer" },
            description: "Optional bundle ID to filter purchases",
            example: 5,
          },
        ],
        responses: {
          200: {
            description: "Bundle purchases retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string", example: "John Doe" },
                          phone: { type: "string", example: "01712345678" },
                          email: {
                            type: "string",
                            example: "john@example.com",
                          },
                          timestamp: { type: "integer", example: 1731600000 },
                          user_id: { type: "integer", example: 123 },
                          bundle_title: {
                            type: "string",
                            example: "Full Stack Development Bundle",
                          },
                          bundle_id: { type: "integer", example: 5 },
                          amount: { type: "number", example: 5000 },
                          transaction_id: {
                            type: "string",
                            example: "TRX123456789",
                          },
                          purchase_id: { type: "integer", example: 45 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: "Failed to retrieve purchases" },
          401: { description: "Unauthorized - Admin token required" },
        },
      },
    },

    "/admin/bundle/purchases/export": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["Admin Bundle"],
        description: "Export bundle purchases as CSV file. Supports filtering by bundle_id. Follows same pattern as course CSV export.",
        operationId: "adminBundlePurchasesExport",
        parameters: [
          {
            in: "query",
            name: "bundle_id",
            required: false,
            schema: { type: "integer" },
            description: "Optional bundle ID to filter purchases. If omitted, exports all bundle purchases.",
            example: 1,
          },
        ],
        responses: {
          200: {
            description: "Bundle purchases exported as CSV file",
            content: {
              "text/csv": {
                schema: {
                  type: "string",
                  example:
                    "Bundle Title,User Name,Phone,Email,Amount,Transaction ID,Purchase Date\nFull Stack Development Bundle,John Doe,01712345678,john@example.com,5000,TRX123456789,11/14/2025 10:30:00 AM\nFull Stack Development Bundle,Jane Smith,01787654321,jane@example.com,5000,TRX987654321,11/15/2025 2:15:00 PM",
                },
              },
            },
          },
          400: {
            description: "Failed to export purchases",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: false },
                    error: { type: "string", example: "Invalid bundle_id parameter. Must be a valid integer." }
                  }
                }
              }
            }
          },
          401: { description: "Unauthorized - Admin token required" },
        },
      },
    },

    // Payment APIs
    "/user/payment/initiate-for-bundle/{id}": {
      post: {
        security: [{ bearerAuth: [] }],
        tags: ["Payment"],
        description: "Initiate payment gateway for bundle purchase with optional coupon. Generates transaction ID (access code) and redirects to SSLCommerz payment page. **Coupon usage is recorded immediately** during this call (status: 'pending'), ensuring analytics work without waiting for IPN.",
        operationId: "userPaymentInitiateBundle",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "integer" },
            description: "Bundle ID to purchase",
            example: 5,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["user_id"],
                properties: {
                  user_id: {
                    type: "integer",
                    description: "User ID (also extracted from auth token)",
                    example: 123,
                  },
                  coupon_code: {
                    type: "string",
                    description: "Optional: Coupon code to apply discount. Coupon usage is recorded immediately (status: 'pending') during payment initiation.",
                    example: "BUNDLE50",
                  },
                  eventId: {
                    type: "number",
                    description: "Optional: Event ID for special pricing",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Payment gateway URL generated successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "string",
                      description: "SSLCommerz payment gateway URL",
                      example: "https://securepay.sslcommerz.com/gwprocess/v4/gw.php?Q=PAY&SESSIONKEY=...",
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "Bundle payment initiation failed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: false },
                    data: { type: "string", example: "error occurred" },
                  },
                },
              },
            },
          },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/user/payment/history": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["Payment"],
        description: "Get comprehensive payment history and enrollment details",
        operationId: "userPaymentHistory",
        responses: {
          200: {
            description: "Payment history retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        user_info: {
                          type: "object",
                          properties: {
                            name: { type: "string", example: "John Doe" },
                            phone: { type: "string", example: "01712345678" },
                          },
                        },
                        summary: {
                          type: "object",
                          properties: {
                            total_spent: { type: "number", example: 15000 },
                            total_courses_enrolled: {
                              type: "integer",
                              example: 5,
                            },
                            total_bundles_purchased: {
                              type: "integer",
                              example: 2,
                            },
                          },
                        },
                        individual_courses: {
                          type: "array",
                          items: { type: "object" },
                        },
                        bundle_purchases: {
                          type: "array",
                          items: { type: "object" },
                        },
                        all_transactions: {
                          type: "array",
                          items: { type: "object" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: "Bad request" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/user/payment/ipn": {
      post: {
        security: [],
        tags: ["Payment"],
        description: "SSLCommerz IPN (Instant Payment Notification) webhook endpoint. Receives payment confirmations from SSLCommerz. Validates transaction with SSLCommerz Order Validation API before processing. This endpoint is called by SSLCommerz, not by frontend.",
        operationId: "userPaymentIPN",
        requestBody: {
          required: true,
          content: {
            "application/x-www-form-urlencoded": {
              schema: {
                type: "object",
                properties: {
                  status: {
                    type: "string",
                    description: "Payment status (VALID, FAILED, CANCELLED, etc.)",
                    example: "VALID",
                  },
                  tran_id: {
                    type: "string",
                    description: "Transaction ID (our generated transaction_id/access code)",
                    example: "ABC123XYZ456789123",
                  },
                  val_id: {
                    type: "string",
                    description: "Validation ID from SSLCommerz",
                  },
                  amount: {
                    type: "string",
                    description: "Payment amount",
                    example: "5000.00",
                  },
                  value_a: {
                    type: "string",
                    description: "User ID",
                    example: "123",
                  },
                  value_b: {
                    type: "string",
                    description: "Item ID (Course ID or Bundle ID)",
                    example: "5",
                  },
                  value_c: {
                    type: "string",
                    description: "Amount",
                    example: "5000",
                  },
                  value_d: {
                    type: "string",
                    description: "Item type (COURSE or BUNDLE)",
                    example: "BUNDLE",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "IPN processed (always returns 200 to SSLCommerz)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    message: { type: "string", example: "Bundle purchase processed successfully" },
                    risk_level: { type: "integer", description: "Risk level (0=safe, 1=risky)", example: 0 },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/user/payment/audit-logs": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["Payment"],
        description: "Get payment audit logs for the authenticated user (user's own payments only). Tracks all payment attempts including IPN webhooks, validation results, and processing status. For admin access to all payment logs, use /admin/payment/audit-logs. Note: Multiple entries may exist for the same transaction ID (due to multiple IPN callbacks from SSLCommerz). Results are ordered by timestamp DESC (most recent first).",
        operationId: "userPaymentAuditLogs",
        parameters: [
          {
            in: "query",
            name: "user_id",
            schema: { type: "integer" },
            description: "Filter by user ID",
            example: 123,
          },
          {
            in: "query",
            name: "sslcommerz_tran_id",
            schema: { type: "string" },
            description: "Filter by SSLCommerz transaction ID",
            example: "ABC123XYZ456789123",
          },
          {
            in: "query",
            name: "internal_transaction_id",
            schema: { type: "string" },
            description: "Filter by internal transaction ID (access code)",
            example: "XYZ789ABC456789123",
          },
          {
            in: "query",
            name: "item_type",
            schema: { type: "string", enum: ["COURSE", "BUNDLE"] },
            description: "Filter by item type",
            example: "BUNDLE",
          },
          {
            in: "query",
            name: "status",
            schema: { type: "string" },
            description: "Filter by payment status (VALID, FAILED, CANCELLED, etc.)",
            example: "VALID",
          },
          {
            in: "query",
            name: "processing_status",
            schema: { type: "string", enum: ["SUCCESS", "FAILED", "ERROR", "PENDING", "VALIDATING", "RISKY", "ALREADY_PROCESSED"] },
            description: "Filter by processing status",
            example: "SUCCESS",
          },
          {
            in: "query",
            name: "limit",
            schema: { type: "integer", default: 100 },
            description: "Results limit",
            example: 100,
          },
          {
            in: "query",
            name: "offset",
            schema: { type: "integer", default: 0 },
            description: "Results offset",
            example: 0,
          },
        ],
        responses: {
          200: {
            description: "Audit logs retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "integer", example: 1 },
                          sslcommerz_tran_id: { type: "string", example: "ABC123XYZ456789123" },
                          internal_transaction_id: { type: "string", example: "XYZ789ABC456789123" },
                          user_id: { type: "integer", example: 123 },
                          item_id: { type: "integer", example: 5 },
                          item_type: { type: "string", example: "BUNDLE" },
                          amount: { type: "string", example: "5000.00" },
                          status: { type: "string", example: "VALID" },
                          processing_status: { type: "string", example: "SUCCESS" },
                          timestamp: { type: "integer", example: 1640995200 },
                          processed_at: { type: "integer", example: 1640995210 },
                          ipn_payload: { type: "object", description: "Full IPN payload from SSLCommerz" },
                          processing_result: { type: "object", description: "Processing result including validation data" },
                          error_message: { type: "string", nullable: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: "Bad request" },
          401: { description: "Unauthorized" },
        },
      },
      post: {
        security: [{ bearerAuth: [] }],
        tags: ["Payment"],
        description: "Get payment audit logs for the authenticated user (POST method with same functionality as GET). Returns user's own payments only. For admin access to all payment logs, use /admin/payment/audit-logs. Note: Multiple entries may exist for the same transaction ID (due to multiple IPN callbacks from SSLCommerz). Results are ordered by timestamp DESC (most recent first).",
        operationId: "userPaymentAuditLogsPost",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  user_id: { type: "integer" },
                  sslcommerz_tran_id: { type: "string" },
                  internal_transaction_id: { type: "string" },
                  item_type: { type: "string", enum: ["COURSE", "BUNDLE"] },
                  status: { type: "string" },
                  processing_status: { type: "string" },
                  limit: { type: "integer", default: 100 },
                  offset: { type: "integer", default: 0 },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Audit logs retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
          400: { description: "Bad request" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/user/payment/reconcile": {
      post: {
        security: [{ bearerAuth: [] }],
        tags: ["Payment"],
        deprecated: true,
        description: "⚠️ DEPRECATED: This endpoint has been removed for security reasons. Reconciliation is now admin-only. Use /admin/payment/reconcile instead. Manually reconcile a payment using SSLCommerz transaction ID. Useful for processing payments that were successful but not processed automatically.",
        operationId: "userPaymentReconcile",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["sslcommerz_tran_id", "reconciled_by"],
                properties: {
                  sslcommerz_tran_id: {
                    type: "string",
                    description: "SSLCommerz transaction ID from payment email",
                    example: "ABC123XYZ456789123",
                  },
                  reconciled_by: {
                    type: "integer",
                    description: "User ID of person reconciling (admin/user ID)",
                    example: 1,
                  },
                  notes: {
                    type: "string",
                    description: "Optional notes about the reconciliation",
                    example: "Manual reconciliation for test payment",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Payment reconciled successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        log_id: { type: "integer", example: 1 },
                        processing_result: { type: "object" },
                        reconciled: { type: "boolean", example: true },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "Bad request (missing transaction ID or payment not found)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: false },
                    error: { type: "string", example: "Payment log not found for this transaction ID" },
                  },
                },
              },
            },
          },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/user/payment/reconcile/{sslcommerz_tran_id}": {
      post: {
        security: [{ bearerAuth: [] }],
        tags: ["Payment"],
        deprecated: true,
        description: "⚠️ DEPRECATED: This endpoint has been removed for security reasons. Reconciliation is now admin-only. Use /admin/payment/reconcile/{sslcommerz_tran_id} instead. Manually reconcile a payment using SSLCommerz transaction ID (path parameter version)",
        operationId: "userPaymentReconcileByPath",
        parameters: [
          {
            in: "path",
            name: "sslcommerz_tran_id",
            required: true,
            schema: { type: "string" },
            description: "SSLCommerz transaction ID from payment email",
            example: "ABC123XYZ456789123",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["reconciled_by"],
                properties: {
                  reconciled_by: {
                    type: "integer",
                    description: "User ID of person reconciling (admin/user ID)",
                    example: 1,
                  },
                  notes: {
                    type: "string",
                    description: "Optional notes about the reconciliation",
                    example: "Manual reconciliation for test payment",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Payment reconciled successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        log_id: { type: "integer", example: 1 },
                        reconciled: { type: "boolean", example: true },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: "Bad request" },
          401: { description: "Unauthorized" },
        },
      },
    },

    // Admin Payment Audit Log APIs
    "/admin/payment/audit-logs": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["Payment"],
        description: "Get all payment audit logs (Admin only). Admins can view all payment attempts including IPN webhooks, validation results, and processing status. By default, returns ALL payment logs (not filtered by admin's user_id). Supports filtering and pagination. Note: Multiple entries may exist for the same transaction ID (due to multiple IPN callbacks from SSLCommerz). Results are ordered by timestamp DESC (most recent first).",
        operationId: "adminPaymentAuditLogs",
        parameters: [
          {
            in: "query",
            name: "user_id",
            schema: { type: "integer" },
            description: "Optional: Filter by specific user ID. If not provided, returns all payment logs. Note: Admin's own user_id from authentication is NOT used as a filter.",
            example: 123,
          },
          {
            in: "query",
            name: "sslcommerz_tran_id",
            schema: { type: "string" },
            description: "Filter by SSLCommerz transaction ID",
            example: "ABC123XYZ456789123",
          },
          {
            in: "query",
            name: "internal_transaction_id",
            schema: { type: "string" },
            description: "Filter by internal transaction ID (access code)",
            example: "XYZ789ABC456789123",
          },
          {
            in: "query",
            name: "item_type",
            schema: { type: "string", enum: ["COURSE", "BUNDLE"] },
            description: "Filter by item type",
            example: "BUNDLE",
          },
          {
            in: "query",
            name: "status",
            schema: { type: "string", enum: ["VALID", "FAILED", "CANCELLED", "PENDING", "ERROR"] },
            description: "Filter by payment status",
            example: "VALID",
          },
          {
            in: "query",
            name: "processing_status",
            schema: { type: "string", enum: ["SUCCESS", "FAILED", "ERROR", "PENDING"] },
            description: "Filter by processing status",
            example: "FAILED",
          },
          {
            in: "query",
            name: "limit",
            schema: { type: "integer", default: 100, maximum: 500 },
            description: "Results limit (max 500)",
            example: 50,
          },
          {
            in: "query",
            name: "offset",
            schema: { type: "integer", default: 0 },
            description: "Results offset for pagination",
            example: 0,
          },
        ],
        responses: {
          200: {
            description: "Audit logs retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "integer", example: 1 },
                          sslcommerz_tran_id: { type: "string", example: "ABC123XYZ456789123" },
                          internal_transaction_id: { type: "string", example: "XYZ789ABC456789123" },
                          user_id: { type: "integer", example: 123 },
                          user_name: { type: "string", nullable: true, description: "User's full name", example: "John Doe" },
                          user_phone: { type: "string", nullable: true, description: "User's phone number", example: "+8801712345678" },
                          user_email: { type: "string", nullable: true, description: "User's email address", example: "john.doe@example.com" },
                          item_id: { type: "integer", example: 5 },
                          item_type: { type: "string", enum: ["COURSE", "BUNDLE"], example: "BUNDLE" },
                          item_name: { type: "string", nullable: true, description: "Course or Bundle title/name", example: "Complete Web Development Bootcamp" },
                          amount: { type: "string", example: "5000.00" },
                          status: { type: "string", enum: ["VALID", "FAILED", "CANCELLED", "PENDING", "ERROR"], example: "VALID" },
                          processing_status: { type: "string", enum: ["SUCCESS", "FAILED", "ERROR", "PENDING"], example: "FAILED" },
                          ipn_payload: { type: "object", description: "Full IPN payload from SSLCommerz" },
                          error_message: { type: "string", nullable: true, example: null },
                          processing_result: { type: "object", nullable: true, description: "Processing result including enrollment/purchase data" },
                          timestamp: { type: "integer", example: 1640995200 },
                          processed_at: { type: "integer", nullable: true, example: 1640995210 },
                          retry_count: { type: "integer", example: 0 },
                          is_manually_reconciled: { type: "boolean", example: false },
                          reconciled_by: { type: "integer", nullable: true, example: null },
                          reconciled_at: { type: "integer", nullable: true, example: null },
                          notes: { type: "string", nullable: true, example: null },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: "Bad request" },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden - Admin access required" },
        },
      },
      post: {
        security: [{ bearerAuth: [] }],
        tags: ["Payment"],
        description: "Get all payment audit logs (POST method with same functionality as GET). Admin only. By default, returns ALL payment logs. Note: user_id in request body is optional and only used if explicitly provided - admin's authenticated user_id is NOT used as a filter.",
        operationId: "adminPaymentAuditLogsPost",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  user_id: {
                    type: "integer",
                    description: "Optional: Filter by specific user ID. If not provided, returns all payment logs."
                  },
                  sslcommerz_tran_id: { type: "string" },
                  internal_transaction_id: { type: "string" },
                  item_type: { type: "string", enum: ["COURSE", "BUNDLE"] },
                  status: { type: "string", enum: ["VALID", "FAILED", "CANCELLED", "PENDING", "ERROR"] },
                  processing_status: { type: "string", enum: ["SUCCESS", "FAILED", "ERROR", "PENDING"] },
                  limit: { type: "integer", default: 100, maximum: 500 },
                  offset: { type: "integer", default: 0 },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Audit logs retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "integer" },
                          sslcommerz_tran_id: { type: "string" },
                          internal_transaction_id: { type: "string" },
                          user_id: { type: "integer" },
                          user_name: { type: "string", nullable: true, description: "User's full name" },
                          user_phone: { type: "string", nullable: true, description: "User's phone number" },
                          user_email: { type: "string", nullable: true, description: "User's email address" },
                          item_id: { type: "integer" },
                          item_type: { type: "string" },
                          item_name: { type: "string", nullable: true, description: "Course or Bundle title/name" },
                          amount: { type: "string" },
                          status: { type: "string" },
                          processing_status: { type: "string" },
                          ipn_payload: { type: "object" },
                          error_message: { type: "string", nullable: true },
                          processing_result: { type: "object", nullable: true },
                          timestamp: { type: "integer" },
                          processed_at: { type: "integer", nullable: true },
                          retry_count: { type: "integer" },
                          is_manually_reconciled: { type: "boolean" },
                          reconciled_by: { type: "integer", nullable: true },
                          reconciled_at: { type: "integer", nullable: true },
                          notes: { type: "string", nullable: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: "Bad request" },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden - Admin access required" },
        },
      },
    },
    "/admin/payment/audit-logs/export": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["Payment"],
        description: "Export all payment audit logs matching the filters (Admin only). Returns ALL matching records without pagination. This endpoint is designed for CSV export functionality. Same filters as /admin/payment/audit-logs but ignores limit and offset parameters.",
        operationId: "adminPaymentAuditLogsExport",
        parameters: [
          {
            in: "query",
            name: "user_id",
            schema: { type: "integer" },
            description: "Optional: Filter by specific user ID. If not provided, returns all payment logs. Note: Admin's own user_id from authentication is NOT used as a filter.",
            example: 123,
          },
          {
            in: "query",
            name: "sslcommerz_tran_id",
            schema: { type: "string" },
            description: "Filter by SSLCommerz transaction ID",
            example: "ABC123XYZ456789123",
          },
          {
            in: "query",
            name: "internal_transaction_id",
            schema: { type: "string" },
            description: "Filter by internal transaction ID (access code)",
            example: "XYZ789ABC456789123",
          },
          {
            in: "query",
            name: "item_type",
            schema: { type: "string", enum: ["COURSE", "BUNDLE"] },
            description: "Filter by item type",
            example: "BUNDLE",
          },
          {
            in: "query",
            name: "status",
            schema: { type: "string", enum: ["VALID", "FAILED", "CANCELLED", "PENDING", "ERROR"] },
            description: "Filter by payment status",
            example: "VALID",
          },
          {
            in: "query",
            name: "processing_status",
            schema: { type: "string", enum: ["SUCCESS", "FAILED", "ERROR", "PENDING"] },
            description: "Filter by processing status",
            example: "FAILED",
          },
        ],
        responses: {
          200: {
            description: "All matching audit logs retrieved successfully (no pagination)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "integer", example: 1 },
                          sslcommerz_tran_id: { type: "string", example: "ABC123XYZ456789123" },
                          internal_transaction_id: { type: "string", example: "XYZ789ABC456789123" },
                          user_id: { type: "integer", example: 123 },
                          user_name: { type: "string", nullable: true, description: "User's full name", example: "John Doe" },
                          user_phone: { type: "string", nullable: true, description: "User's phone number", example: "+8801712345678" },
                          user_email: { type: "string", nullable: true, description: "User's email address", example: "john.doe@example.com" },
                          item_id: { type: "integer", example: 5 },
                          item_type: { type: "string", enum: ["COURSE", "BUNDLE"], example: "BUNDLE" },
                          item_name: { type: "string", nullable: true, description: "Course or Bundle title/name", example: "Complete Web Development Bootcamp" },
                          amount: { type: "string", example: "5000.00" },
                          status: { type: "string", enum: ["VALID", "FAILED", "CANCELLED", "PENDING", "ERROR"], example: "VALID" },
                          processing_status: { type: "string", enum: ["SUCCESS", "FAILED", "ERROR", "PENDING"], example: "FAILED" },
                          ipn_payload: { type: "object", description: "Full IPN payload from SSLCommerz" },
                          error_message: { type: "string", nullable: true, example: null },
                          processing_result: { type: "object", nullable: true, description: "Processing result including enrollment/purchase data" },
                          timestamp: { type: "integer", example: 1640995200 },
                          processed_at: { type: "integer", nullable: true, example: 1640995210 },
                          retry_count: { type: "integer", example: 0 },
                          is_manually_reconciled: { type: "boolean", example: false },
                          reconciled_by: { type: "integer", nullable: true, example: null },
                          reconciled_at: { type: "integer", nullable: true, example: null },
                          notes: { type: "string", nullable: true, example: null },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: "Bad request" },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden - Admin access required" },
        },
      },
    },
    "/admin/payment/reconcile": {
      post: {
        security: [{ bearerAuth: [] }],
        tags: ["Payment"],
        description: "Manually reconcile a payment (Admin only). Processes payments that were successful but failed to process automatically. Enrolls user in course/bundle and updates payment audit log.",
        operationId: "adminPaymentReconcile",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["sslcommerz_tran_id"],
                properties: {
                  sslcommerz_tran_id: {
                    type: "string",
                    description: "SSLCommerz transaction ID from payment email",
                    example: "ABC123XYZ456789123",
                  },
                  notes: {
                    type: "string",
                    description: "Optional notes about the reconciliation",
                    example: "Manual reconciliation for failed payment",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Payment reconciled successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        log_id: { type: "integer", example: 1 },
                        reconciled: { type: "boolean", example: true },
                        enrollment_attempted: { 
                          type: "boolean", 
                          example: true,
                          description: "Whether enrollment was attempted during reconciliation"
                        },
                        enrollment_succeeded: { 
                          type: "boolean", 
                          example: true,
                          description: "Whether enrollment succeeded (true) or had issues (false)"
                        },
                        processing_status: {
                          type: "string",
                          enum: ["SUCCESS", "PARTIAL", "RECONCILED", "FAILED", "ERROR"],
                          example: "SUCCESS",
                          description: "Final processing status after reconciliation"
                        },
                        processing_result: {
                          type: "object",
                          description: "Processing result with enrollment/purchase data",
                          properties: {
                            success: { type: "boolean", example: true },
                            data: {
                              type: "object",
                              properties: {
                                bundle_id: { type: "integer", example: 5 },
                                user_id: { type: "integer", example: 123 },
                                transaction_id: { type: "string", example: "XYZ789ABC123456" },
                              },
                            },
                            error: { type: "string", nullable: true, example: null },
                            message: { type: "string", nullable: true, example: "Already enrolled" },
                          },
                        },
                        message: { 
                          type: "string", 
                          example: "Payment reconciled and user enrolled successfully",
                          description: "Human-readable message about reconciliation result"
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "Bad request (missing transaction ID or payment not found)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: false },
                    error: { type: "string", example: "Payment log not found for this transaction ID" },
                  },
                },
              },
            },
          },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden - Admin access required" },
        },
      },
    },
    "/admin/payment/reconcile/{sslcommerz_tran_id}": {
      post: {
        security: [{ bearerAuth: [] }],
        tags: ["Payment"],
        description: "Manually reconcile a payment using SSLCommerz transaction ID in path (Admin only). Alternative endpoint with transaction ID as path parameter.",
        operationId: "adminPaymentReconcileByPath",
        parameters: [
          {
            in: "path",
            name: "sslcommerz_tran_id",
            required: true,
            schema: { type: "string" },
            description: "SSLCommerz transaction ID from payment email",
            example: "ABC123XYZ456789123",
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  notes: {
                    type: "string",
                    description: "Optional notes about the reconciliation",
                    example: "Manual reconciliation for failed payment",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Payment reconciled successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        log_id: { type: "integer", example: 1 },
                        reconciled: { type: "boolean", example: true },
                        enrollment_attempted: { 
                          type: "boolean", 
                          example: true,
                          description: "Whether enrollment was attempted during reconciliation"
                        },
                        enrollment_succeeded: { 
                          type: "boolean", 
                          example: true,
                          description: "Whether enrollment succeeded (true) or had issues (false)"
                        },
                        processing_status: {
                          type: "string",
                          enum: ["SUCCESS", "PARTIAL", "RECONCILED", "FAILED", "ERROR"],
                          example: "SUCCESS",
                          description: "Final processing status after reconciliation"
                        },
                        processing_result: { 
                          type: "object",
                          description: "Processing result with enrollment/purchase data"
                        },
                        message: { 
                          type: "string", 
                          example: "Payment reconciled and user enrolled successfully",
                          description: "Human-readable message about reconciliation result"
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "Bad request (payment not found)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: false },
                    error: { type: "string", example: "Payment log not found for this transaction ID" },
                  },
                },
              },
            },
          },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden - Admin access required" },
        },
      },
    },

    // Notification APIs
    "/user/notification/list": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["Notification"],
        description: "Get user notifications",
        operationId: "userNotificationList",
        responses: {
          200: { description: "Notifications retrieved successfully" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/user/notification/count": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["Notification"],
        description: "Get unread notification count",
        operationId: "userNotificationCount",
        responses: {
          200: { description: "Notification count retrieved" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/user/notification/markAllAsRead": {
      post: {
        security: [{ bearerAuth: [] }],
        tags: ["Notification"],
        description: "Mark all notifications as read",
        operationId: "userNotificationMarkAllRead",
        responses: {
          200: { description: "All notifications marked as read" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/user/notification/markAsRead/{id}": {
      post: {
        security: [{ bearerAuth: [] }],
        tags: ["Notification"],
        description: "Mark specific notification as read",
        operationId: "userNotificationMarkRead",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            description: "Notification ID",
          },
        ],
        responses: {
          200: { description: "Notification marked as read" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/user/notification/bellIconClicked": {
      post: {
        security: [{ bearerAuth: [] }],
        tags: ["Notification"],
        description: "Handle bell icon click",
        operationId: "userNotificationBellClick",
        responses: {
          200: { description: "Bell icon click handled" },
          401: { description: "Unauthorized" },
        },
      },
    },

    // Announcement APIs
    "/admin/announcement/list": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["Admin Announcement"],
        description: "Get all announcements",
        operationId: "adminAnnouncementList",
        responses: {
          200: { description: "Announcements retrieved successfully" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/admin/announcement/list/{courseId}": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["Admin Announcement"],
        description: "Get course-specific announcements",
        operationId: "adminAnnouncementListCourse",
        parameters: [
          {
            in: "path",
            name: "courseId",
            required: true,
            description: "Course ID",
          },
        ],
        responses: {
          200: { description: "Course announcements retrieved" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/admin/announcement/create/{courseId}": {
      post: {
        security: [{ bearerAuth: [] }],
        tags: ["Admin Announcement"],
        description: "Create new announcement",
        operationId: "adminAnnouncementCreate",
        parameters: [
          {
            in: "path",
            name: "courseId",
            required: true,
            description: "Course ID",
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string", example: "New Module Released" },
                  content: {
                    type: "string",
                    example: "We've released a new module",
                  },
                  priority: {
                    type: "string",
                    enum: ["low", "medium", "high"],
                    example: "medium",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Announcement created successfully" },
          400: { description: "Invalid request data" },
        },
      },
    },
    "/admin/announcement/update/{id}": {
      put: {
        security: [{ bearerAuth: [] }],
        tags: ["Admin Announcement"],
        description: "Update announcement",
        operationId: "adminAnnouncementUpdate",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            description: "Announcement ID",
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  content: { type: "string" },
                  priority: { type: "string", enum: ["low", "medium", "high"] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Announcement updated successfully" },
          404: { description: "Announcement not found" },
        },
      },
    },
    "/admin/announcement/delete/{id}": {
      delete: {
        security: [{ bearerAuth: [] }],
        tags: ["Admin Announcement"],
        description: "Delete announcement",
        operationId: "adminAnnouncementDelete",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            description: "Announcement ID",
          },
        ],
        responses: {
          200: { description: "Announcement deleted successfully" },
          404: { description: "Announcement not found" },
        },
      },
    },
    "/admin/announcement/send/{id}": {
      post: {
        security: [{ bearerAuth: [] }],
        tags: ["Admin Announcement"],
        description: "Send announcement to students",
        operationId: "adminAnnouncementSend",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            description: "Announcement ID",
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  send_email: { type: "boolean", example: true },
                  send_push: { type: "boolean", example: true },
                  send_sms: { type: "boolean", example: false },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Announcement sent successfully" },
          400: { description: "Cannot send announcement" },
        },
      },
    },

    // User Routine API
    "/user/course/{courseId}/routine": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["Course Management"],
        description: "Get current week's routine banner for a course (user-facing). Falls back to most recent routine if no routine found for current week.",
        operationId: "userCourseGetRoutine",
        parameters: [
          {
            in: "path",
            name: "courseId",
            required: true,
            schema: { type: "integer" },
            description: "Course ID",
            example: 11,
          },
        ],
        responses: {
          200: {
            description: "Routine retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      nullable: true,
                      properties: {
                        routine_image_url: {
                          type: "string",
                          example: "https://s3.amazonaws.com/bucket/routine.png",
                        },
                        week_number: { type: "integer", example: 1 },
                        week_start_date: {
                          type: "string",
                          format: "date",
                          example: "2025-12-01",
                        },
                        week_end_date: {
                          type: "string",
                          format: "date",
                          example: "2025-12-07",
                        },
                        course_title: {
                          type: "string",
                          example: "React Fundamentals",
                        },
                        is_current_week: {
                          type: "boolean",
                          description: "True if routine is for current week, false if fallback to most recent",
                          example: true,
                        },
                      },
                    },
                    message: {
                      type: "string",
                      example: "Showing most recent routine (no routine for current week)",
                    },
                  },
                },
              },
            },
          },
          400: { description: "Bad request" },
        },
      },
    },

    // User Announcement APIs
    "/user/course/{courseId}/announcements": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["User Announcement"],
        description: "Get course announcements for enrolled students",
        operationId: "userCourseAnnouncements",
        parameters: [
          {
            in: "path",
            name: "courseId",
            required: true,
            schema: { type: "integer" },
            description: "Course ID",
            example: 11,
          },
          {
            in: "query",
            name: "limit",
            required: false,
            schema: { type: "integer", default: 10 },
            description: "Number of announcements to return",
            example: 10,
          },
          {
            in: "query",
            name: "offset",
            required: false,
            schema: { type: "integer", default: 0 },
            description: "Offset for pagination",
            example: 0,
          },
        ],
        responses: {
          200: {
            description: "Announcements retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        announcements: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              id: { type: "integer", example: 1 },
                              title: {
                                type: "string",
                                example: "Assignment 2 deadline extended",
                              },
                              content: {
                                type: "string",
                                example:
                                  "Due to popular request, Assignment 2 deadline has been extended to December 5th",
                              },
                              created_date: {
                                type: "string",
                                format: "date-time",
                                example: "2025-11-23T10:00:00.000Z",
                              },
                            },
                          },
                        },
                        total_count: { type: "integer", example: 15 },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: "Invalid request" },
          401: { description: "Unauthorized" },
        },
      },
    },

    // Analytics APIs
    "/admin/analytics/user-engagement": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["Analytics"],
        description: "Get user engagement metrics",
        operationId: "adminAnalyticsUserEngagement",
        responses: {
          200: { description: "User engagement metrics retrieved" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/admin/analytics/user-growth": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["Analytics"],
        description: "Get user growth metrics",
        operationId: "adminAnalyticsUserGrowth",
        parameters: [
          {
            in: "query",
            name: "period",
            schema: {
              type: "string",
              enum: ["month", "year", "all"],
              default: "year",
            },
            description: "Time period for statistics",
          },
        ],
        responses: {
          200: { description: "User growth metrics retrieved" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/admin/analytics/course-engagement": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["Analytics"],
        description: "Get course engagement metrics",
        operationId: "adminAnalyticsCourseEngagement",
        parameters: [
          {
            in: "query",
            name: "limit",
            schema: { type: "integer", default: 10, minimum: 1, maximum: 100 },
            description: "Number of courses to return",
          },
        ],
        responses: {
          200: { description: "Course engagement metrics retrieved" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/admin/analytics/module-completion": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["Analytics"],
        description: "Get module completion rates",
        operationId: "adminAnalyticsModuleCompletion",
        parameters: [
          {
            in: "query",
            name: "limit",
            schema: { type: "integer", default: 20, minimum: 1, maximum: 100 },
            description: "Number of modules to return",
          },
        ],
        responses: {
          200: { description: "Module completion rates retrieved" },
          401: { description: "Unauthorized" },
        },
      },
    },
    // Revenue APIs
    "/admin/revenue/detailed": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["Revenue"],
        description: "Get overall revenue statistics",
        operationId: "adminRevenueDetailed",
        responses: {
          200: { description: "Revenue statistics retrieved" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/admin/revenue/detailed/{id}": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["Revenue"],
        description: "Get course-specific revenue statistics",
        operationId: "adminRevenueCourseDetailed",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            description: "Course ID",
          },
        ],
        responses: {
          200: { description: "Course revenue statistics retrieved" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/admin/revenue/timeframe": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["Revenue"],
        description: "Get revenue over time",
        operationId: "adminRevenueTimeframe",
        parameters: [
          {
            in: "query",
            name: "period",
            schema: {
              type: "string",
              enum: ["week", "month", "year", "all"],
              default: "year",
            },
            description: "Time period for statistics",
          },
        ],
        responses: {
          200: { description: "Revenue statistics retrieved" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/admin/revenue/top": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["Revenue"],
        description: "Get top revenue generators",
        operationId: "adminRevenueTop",
        parameters: [
          {
            in: "query",
            name: "limit",
            schema: { type: "integer", default: 10, minimum: 1, maximum: 100 },
            description: "Number of top items to return",
          },
        ],
        responses: {
          200: { description: "Top revenue generators retrieved" },
          401: { description: "Unauthorized" },
        },
      },
    },
    ...streak.paths,

    // Checkout Modal Profile APIs
    "/user/profile": {
      get: {
        security: [{ bearerAuth: [] }],
        tags: ["User Profile"],
        description: "Get current user's profile for checkout modal.",
        operationId: "getUserProfileForCheckout",
        parameters: [],
        responses: {
          200: {
            description: "User profile retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        id: { type: "integer", example: 123 },
                        name: { type: "string", example: "John Doe" },
                        email: { type: "string", nullable: true, example: "john@example.com" },
                        phone: { type: "string", nullable: true, example: "01712345678" },
                        login: { type: "string", example: "john@example.com" },
                        profile: {
                          type: "object",
                          properties: {
                            email: { type: "string", nullable: true, example: "john@example.com" },
                            phone: { type: "string", nullable: true, example: "01712345678" },
                            facebookId: { type: "string", nullable: true, example: "john.fb" },
                            address: { type: "string", nullable: true, example: "Dhaka, Bangladesh" },
                            schoolCollege: { type: "string", nullable: true, example: "Dhaka College" },
                            group: { type: "string", nullable: true, enum: ["Science", "Arts", "Commerce"], example: "Science" },
                            guardianName: { type: "string", nullable: true, example: "Abdul Karim" },
                            guardianMobile: { type: "string", nullable: true, example: "01712345678" },
                            relationWithGuardian: { type: "string", nullable: true, example: "Father" },
                            gender: { type: "string", nullable: true, example: "Male" },
                            classLevel: { type: "string", nullable: true, enum: ["JSC", "SSC", "HSC"], example: "HSC" },
                            version: { type: "string", nullable: true, enum: ["Bangla", "English"], example: "Bangla" },
                            department: { type: "string", nullable: true, example: "CSE" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: "Unauthorized - Missing or invalid token" },
          404: { description: "User not found" },
          500: { description: "Internal server error" },
        },
      },
      put: {
        security: [{ bearerAuth: [] }],
        tags: ["User Profile"],
        description: "Update current user's profile for checkout modal. Email remains the canonical login identifier.",
        operationId: "updateUserProfileForCheckout",
        parameters: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: {
                    type: "string",
                    description: "User's full name",
                    example: "John Doe",
                  },
                  email: {
                    type: "string",
                    nullable: true,
                    description: "Email address. This field is read-only for login identity in this flow.",
                    example: "john@example.com",
                  },
                  phone: {
                    type: "string",
                    nullable: true,
                    description: "Phone number (only if not already set and user registered with email). Must be 11 digits starting with 01.",
                    example: "01712345678",
                  },
                  facebookId: {
                    type: "string",
                    nullable: true,
                    description: "Facebook identifier or profile link handle.",
                    example: "john.fb",
                  },
                  address: {
                    type: "string",
                    nullable: true,
                    description: "Home address.",
                    example: "Dhaka, Bangladesh",
                  },
                  schoolCollege: {
                    type: "string",
                    nullable: true,
                    description: "School or college name.",
                    example: "Dhaka College",
                  },
                  group: {
                    type: "string",
                    nullable: true,
                    enum: ["Science", "Arts", "Commerce"],
                    description: "Academic group.",
                    example: "Science",
                  },
                  guardianName: {
                    type: "string",
                    nullable: true,
                    description: "Guardian's full name.",
                    example: "Abdul Karim",
                  },
                  guardianMobile: {
                    type: "string",
                    nullable: true,
                    description: "Guardian's mobile number.",
                    example: "01712345678",
                  },
                  relationWithGuardian: {
                    type: "string",
                    nullable: true,
                    description: "Relationship with guardian.",
                    example: "Father",
                  },
                  gender: {
                    type: "string",
                    nullable: true,
                    description: "Gender.",
                    example: "Male",
                  },
                  classLevel: {
                    type: "string",
                    nullable: true,
                    enum: ["JSC", "SSC", "HSC"],
                    description: "Class level.",
                    example: "HSC",
                  },
                  version: {
                    type: "string",
                    nullable: true,
                    enum: ["Bangla", "English"],
                    description: "Curriculum version.",
                    example: "Bangla",
                  },
                  department: {
                    type: "string",
                    nullable: true,
                    description: "Department name",
                    example: "CSE",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Profile updated successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        id: { type: "integer", example: 123 },
                        name: { type: "string", example: "John Doe" },
                        email: { type: "string", nullable: true, example: "john@example.com" },
                        phone: { type: "string", nullable: true, example: "01712345678" },
                        profile: {
                          type: "object",
                          properties: {
                            email: { type: "string", nullable: true, example: "john@example.com" },
                            phone: { type: "string", nullable: true, example: "01712345678" },
                            facebookId: { type: "string", nullable: true, example: "john.fb" },
                            address: { type: "string", nullable: true, example: "Dhaka, Bangladesh" },
                            schoolCollege: { type: "string", nullable: true, example: "Dhaka College" },
                            group: { type: "string", nullable: true, enum: ["Science", "Arts", "Commerce"], example: "Science" },
                            guardianName: { type: "string", nullable: true, example: "Abdul Karim" },
                            guardianMobile: { type: "string", nullable: true, example: "01712345678" },
                            relationWithGuardian: { type: "string", nullable: true, example: "Father" },
                            gender: { type: "string", nullable: true, example: "Male" },
                            classLevel: { type: "string", nullable: true, enum: ["JSC", "SSC", "HSC"], example: "HSC" },
                            version: { type: "string", nullable: true, enum: ["Bangla", "English"], example: "Bangla" },
                            department: { type: "string", nullable: true, example: "CSE" },
                          },
                        },
                      },
                    },
                    message: { type: "string", example: "Profile updated successfully" },
                  },
                },
              },
            },
          },
          400: {
            description: "Bad Request - Validation error or business rule violation",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: false },
                    error: { type: "string", example: "Cannot update email. You registered with email, so email cannot be changed." },
                  },
                },
              },
            },
          },
          401: { description: "Unauthorized - Missing or invalid token" },
          404: { description: "User not found" },
          500: { description: "Internal server error" },
        },
      },
    },
  },
};
