const { CourseService } = require("../service/managerial/course");
const { ChapterService } = require("../service/managerial/chapter");
const { ModuleService } = require("../service/managerial/module");
const { TeacherService } = require("../service/managerial/teacher");
const { RoutineService } = require("../service/managerial/routine");

var courseService = new CourseService();
var chapterService = new ChapterService();
var moduleService = new ModuleService();
var teacherService = new TeacherService();
var routineService = new RoutineService();

// Per-field documentation overlaid on the auto-generated course schema. Keys not
// listed here fall back to just { type } from the service cols/types arrays.
const courseFieldDocs = {
  slug: { description: "Pretty route id, unique. Distinct from the legacy external `url`.", example: "discrete-math" },
  total_seats: { description: "Seat cap; pairs with `enrolled`.", example: 500 },
  tags: { description: "Array of tag strings.", example: ["CSE", "Math"] },
  course_outline: { description: "Google Drive / any URL to the course outline.", example: "https://drive.google.com/file/d/.../view" },
  chips: {
    description:
      "Redesigned presentation blob (clean, no label/value wrappers). Shape: " +
      "{ bundle_id:int|null, thumbnails:{ course_thumbnail_16_9, trailer_video_thumb_16_9, facebook_community_thumb_16_9 }, " +
      "socials:{ facebook_community, facebook_page, facebook_private_group, telegram_group, whatsapp, messenger, phone, email }, " +
      "sections:[{ label, value }], enrollment_details:{ prebooking_end_date, enrollment_end_date, course_start_date } (unix seconds, all optional) }. " +
      "facebook_private_group & telegram_group are enrolled-only at the API layer.",
    example: {
      bundle_id: 1,
      thumbnails: { course_thumbnail_16_9: "https://.../DM-169.jpg", trailer_video_thumb_16_9: "", facebook_community_thumb_16_9: "" },
      socials: { facebook_community: "https://www.facebook.com/groups/mathprocommunity", facebook_page: "https://www.facebook.com/mathprobd", facebook_private_group: "https://www.facebook.com/groups/...", telegram_group: "https://t.me/+abcdEFGhij", whatsapp: "https://wa.me/8801768976036", phone: "tel:+8801768976036", email: "mailto:support@mathpro.com" },
      sections: [ { label: "চ্যাপ্টার সংখ্যা", value: "17 টি" }, { label: "ভিডিও ডিউরেশন", value: "100+ ঘণ্টা" } ],
      enrollment_details: { prebooking_end_date: 1732473599, enrollment_end_date: 1738367999, course_start_date: 1734480000 },
    },
  },
};

const getCourseProperties = () => {
  var properties = {};
  courseService.cols.map((c, i) => {
    properties[c] = {
      type: courseService.types[i],
      ...(courseFieldDocs[c] || {}),
    };
  });
  return properties;
};

const getChapterProperties = () => {
  var properties = {};
  chapterService.cols.map((c, i) => {
    properties[c] = {
      type: chapterService.types[i],
    };
  });
  return properties;
};

const getModuleProperties = () => {
  var properties = {};
  moduleService.cols.map((c, i) => {
    properties[c] = {
      type: moduleService.types[i],
    };
  });
  return properties;
};

const getTeacherProperties = () => {
  var properties = {};
  teacherService.cols.map((c, i) => {
    properties[c] = {
      type: teacherService.types[i],
    };
  });
  return properties;
};

const getRoutineProperties = () => {
  var properties = {};
  routineService.cols.map((c, i) => {
    properties[c] = {
      type: routineService.types[i],
    };
  });
  return properties;
};

module.exports = {
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        in: "header",
        name: "Authorization",
        description: "Bearer token to access these api endpoints",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      SeriesPoint: {
        type: "object",
        description: "A single point in a metric time-series.",
        properties: {
          period: { type: "string", example: "2026-01-15" },
          value: { type: "number", example: 12000 },
        },
      },
      managerial_reg: {
        hidden: true,
        type: "object",
        properties: {
          login: {
            type: "string",
            description: "unique login string for registration",
            example: "login_string",
          },
          password: {
            type: "string",
            description: "password used for registration",
            example: "password_string",
          },
          name: {
            type: "string",
            description: "name used for registration",
            example: "name_string",
          },
          type: {
            type: "integer",
            description: "admin=1,moderator=2",
            example: 1,
          },
        },
      },
      user_reg: {
        hidden: true,
        type: "object",
        properties: {
          login: {
            type: "string",
            description: "unique login string for registration",
            example: "login_string",
          },
          password: {
            type: "string",
            description: "password used for registration",
            example: "password_string",
          },
          name: {
            type: "string",
            description: "name used for registration",
            example: "name_string",
          },
          type: {
            type: "integer",
            description: "admin=1,moderator=2",
            example: 1,
          },
          profile: {
            type: "object",
            description: "profile data",
            example: {
              facebookId: "john.fb",
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
      managerial_login: {
        hidden: true,
        type: "object",
        properties: {
          login: {
            type: "string",
            description: "login string used while registration",
            example: "login_string",
          },
          password: {
            type: "string",
            description: "password used while registration",
            example: "password_string",
          },
        },
      },
      course: {
        hidden: true,
        type: "object",
        properties: {
          ...getCourseProperties(),
        },
      },
      publicFaq: {
        type: "object",
        properties: {
          question: {
            type: "string",
            example: "কোর্সের পেমেন্ট কিভাবে করব?",
          },
          answer: {
            type: "string",
            example: "বিকাশ, নগদ, রকেট এবং যেকোনো ব্যাংক কার্ড দিয়ে পেমেন্ট করতে পারবে।",
          },
          category: {
            type: "string",
            nullable: true,
            example: "payment",
          },
          sort_order: {
            type: "integer",
            example: 4,
          },
          is_active: {
            type: "boolean",
            example: true,
          },
        },
      },
      publicTestimonial: {
        type: "object",
        properties: {
          feedback_id: {
            type: "string",
            example: "08dd7c2c-c7ba-4d71-a1a7-52fc5d673ec1",
          },
          sort_order: {
            type: "integer",
            example: 1,
          },
          is_active: {
            type: "boolean",
            example: true,
          },
        },
      },
      chapter: {
        hidden: true,
        type: "object",
        properties: {
          ...getChapterProperties(),
        },
      },
      admin: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "Admin ID",
            example: 1
          },
          name: {
            type: "string",
            description: "Admin's full name",
            example: "John Doe"
          },
          type: {
            type: "integer",
            enum: [1, 2],
            description: "1 for Admin, 2 for Moderator",
            example: 1
          },
          login: {
            type: "string",
            description: "Login identifier (email)",
            example: "admin@example.com"
          },
          email: {
            type: "string",
            format: "email",
            description: "Email address",
            example: "admin@example.com"
          },
          phone: {
            type: "string",
            nullable: true,
            description: "Phone number (11 digits)",
            example: "01712345678"
          },
          profile: {
            type: "object",
            description: "Additional profile data (JSON object)",
            example: {
              facebookId: "john.fb",
              address: "Dhaka, Bangladesh",
              schoolCollege: "Dhaka College",
              group: "Science",
              guardianName: "Abdul Karim",
              guardianMobile: "01712345678",
              relationWithGuardian: "Father",
              gender: "Male",
              classLevel: "HSC",
              version: "Bangla"
            }
          },
          created_at: {
            type: "string",
            format: "date-time",
            description: "Account creation timestamp",
            example: "2024-01-01T00:00:00.000Z"
          },
          updated_at: {
            type: "string",
            format: "date-time",
            description: "Last update timestamp",
            example: "2024-01-01T00:00:00.000Z"
          }
        }
      },
      module: {
        hidden: true,
        type: "object",
        properties: {
          ...getModuleProperties(),
        },
      },
      teacher: {
        hidden: true,
        type: "object",
        properties: {
          ...getTeacherProperties(),
          selectedCourse: {
            type: "array",
            description: "arrays of course ids",
            example: [1, 2],
          },
        },
      },
      bundle: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Bundle title",
            example: "Full Stack Development Bundle",
          },
          price: {
            type: "number",
            description: "Bundle price",
            example: 5000,
          },
          original_price: {
            type: "number",
            description: "Original price before discount",
            example: 6000,
          },
          url: {
            type: "string",
            description: "Bundle URL slug",
            example: "full-stack-bundle",
          },
          short_description: {
            type: "string",
            description: "Short description of the bundle",
            example: "Complete full-stack development course bundle",
          },
          you_get: {
            type: "array",
            items: { type: "string" },
            description: "List of what users get in the bundle",
            example: ["React Course", "Node.js Course", "MongoDB Course"],
          },
          chips: {
            type: "array",
            items: { type: "string" },
            description: "Feature chips/tags for the bundle",
            example: ["Beginner Friendly", "Project Based", "Certificate"],
          },
          faq_list: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                answer: { type: "string" },
              },
            },
            description: "Frequently asked questions",
          },
          feedback_list: {
            type: "array",
            items: {
              type: "object",
              properties: {
                user_name: { type: "string" },
                rating: { type: "integer" },
                comment: { type: "string" },
              },
            },
            description: "User feedback and testimonials",
          },
          intro_video: {
            type: "string",
            description: "Introduction video URL",
            example: "https://youtube.com/watch?v=abc123",
          },
          is_live: {
            type: "boolean",
            description: "Whether the bundle is live/published",
            example: true,
          },
          is_active: {
            type: "boolean",
            description: "Whether the bundle is active for purchase",
            example: true,
          },
          prebooking: {
            type: "integer",
            description: "Total number of users who prebooked this bundle",
            example: 15,
          },
          enrolled: {
            type: "integer",
            description:
              "Total number of users who purchased/enrolled in this bundle",
            example: 8,
          },
          course_count: {
            type: "integer",
            description: "Number of courses included in the bundle",
            example: 3,
          },
        },
      },
      notification: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          title: { type: "string", example: "New Course Available" },
          message: { type: "string", example: "A new course has been added" },
          html: { type: "string", description: "Rich-text HTML body when the notification is announcement-driven.", example: "<p><strong>New module</strong> released.</p>" },
          type: {
            type: "string",
            enum: ["course", "bundle", "payment", "announcement"],
            example: "course",
          },
          is_read: { type: "boolean", example: false },
          announcement_id: { type: "integer", nullable: true, example: 12 },
          created_at: { type: "string", format: "date-time" },
        },
      },
      discussion: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          title: { type: "string", example: "Question about React Hooks" },
          content: {
            type: "string",
            example: "I need help understanding useEffect",
          },
          module_id: { type: "integer", example: 5 },
          user_id: { type: "integer", example: 123 },
          user_name: { type: "string", example: "John Doe" },
          reply_count: { type: "integer", example: 8 },
          is_resolved: { type: "boolean", example: false },
          created_at: { type: "string", format: "date-time" },
        },
      },
      announcement: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          title: { type: "string", example: "New Module Released" },
          content: { type: "string", example: "We've released a new module" },
          course_id: { type: "integer", example: 1 },
          priority: {
            type: "string",
            enum: ["low", "medium", "high"],
            example: "medium",
          },
          status: {
            type: "string",
            enum: ["draft", "sent", "scheduled"],
            example: "draft",
          },
          created_at: { type: "string", format: "date-time" },
        },
      },
      routine: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "Routine ID",
            example: 1,
          },
          course_id: {
            type: "integer",
            description: "Course ID",
            example: 11,
          },
          course_title: {
            type: "string",
            description: "Course title",
            example: "Structured Programming Language",
          },
          week_number: {
            type: "integer",
            description: "Week number (positive integer)",
            example: 1,
          },
          routine_image_url: {
            type: "string",
            description: "S3 URL of the routine banner image",
            example: "https://Math Promedia.s3.ap-south-1.amazonaws.com/routines/course-15-week-1.jpg",
          },
          week_start_date: {
            type: "string",
            format: "date",
            description: "Start date of the week",
            example: "2025-11-25",
          },
          week_end_date: {
            type: "string",
            format: "date",
            description: "End date of the week",
            example: "2025-12-01",
          },
          is_active: {
            type: "boolean",
            description: "Whether routine is active",
            example: true,
          },
          created_at: {
            type: "string",
            format: "date-time",
            description: "Creation timestamp",
            example: "2025-11-20T10:00:00Z",
          },
          updated_at: {
            type: "string",
            format: "date-time",
            description: "Last update timestamp",
            example: "2025-11-20T10:00:00Z",
          },
        },
      },
      Error: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: { type: "string", example: "Error message" },
          code: { type: "string", example: "ERROR_CODE" },
        },
      },
      coupon: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "Coupon ID",
            example: 1,
          },
          name: {
            type: "string",
            description: "Coupon name",
            example: "Summer Sale 20%",
          },
          code: {
            type: "string",
            description: "Coupon code",
            example: "SUMMER20",
          },
          description: {
            type: "string",
            description: "Coupon description",
            example: "Get 20% off on all courses",
          },
          discount_type: {
            type: "string",
            enum: ["percentage", "fixed"],
            description: "Discount type",
            example: "percentage",
          },
          discount_value: {
            type: "number",
            description: "Discount value (percentage or fixed amount)",
            example: 20,
          },
          usage_limit: {
            type: "integer",
            nullable: true,
            description: "Maximum usage count (null for unlimited)",
            example: 1000,
          },
          usage_count: {
            type: "integer",
            description: "Current usage count",
            example: 45,
          },
          start_time: {
            type: "integer",
            description: "Start timestamp (Unix)",
            example: 1640995200,
          },
          end_time: {
            type: "integer",
            description: "End timestamp (Unix)",
            example: 1735689600,
          },
          status: {
            type: "string",
            enum: ["active", "inactive", "expired", "deleted"],
            description: "Coupon status",
            example: "active",
          },
          created_at: {
            type: "integer",
            description: "Creation timestamp (Unix)",
            example: 1640995200,
          },
          updated_at: {
            type: "integer",
            description: "Last update timestamp (Unix)",
            example: 1640995200,
          },
          created_by: {
            type: "integer",
            description: "Admin user ID who created the coupon",
            example: 1,
          },
          metadata: {
            type: "object",
            description: "Additional metadata (JSON)",
            example: {},
          },
        },
      },
      createCoupon: {
        type: "object",
        required: ["name", "code", "discount_type", "discount_value", "start_time", "end_time"],
        properties: {
          name: {
            type: "string",
            description: "Coupon name (min 3 characters)",
            minLength: 3,
            maxLength: 255,
            example: "Summer Sale 20%",
          },
          description: {
            type: "string",
            description: "Coupon description (optional)",
            maxLength: 1000,
            example: "Get 20% off on all courses",
          },
          code: {
            type: "string",
            description: "Unique coupon code (uppercase, alphanumeric, 3-50 chars)",
            minLength: 3,
            maxLength: 50,
            pattern: "^[A-Z0-9]+$",
            example: "SUMMER20",
          },
          discount_type: {
            type: "string",
            enum: ["percentage", "fixed"],
            description: "Discount type",
            example: "percentage",
          },
          discount_value: {
            type: "number",
            description: "Discount value (percentage: 0.01-100, fixed: 0.01-100000)",
            minimum: 0.01,
            example: 20,
          },
          usage_limit: {
            type: "integer",
            nullable: true,
            description: "Maximum usage count (null for unlimited, max 1,000,000)",
            minimum: 1,
            maximum: 1000000,
            example: 1000,
          },
          start_time: {
            type: "integer",
            description: "Start timestamp (Unix timestamp)",
            example: 1640995200,
          },
          end_time: {
            type: "integer",
            description: "End timestamp (Unix timestamp, must be in future and after start_time)",
            example: 1735689600,
          },
          status: {
            type: "string",
            enum: ["active", "inactive", "expired"],
            description: "Coupon status (default: active)",
            default: "active",
            example: "active",
          },
        },
      },
      updateCoupon: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Coupon name (optional, min 3 characters)",
            minLength: 3,
            maxLength: 255,
            example: "Updated Summer Sale",
          },
          description: {
            type: "string",
            description: "Coupon description (optional)",
            maxLength: 1000,
            example: "Updated description",
          },
          discount_type: {
            type: "string",
            enum: ["percentage", "fixed"],
            description: "Discount type (optional)",
            example: "percentage",
          },
          discount_value: {
            type: "number",
            description: "Discount value (optional)",
            minimum: 0.01,
            example: 25,
          },
          usage_limit: {
            type: "integer",
            nullable: true,
            description: "Maximum usage count (optional, null for unlimited)",
            minimum: 1,
            maximum: 1000000,
            example: 2000,
          },
          end_time: {
            type: "integer",
            description: "End timestamp (optional, must be in future)",
            example: 1768335846,
          },
          status: {
            type: "string",
            enum: ["active", "inactive", "expired"],
            description: "Coupon status (optional)",
            example: "active",
          },
        },
      },
      feedback_submission: {
        type: "object",
        required: ["courseId", "rating"],
        properties: {
          courseId: {
            type: "string",
            description: "Course ID",
            example: "course-123"
          },
          rating: {
            type: "integer",
            description: "Rating (1-5)",
            minimum: 1,
            maximum: 5,
            example: 5
          },
          comment: {
            type: "string",
            description: "Feedback comment (optional, max 1000 characters)",
            maxLength: 1000,
            example: "Excellent course! Very informative and well-structured."
          },
          category: {
            type: "string",
            enum: ["content", "instructor", "platform", "course", "other"],
            description: "Feedback category (optional)",
            example: "content"
          }
        }
      },
      feedback_update: {
        type: "object",
        properties: {
          rating: {
            type: "integer",
            description: "Updated rating (1-5)",
            minimum: 1,
            maximum: 5,
            example: 4
          },
          comment: {
            type: "string",
            description: "Updated feedback comment (max 1000 characters)",
            maxLength: 1000,
            example: "Great course overall, but could use more examples."
          },
          category: {
            type: "string",
            enum: ["content", "instructor", "platform", "course", "other"],
            description: "Updated feedback category",
            example: "content"
          }
        }
      },
      feedback_response: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Feedback ID",
            example: "feedback-abc123"
          },
          courseId: {
            type: "string",
            description: "Course ID",
            example: "course-123"
          },
          userId: {
            type: "string",
            description: "User ID",
            example: "user-456"
          },
          rating: {
            type: "integer",
            description: "Rating (1-5)",
            example: 5
          },
          comment: {
            type: "string",
            description: "Feedback comment",
            example: "Excellent course! Very informative and well-structured."
          },
          category: {
            type: "string",
            enum: ["content", "instructor", "platform", "course", "other"],
            description: "Feedback category",
            example: "content"
          },
          createdAt: {
            type: "string",
            format: "date-time",
            description: "Creation timestamp",
            example: "2024-01-15T10:30:00Z"
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            description: "Last update timestamp",
            example: "2024-01-15T10:30:00Z"
          }
        }
      },
    },
  },
};
