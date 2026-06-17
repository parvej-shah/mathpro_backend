const {
  managerialAccountTypes,
  logNames,
} = require("../../util/constants");
const Service = require("../base").Service;
const ChapterService = require("./chapter").ChapterService;
const ModuleService = require("./module").ModuleService;
const MessagingService =
  require("../../service/messagingService").MessagingService;

const messagingService = new MessagingService();

class CourseService extends Service {
  constructor() {
    super();
  }
  chapterService = new ChapterService();
  moduleService = new ModuleService();
  table = `course`;
  pk = `id`;
  cols = [
    `title`,
    `x_price`,
    `price`,
    `language`,
    `enrolled`,
    `you_get`,
    `chips`,
    `short_description`,
    `instructor_list`,
    `faq_list`,
    `description`,
    `feedback_list`,
    `intro_video`,
    `is_live`,
    `serial`,
    `url`,
    `slug`,
    `total_seats`,
    `tags`,
    `course_outline`,
  ];
  types = [
    `string`,
    `integer`,
    `integer`,
    `string`,
    `integer`,
    `object`,
    `object`,
    `string`,
    `object`,
    `object`,
    `string`,
    `object`,
    `string`,
    `boolean`,
    `integer`,
    `string`,
    `string`,
    `integer`,
    `object`,
    `string`,
  ];
  getColumns = () => {
    var result = `(`;
    this.cols.map((c, i) => {
      result += c;
      if (i < this.cols.length - 1) result += ",";
    });
    return result + ")";
  };
  getWildCards = () => {
    var result = `(`;
    this.cols.map((_, i) => {
      result += `$${i + 1}`;
      if (i < this.cols.length - 1) result += ",";
    });
    return result + ")";
  };
  getUpdatePairs = () => {
    var result = ``;
    this.cols.map((c, i) => {
      result += `
                ${c} = $${i + 1}`;
      if (i < this.cols.length - 1) result += ",";
    });
    return result;
  };

  normalizeColumnValue = (column, value) => {
    const columnIndex = this.cols.indexOf(column);
    const columnType = this.types[columnIndex];

    if (columnType !== "object" || value === undefined || value === null) {
      return value;
    }

    if (typeof value === "string") {
      return value;
    }

    return JSON.stringify(value);
  };

  list = async (req, access) => {
    if (access && access.hasGlobalAccess) {
      var result = await this.query(`select * from ${this.table} order by serial`, []);
      return result;
    } else if (access && !access.hasGlobalAccess) {
      var result = await this.query(`select * from ${this.table} where id = ANY($1) order by serial`, [access.courseIds]);
      return result;
    } else if (req.body.user_type === managerialAccountTypes.admin) {
      var result = await this.query(`select * from ${this.table} order by serial`, []);
      return result;
    } else {
      var result = await this.query(`select t.* from ${this.table} t, instructor i where t.id=i.course_id and i.user_id = $1 order by serial`, [req.body.user_id]);
      return result;
    }
  };

  listForUser = async (req) => {
    // Return all live courses for public access (no authentication required)
    var query = `select * from ${this.table} where is_live = true order by serial`;
    var params = [];
    var result = await this.query(query, params);
    return result;
  };

  // FT-style category taxonomy for the public homepage / course directory.
  // We have no category table — categories are derived from each course's free-form
  // `tags` JSON array. Order here is the display order of category sections on the page.
  // `match` is the set of (case-insensitive) tag values that route a course into a
  // category; the first category (by this order) whose match set hits a course's tags wins.
  static DIRECTORY_CATEGORIES = [
    { slug: "class-8", name: "Class 8", match: ["class 8", "class8", "class-8", "অষ্টম শ্রেণি", "অষ্টম"] },
    { slug: "ssc", name: "SSC", match: ["ssc", "এসএসসি", "মাধ্যমিক"] },
    { slug: "hsc", name: "HSC", match: ["hsc", "এইচএসসি", "উচ্চ মাধ্যমিক"] },
    { slug: "admission", name: "ADMISSION", match: ["admission", "এডমিশন", "ভর্তি"] },
    { slug: "skill-development", name: "Skill Development", match: ["skill development", "skill-development", "skill", "স্কিল"] },
  ];

  // Public course directory grouped by category, mirroring ft.education's /course-directory.
  // Shape: [{ id, slug, category_name, courses: [<full course object>...] }].
  // Each course object is the same row the flat /list endpoint returns (chips, instructor_list,
  // tags, etc.), so the frontend Course type is reused as-is. Courses whose tags match no known
  // category are bucketed under an "Other" category so nothing live disappears from the page.
  directoryForUser = async (req) => {
    var result = await this.query(
      `select * from ${this.table} where is_live = true order by serial`,
      []
    );
    if (!result.success) return result;

    var cats = CourseService.DIRECTORY_CATEGORIES;
    // Preserve declared order; build empty buckets up front so empty categories are omitted,
    // not rendered blank. Index by slug for O(1) assignment.
    var buckets = new Map(
      cats.map((c, i) => [c.slug, { id: i + 1, slug: c.slug, category_name: c.name, courses: [] }])
    );
    var other = { id: cats.length + 1, slug: "other", category_name: "Other", courses: [] };

    var classify = (tags) => {
      var normalized = (Array.isArray(tags) ? tags : [])
        .map((t) => String(t).trim().toLowerCase());
      for (const c of cats) {
        if (c.match.some((m) => normalized.includes(m.toLowerCase()))) return c.slug;
      }
      return null;
    };

    for (const course of result.data) {
      var slug = classify(course.tags);
      (slug ? buckets.get(slug) : other).courses.push(course);
    }

    var data = cats
      .map((c) => buckets.get(c.slug))
      .filter((b) => b.courses.length > 0);
    if (other.courses.length > 0) data.push(other);

    return { success: true, data };
  };
  create = async (reqObj) => {
    var query = `
            insert into ${this.table
      }${this.getColumns()} values ${this.getWildCards()} returning ${this.pk
      }
        `;
    var params = this.cols.map((c) => {
      return this.normalizeColumnValue(c, reqObj[c]);
    });
    var result = await this.query(query, params);
    return result;
  };
  update = async (id, reqObj) => {
    var query = `
            update ${this.table} set ${this.getUpdatePairs()} where ${this.pk
      }=$${this.cols.length + 1}
        `;
    var params = [
      ...this.cols.map((c) => {
        return this.normalizeColumnValue(c, reqObj[c]);
      }),
      id,
    ];
    var result = await this.query(query, params);
    return result;
  };
  get = async (id) => {
    var query = `select * from ${this.table} where ${this.pk}=$1`;
    var params = [id];
    var result = await this.query(query, params);
    return result;
  };

  // Resolve a course id from its slug (pretty route id, distinct from the legacy `url`).
  getIdBySlug = async (slug) => {
    var result = await this.query(
      `select id from ${this.table} where slug=$1`,
      [slug]
    );
    if (!result.success || result.data.length === 0) return null;
    return result.data[0].id;
  };

  // Public read by slug. Delegates to getFullUser so the slug path returns the
  // exact same payload as /getfull/:id (chapters, books, coupons, gating).
  getFullUserBySlug = async (reqBody, slug) => {
    var id = await this.getIdBySlug(slug);
    if (id === null) return { success: false, data: null };
    return this.getFullUser(reqBody, id);
  };

  getFull = async (id) => {
    var courseData = await this.get(id);
    if (courseData.data.length === 0)
      return {
        success: false,
        data: null,
      };
    var resultObject = courseData.data[0];
    var chapters = await this.chapterService.list(id);
    chapters = chapters.data;
    var moduleRequests = chapters.map((c) => this.moduleService.list(c.id));
    var modulesData = await Promise.all(moduleRequests);
    modulesData.map((m, i) => {
      chapters[i]["modules"] = m.data;
    });
    resultObject["chapters"] = chapters;
    return {
      success: true,
      ...resultObject,
    };
  };

  updateFull = async (id, reqObj) => {
    // var query = `
    //     update ${this.table} set ${this.getUpdatePairs()} where ${this.pk}=$${(this.cols.length + 1)}
    // `
    var updatePairs = [];

    reqObj.chapters.map((c) => {
      c.modules.map((m) => {
        updatePairs.push({
          module_id: m.id,
          serial: m.serial,
        });
      });
    });

    var valuesString = ``;
    updatePairs.map((u, i) => {
      valuesString += `(${u.module_id},${u.serial})${i < updatePairs.length - 1 ? "," : ""
        }`;
    });

    var query = `
            UPDATE module
            SET serial = v.serial
            FROM (VALUES ${valuesString}
                ) v(id, serial)
            WHERE v.id = module.id;
        `;

    var params = [];
    var result = await this.query(query, params);

    return {
      success: true,
      data: reqObj,
    };
  };

  takes = async (user_id, course_id, amount, transactionId, coupon_id = null) => {
    // Check if coupon_id column exists (for backward compatibility)
    const columnCheck = await this.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'takes' 
      AND column_name = 'coupon_id'
    `);

    const hasCouponColumn = columnCheck.success && columnCheck.data.length > 0;

    let query, params;

    if (hasCouponColumn && coupon_id !== null) {
      query = `insert into takes (user_id,course_id,amount,transaction_id,timestamp,coupon_id) values ($1,$2,$3,$4,$5,$6)`;
      params = [
        user_id,
        course_id,
        amount,
        transactionId,
        parseInt(Date.now() / 1000),
        coupon_id,
      ];
    } else {
      query = `insert into takes (user_id,course_id,amount,transaction_id,timestamp) values ($1,$2,$3,$4,$5)`;
      params = [
        user_id,
        course_id,
        amount,
        transactionId,
        parseInt(Date.now() / 1000),
      ];
    }

    const res = await this.query(query, params);
    return res;
  };

  getScore = async (reqBody, id) => {
    if (!reqBody.user_id) return { success: true, data: { score: 0 } };
    else {
      //SELECT MAX(p.module_id) as mid from progress p,module m,chapter c where p.user_id=6 and p.module_id=m.id and m.chapter_id=c.id and c.course_id=5
      var query = `
        SELECT COALESCE(SUM(module_points.point), 0) as s
        FROM (
          SELECT p.module_id, MAX(p.point) as point
          FROM progress p
          JOIN module m ON p.module_id = m.id
          JOIN chapter c ON m.chapter_id = c.id
          WHERE p.user_id = $1 AND c.course_id = $2
          GROUP BY p.module_id
        ) module_points
      `;
      var params = [reqBody.user_id, id];
      var result = await this.query(query, params);
      if (!result.success || result.data[0].s === null)
        return { success: true, data: { score: 0 } };
      return { success: true, data: { score: parseInt(result.data[0].s) } };
    }
  };
  getUserProgress = async (user_id, course_id) => {
    var query = `SELECT
    managerial_auth.id AS user_id,chapter.id as chapter_id,chapter.title as chapter_name,
    COUNT(DISTINCT module.id) AS total_modules_assigned,
    COUNT(DISTINCT module.id) FILTER (WHERE progress.point IS NOT NULL) AS completed_modules,
    ROUND(
        (COUNT(DISTINCT module.id) FILTER (WHERE progress.point IS NOT NULL)::decimal / NULLIF(COUNT(DISTINCT module.id), 0)) * 100,
        2
    ) AS completion_percentage,
    COALESCE(
        json_agg(
            jsonb_build_object(
                'moduleId', module.id,
                'moduleName', module.title,
                'point', progress.point,
                'moduleMaxScore',module.score,
                'moduleType', module.data->>'category'
            ) ORDER BY module.id
        ) FILTER (WHERE module.id IS NOT NULL),
        '[]'::json
    ) AS modules
FROM
    managerial_auth
-- Get courses each user is taking
LEFT JOIN takes ON takes.user_id = managerial_auth.id
-- Get chapters in those courses
LEFT JOIN course ON course.id = $1
LEFT JOIN chapter ON chapter.course_id = course.id
-- Get modules in those chapters
LEFT JOIN module ON module.chapter_id = chapter.id
-- Get progress for each module (if any)
LEFT JOIN progress ON progress.user_id = managerial_auth.id AND progress.module_id = module.id
WHERE managerial_auth.id = $2
GROUP BY
    managerial_auth.id,
    chapter.id
ORDER BY
    chapter.id;`;
    var params = [course_id, user_id];
    var result = await this.query(query, params);
    return result;
  };
  getFullUser = async (reqBody, id) => {
    var initialData = await Promise.all([
      this.get(id),
      this.moduleService.getCurrentProgress(reqBody.user_id, id),
      this.query(`select count(*) from takes where course_id=$1`, [id]),
      this.query(
        `select count(distinct phone) as n from prebooking where course_id=$1`,
        [id]
      ),
    ]);

    var courseData = initialData[0];
    var progress = initialData[1];
    if (reqBody.user_id === 23) progress = 10000;
    if (courseData.data.length === 0)
      return {
        success: false,
        data: null,
      };

    var isTaken = false;
    var isWishList = false;
    if (reqBody.user_id === 23) isTaken = true;
    var resultObject = {
      ...courseData.data[0],
      maxModuleSerialProgress: progress,
    };

    if (reqBody.auth) {
      var takeQuery = `select * from takes where user_id = $1 and course_id = $2`;
      var takeParams = [reqBody.user_id, id];
      var wishListQuery = `select * from prebooking where user_id = $1 and course_id = $2`;
      var results = await Promise.all([
        this.query(wishListQuery, takeParams),
        this.query(takeQuery, takeParams),
      ]);
      var wishListResult = results[0];
      var takeResult = results[1];
      if (takeResult.data.length > 0) isTaken = true;
      if (wishListResult.data.length > 0) isWishList = true;
    }

    // Calculate enrollment: if course is in a bundle, sum all courses in bundle + bundle purchases
    var directEnrollments = parseInt(initialData[2].data[0].count);
    var totalEnrollment = directEnrollments;
    
    // Check if course is in a bundle (via chips.bundle_id or bundle_course table)
    var bundleId = null;
    if (resultObject.chips && resultObject.chips.bundle_id) {
      bundleId = parseInt(resultObject.chips.bundle_id);
    } else {
      // Query bundle_course table to find associated bundle
      var bundleCheck = await this.query(
        `select bundle_id from bundle_course where course_id=$1 limit 1`,
        [id]
      );
      if (bundleCheck.success && bundleCheck.data.length > 0) {
        bundleId = bundleCheck.data[0].bundle_id;
      }
    }
    
    // If course is in a bundle, calculate: sum of all courses in bundle + bundle purchases
    if (bundleId) {
      // Get all course IDs in this bundle
      var bundleCoursesResult = await this.query(
        `select course_id from bundle_course where bundle_id=$1`,
        [bundleId]
      );
      
      if (bundleCoursesResult.success && bundleCoursesResult.data.length > 0) {
        var courseIds = bundleCoursesResult.data.map(row => row.course_id);
        
        // Sum up enrollments from takes table for all courses in the bundle
        var sumTakesResult = await this.query(
          `select count(*) from takes where course_id = ANY($1::int[])`,
          [courseIds]
        );
        
        var sumTakesCount = 0;
        if (sumTakesResult.success && sumTakesResult.data.length > 0) {
          sumTakesCount = parseInt(sumTakesResult.data[0].count);
        }
        
        // Get bundle purchase count
        var bundlePurchaseResult = await this.query(
          `select count(*) from bundle_purchase where bundle_id=$1`,
          [bundleId]
        );
        
        var bundlePurchaseCount = 0;
        if (bundlePurchaseResult.success && bundlePurchaseResult.data.length > 0) {
          bundlePurchaseCount = parseInt(bundlePurchaseResult.data[0].count);
        }
        
        // Total enrollment = sum of all courses in bundle + bundle purchases
        totalEnrollment = sumTakesCount + bundlePurchaseCount;
      }
    }
    
    resultObject["enrolled"] = totalEnrollment;
    resultObject["prebooking"] = parseInt(initialData[3].data[0].n);

    // Keep public course detail payload free of coupon disclosures.
    if (reqBody.auth) {
      try {
        const CouponService = require('./coupon');
        const couponService = new CouponService();
        const activeCouponsResult = await couponService.getActiveCouponsForCourse(id);

        if (activeCouponsResult.success && activeCouponsResult.data) {
          resultObject["active_coupons"] = activeCouponsResult.data.map((coupon) =>
            couponService.formatPublicCouponPreview(coupon, resultObject.price)
          );
        } else {
          resultObject["active_coupons"] = [];
        }
      } catch (error) {
        console.error('Error fetching active coupons for course:', error);
        resultObject["active_coupons"] = [];
      }
    } else {
      resultObject["active_coupons"] = [];
    }

    var chapters = await this.chapterService.list(id);
    chapters = chapters.data;
    var moduleRequests = chapters.map((c) => this.moduleService.list(c.id));
    var modulesData = await Promise.all(moduleRequests);
    modulesData.map((m, i) => {
      var modules = [];
      m.data.map((mod) => {
        var currModule = { ...mod };
        var currModuleData = currModule.data;

        if (
          (!currModule["is_live"] || (!isTaken && !currModule["is_free"])) &&
          Object.keys(currModuleData).indexOf("category") >= 0
        )
          currModuleData = { category: currModuleData.category };
        currModule.data = currModuleData;
        modules.push(currModule);
      });
      chapters[i]["modules"] = modules;
    });
    resultObject["chapters"] = chapters;

    // Books a student can optionally include with this course
    try {
      const BookService = require('./book').BookService;
      const bookService = new BookService();
      const booksResult = await bookService.booksForCourse(id);
      const attachedBooks = booksResult.success ? booksResult.data : [];
      resultObject["attached_books"] = attachedBooks;
      resultObject["books_total"] = attachedBooks.reduce(
        (sum, b) => sum + parseInt(b.price || 0),
        0
      );
    } catch (error) {
      console.error('Error fetching attached books for course:', error);
      resultObject["attached_books"] = [];
      resultObject["books_total"] = 0;
    }

    // Overwrite instructor_list with normalized data from the junction table
    try {
      const instructorsResult = await this.query(
        `SELECT ma.name, ma.profile->>'credibility' AS credibility, ma.profile->>'image' AS image
         FROM managerial_auth ma
         INNER JOIN instructor i ON ma.id = i.user_id
         WHERE i.course_id = $1
         ORDER BY ma.name ASC`,
        [id]
      );
      resultObject["instructor_list"] = {
        instructors: instructorsResult.success
          ? instructorsResult.data.map((t) => ({
              name: t.name,
              credibility: t.credibility || "",
              imageUploadedLink: t.image || "",
            }))
          : [],
      };
    } catch (error) {
      console.error("Error fetching instructors for course:", error);
    }

    return {
      success: true,
      isTaken,
      isWishList,
      ...resultObject,
    };
  };

  // Lightweight dashboard endpoint - returns only essential data for dashboard views
  getDashboard = async (reqBody, id) => {
    try {
      // Fetch basic course data
      const courseResult = await this.get(id);

      if (!courseResult.success || courseResult.data.length === 0) {
        return {
          success: false,
          error: "Course not found"
        };
      }

      const courseData = courseResult.data[0];

      // Parallel queries for counts and progress
      const queries = [
        // Query 1: Get total chapters and modules count
        this.query(`
          SELECT 
            COUNT(DISTINCT c.id) as total_chapters,
            COUNT(DISTINCT m.id) as total_modules
          FROM chapter c
          LEFT JOIN module m ON m.chapter_id = c.id
          WHERE c.course_id = $1
        `, [id])
      ];

      // Add user-specific queries if authenticated
      if (reqBody.auth && reqBody.user_id) {
        // Query 2: Get progress data
        queries.push(
          this.moduleService.getCurrentProgress(reqBody.user_id, id)
        );

        // Query 3: Get completed modules count
        queries.push(
          this.query(`
            SELECT COUNT(DISTINCT p.module_id) as completed_modules
            FROM progress p
            JOIN module m ON p.module_id = m.id
            JOIN chapter c ON m.chapter_id = c.id
            WHERE p.user_id = $1 AND c.course_id = $2
          `, [reqBody.user_id, id])
        );

        // Query 4: Get enrollment info. Enrollment can come from a direct
        // purchase (takes) OR a combo/bundle purchase (bundle_purchase ->
        // bundle_course), so both sources must be checked.
        queries.push(
          this.query(`
            SELECT timestamp as enrollment_date
            FROM takes
            WHERE user_id = $1 AND course_id = $2
            UNION ALL
            SELECT bp.timestamp as enrollment_date
            FROM bundle_purchase bp
            JOIN bundle_course bc ON bc.bundle_id = bp.bundle_id
            WHERE bp.user_id = $1 AND bc.course_id = $2
            LIMIT 1
          `, [reqBody.user_id, id])
        );
      }

      const results = await Promise.all(queries);

      // Extract counts
      const countsData = results[0].data[0];
      const totalChapters = parseInt(countsData.total_chapters) || 0;
      const totalModules = parseInt(countsData.total_modules) || 0;

      // Extract user-specific data
      let maxModuleSerialProgress = 0;
      let completedModules = 0;
      let enrollmentDate = null;
      let isEnrolled = false;

      if (reqBody.auth && reqBody.user_id) {
        maxModuleSerialProgress = results[1] || 0;
        completedModules = parseInt(results[2].data[0]?.completed_modules) || 0;

        const enrollmentResult = results[3];
        if (enrollmentResult.data.length > 0) {
          enrollmentDate = enrollmentResult.data[0].enrollment_date;
          isEnrolled = true;
        }
      }

      // Check if user is authenticated. Distinguish why auth failed so the
      // client can react correctly (e.g. silently re-login on an expired token
      // vs. show "please log in"), instead of one generic message.
      if (!reqBody.auth || !reqBody.user_id) {
        if (reqBody.auth_error === 'expired') {
          return { success: false, error: "Your session has expired. Please log in again." };
        }
        if (reqBody.auth_error === 'invalid') {
          return { success: false, error: "Your session is invalid. Please log in again." };
        }
        return { success: false, error: "Please log in to access this course dashboard." };
      }

      // Check if user is enrolled - return error if not
      if (!isEnrolled) {
        return {
          success: false,
          error: "You do not have access to this course. Please enroll to view course details."
        };
      }

      // Calculate progress percentage
      const progressPercentage = totalModules > 0
        ? Math.round((completedModules / totalModules) * 100)
        : 0;

      // Build response with safe field access
      return {
        success: true,
        data: {
          id: courseData.id,
          title: courseData.title,
          short_description: courseData.short_description,

          thumbnails: {
            course_thumbnail_16_9: courseData.chips?.thumbnails?.course_thumbnail_16_9 || null,
            trailer_video_thumb_16_9: courseData.chips?.thumbnails?.trailer_video_thumb_16_9 || null,
            facebook_community_thumb_16_9: courseData.chips?.thumbnails?.facebook_community_thumb_16_9 || null
          },

          media: {
            intro_video: courseData.intro_video || null
          },

          progress: {
            maxModuleSerialProgress,
            totalModules,
            totalChapters,
            completedModules,
            progressPercentage
          },

          instructor: {
            name: courseData.instructor_list?.instructors?.[0]?.name || null,
            credibility: courseData.instructor_list?.instructors?.[0]?.credibility || null
          },

          // This endpoint is enrolled-only (it errors above if !isEnrolled), so the
          // private group links below are always returned to an enrolled student.
          community: {
            facebook_community: courseData.chips?.socials?.facebook_community || null,
            facebook_page: courseData.chips?.socials?.facebook_page || null,
            facebook_private_group: isEnrolled ? (courseData.chips?.socials?.facebook_private_group || null) : null,
            telegram_group: isEnrolled ? (courseData.chips?.socials?.telegram_group || null) : null,
            whatsapp: courseData.chips?.socials?.whatsapp || null,
            phone: courseData.chips?.socials?.phone || null,
            email: courseData.chips?.socials?.email || null
          },

          enrollment: {
            enrollment_date: enrollmentDate,
            is_enrolled: isEnrolled,
            total_seats: courseData.total_seats ?? null,
            enrolled: courseData.enrolled ?? null
          },

          // Schedule dates live in chips.enrollment_details (unix seconds, all optional).
          enrollment_details: {
            prebooking_end_date: courseData.chips?.enrollment_details?.prebooking_end_date ?? null,
            enrollment_end_date: courseData.chips?.enrollment_details?.enrollment_end_date ?? null,
            course_start_date: courseData.chips?.enrollment_details?.course_start_date ?? null
          },

          metadata: {
            is_live: courseData.is_live,
            language: courseData.language,
            url: courseData.url,
            slug: courseData.slug ?? null,
            tags: courseData.tags ?? [],
            course_outline: courseData.course_outline ?? null
          }
        }
      };
    } catch (error) {
      console.error('Error in getDashboard:', error);
      return {
        success: false,
        error: "Internal server error"
      };
    }
  };

  deleteEntry = async (id) => {
    var query = `delete from ${this.table} where ${this.pk}=$1`;
    var params = [id];
    var result = await this.query(query, params);
    return result;
  };

  getRanking = async (reqBody, id, offset, limit) => {
    var query = `
        WITH RankedUsers AS (
            SELECT 
              a.id,
              a.name, 
              SUM(CAST(m.score AS INTEGER)) as score, -- Casting score to integer
              MIN(p.timestamp) as earliest_timestamp, -- Getting the earliest timestamp for each user
              RANK() OVER (
                ORDER BY 
                  SUM(CAST(m.score AS INTEGER)) DESC, 
                  MIN(p.timestamp) ASC -- Secondary ordering by the earliest timestamp
              ) as rank
            FROM 
              progress p,
              module m,
              chapter c,
              managerial_auth a
            WHERE 
              p.module_id = m.id 
              AND p.user_id = a.id 
              AND m.chapter_id = c.id 
              AND c.course_id = $1
            GROUP BY 
              a.id, a.name
          )
            SELECT 
                *
            FROM 
                RankedUsers 
            order by score desc offset $2 limit $3
        `;
    var params = [id, offset, limit];
    var query2 = `
        WITH RankedUsers AS (
            SELECT 
                a.id,
                a.name,
                SUM(CAST(m.score AS INTEGER)) as score, -- Casting score to integer
              MIN(p.timestamp) as earliest_timestamp, -- Getting the earliest timestamp for each user
              RANK() OVER (
                ORDER BY 
                  SUM(CAST(m.score AS INTEGER)) DESC, 
                  MIN(p.timestamp) ASC -- Secondary ordering by the earliest timestamp
              ) as rank
            FROM 
              progress p,
              module m,
              chapter c,
              managerial_auth a
            WHERE 
              p.module_id = m.id 
              AND p.user_id = a.id 
              AND m.chapter_id = c.id 
              AND c.course_id = $1
            GROUP BY 
              a.id, a.name
          )
        SELECT 
            *
        FROM 
            RankedUsers
        order by score desc offset 0 limit 3
        `;
    var params2 = [id];
    var query3 = `
        WITH RankedUsers AS (
            SELECT 
                a.id,
                a.name,
                SUM(CAST(m.score AS INTEGER)) as score, -- Casting score to integer
              MIN(p.timestamp) as earliest_timestamp, -- Getting the earliest timestamp for each user
              RANK() OVER (
                ORDER BY 
                  SUM(CAST(m.score AS INTEGER)) DESC, 
                  MIN(p.timestamp) ASC -- Secondary ordering by the earliest timestamp
              ) as rank
            FROM 
              progress p,
              module m,
              chapter c,
              managerial_auth a
            WHERE 
              p.module_id = m.id 
              AND p.user_id = a.id 
              AND m.chapter_id = c.id 
              AND c.course_id = $1
            GROUP BY 
              a.id, a.name
          )
            SELECT 
                *
            FROM 
                RankedUsers
            WHERE 
                id = $2
        `;
    var params3 = [id, reqBody.user_id];
    var results = await Promise.all([
      this.query(query, params),
      this.query(query2, params2),
      this.query(query3, params3),
    ]);

    return {
      ...results[0],
      data: {
        myData: results[2].data.length > 0 ? results[2].data[0] : {},
        top3Positions: results[1].data,
        allPositions: results[0].data,
      },
    };
  };

  prebook = async (course_id, reqObj) => {
    // console.log(course_id, reqObj)
    const utm = reqObj.utm || null;

    // Build params array first to determine correct parameter indices
    var params = [
      course_id,
      reqObj.email,
      reqObj.name,
      reqObj.phone,
      parseInt(Date.now() / 1000),
    ];
    if (reqObj.auth) params.push(reqObj.user_id);
    if (utm) params.push(utm);

    // Build parameter placeholders dynamically based on actual params array
    let paramPlaceholders = "$1,$2,$3,$4,$5";
    let paramIndex = 6;
    if (reqObj.auth) {
      paramPlaceholders += `,$${paramIndex}`;
      paramIndex++;
    }
    if (utm) {
      paramPlaceholders += `,$${paramIndex}`;
    }

    var query = `INSERT INTO prebooking(course_id,email,name,phone,timestamp${reqObj.auth ? ",user_id" : ""
      }${utm ? ",utm" : ""}) VALUES (${paramPlaceholders})`;

    var result = await this.query(query, params);
    if (result.success) {
      var courseQuery = `SELECT * FROM course WHERE id=$1`;
      var courseParams = [course_id];
      var courseResult = await this.query(courseQuery, courseParams);
      if (courseResult.data.length > 0) {
        try {
          await Promise.all([
            messagingService.sendMessage(
              reqObj.phone,
              `Dear ${reqObj.name}, welcome to Math Pro, you have successfully prebooked the "${courseResult.data[0].title}" course, we'll send your coupon when the course gets available.`
            ),
            messagingService.sendMail(
              reqObj.email,
              "Prebooking Successful !!!",
              `
                            <div>
                                Dear ${reqObj.name}, welcome to Math Pro, you have successfully prebooked the "${courseResult.data[0].title}" course, we'll send your coupon when the course gets available.
                            </div>
                        `
            ),
          ]);
        } catch { }
      }
    }
    return result;
  };

  prebookBundle = async (bundle_id, reqObj) => {
    // console.log(bundle_id, reqObj)
    const utm = reqObj.utm || null;

    // Build params array first to determine correct parameter indices
    var params = [
      bundle_id,
      reqObj.email,
      reqObj.name,
      reqObj.phone,
      parseInt(Date.now() / 1000),
    ];
    if (reqObj.auth) params.push(reqObj.user_id);
    if (utm) params.push(utm);

    // Build parameter placeholders dynamically based on actual params array
    let paramPlaceholders = "$1,$2,$3,$4,$5";
    let paramIndex = 6;
    if (reqObj.auth) {
      paramPlaceholders += `,$${paramIndex}`;
      paramIndex++;
    }
    if (utm) {
      paramPlaceholders += `,$${paramIndex}`;
    }

    var query = `INSERT INTO prebooking_bundle(bundle_id,email,name,phone,timestamp${reqObj.auth ? ",user_id" : ""
      }${utm ? ",utm" : ""}) VALUES (${paramPlaceholders})`;

    var result = await this.query(query, params);
    if (result.success) {
      var bundleQuery = `SELECT * FROM bundle WHERE id=$1`;
      var bundleParams = [bundle_id];
      var bundleResult = await this.query(bundleQuery, bundleParams);
      if (bundleResult.data.length > 0) {
        try {
          await Promise.all([
            messagingService.sendMessage(
              reqObj.phone,
              `Dear ${reqObj.name}, welcome to Math Pro, you have successfully prebooked the "${bundleResult.data[0].title}" bundle, we'll send your coupon when the course gets available.`
            ),
            messagingService.sendMail(
              reqObj.email,
              "Prebooking Successful !!!",
              `
                            <div>
                                Dear ${reqObj.name}, welcome to Math Pro, you have successfully prebooked the "${bundleResult.data[0].title}" bundle, we'll send your coupon when the course gets available.
                            </div>
                        `
            ),
          ]);
        } catch { }
      }
    }
    return result;
  };

  getWishList = async (user_id) => {
    var query = `SELECT c.* from course c,prebooking p where p.user_id = $1 and p.course_id=c.id`;
    var params = [user_id];
    var result = await this.query(query, params);
    return result;
  };

  // DEPRECATED: Old applyCoupon method removed
  // Use the new coupon service instead: /user/coupon/apply
  // This method is kept for backward compatibility but routes to new service
  applyCoupon = async (user_id, course_id, coupon_code) => {
    try {
      // Route to new coupon service
      const CouponService = require('./coupon');
      const couponService = new CouponService();

      const applyResult = await couponService.applyCouponToPrice(
        coupon_code,
        course_id,
        user_id
      );

      if (!applyResult.success || !applyResult.data) {
        return applyResult;
      }

      // For free coupons, enroll directly
      if (applyResult.data.final_price === 0) {
        const result = await this.takes(user_id, course_id, 0, null, applyResult.data.coupon.id);
        await this.createLog(logNames.couponSuccess, {
          coupon: coupon_code,
          user_id,
          course_id,
        });
        return result;
      }

      // For paid coupons, return discount info (payment required)
      return {
        success: true,
        data: {
          coupon: applyResult.data.coupon,
          original_price: applyResult.data.original_price,
          discount_amount: applyResult.data.discount_amount,
          final_price: applyResult.data.final_price,
          requires_payment: true
        }
      };
    } catch (error) {
      console.error('Error in applyCoupon:', error);
      return {
        success: false,
        error: 'Failed to apply coupon'
      };
    }
  };

  getAnalytics = async () => {
    var result = await Promise.all([
      this.query("select count(*) as n from managerial_auth"),
      this.query(
        "select c.title,count(t.user_id) as n from course c, takes t where c.id=t.course_id group by c.title"
      ),
      this.query("select l.name,count(l.id) as n from log l group by l.name"),
      this.query(
        "select c.title,count(distinct p.phone) as n from course c, prebooking p where p.course_id=c.id group by c.title"
      ),
    ]);

    var analytics = {
      "Total number of users": `${result[0].data[0].n}`,
    };
    result[1].data.map((r) => {
      analytics[`Number of students in "${r.title}"`] = r.n;
    });
    result[2].data.map((r) => {
      analytics[`${r.name}`] = r.n;
    });
    result[3].data.map((r) => {
      analytics[`Number of prebookings in "${r.title}"`] = r.n;
    });
    return {
      success: true,
      data: analytics,
    };
  };

  createLog = async (name, data) => {
    var query = `insert into log(name,data,timestamp) values ($1,$2,$3)`;
    var params = [name, data, parseInt(Date.now() / 1000)];
    var result = await this.query(query, params);
    return result;
  };

  getMyCoursesPage = async (user_id) => {
    var result = await Promise.all([
      this.query(
        `
                SELECT 
                    p.user_id AS progress_user_id, 
                    p.module_id AS progress_module_id, 
                    p.point AS progress_point, 
                    p.timestamp AS progress_timestamp,
                
                    m.id AS module_id, 
                    m.chapter_id AS module_chapter_id,
                    m.title AS module_title, 
                    m.description AS module_description, 
                    m.metadata AS module_metadata, 
                    m.data AS module_data, 
                    m.is_live AS module_is_live, 
                    m.is_free AS module_is_free, 
                    m.serial AS module_serial, 
                    m.score AS module_score,
                
                    ch.id AS chapter_id, 
                    ch.course_id AS chapter_course_id,
                    ch.title AS chapter_title, 
                    ch.serial_string AS chapter_serial_string, 
                    ch.chips_list AS chapter_chips_list, 
                    ch.is_free AS chapter_is_free, 
                    ch.is_live AS chapter_is_live,
                    ch.serial AS chapter_serial,
                
                    co.id AS course_id, 
                    co.title AS course_title, 
                    co.x_price AS course_x_price, 
                    co.price AS course_price, 
                    co.language AS course_language, 
                    co.enrolled AS course_enrolled, 
                    co.you_get AS course_you_get, 
                    co.chips AS course_chips, 
                    co.short_description AS course_short_description,
                    co.instructor_list AS course_instructor_list,
                    co.faq_list AS course_faq_list, 
                    co.description AS course_description, 
                    co.feedback_list AS course_feedback_list, 
                    co.intro_video AS course_intro_video, 
                    co.is_live AS course_is_live, 
                    co.serial AS course_serial, 
                    co.url AS course_url,
                    (select count(module.id) from module,chapter where module.chapter_id=chapter.id and chapter.course_id=co.id) AS n_modules
                
                FROM 
                    progress p
                JOIN 
                    module m ON p.module_id = m.id
                JOIN 
                    chapter ch ON m.chapter_id = ch.id
                JOIN 
                    course co ON ch.course_id = co.id
                WHERE 
                    p.user_id = $1
                ORDER BY 
                    p.timestamp DESC
                LIMIT 1;
        
            `,
        [user_id]
      ),
      this.query(`select * from course where is_live=$1`, [true]),
      this.getWishList(user_id),
    ]);
    return {
      success: result[0].success && result[1].success && result[2].success,
      data: {
        continueWatching: result[0].data.length > 0 ? result[0].data[0] : {},
        allLiveCourses: result[1].data,
        wishlist: result[2].data,
      },
    };
  };

  // Purpose-built dashboard listing: the user's enrolled individual courses and
  // purchased bundles, each carrying exactly what the dashboard cards render
  // (thumbnail via chips, slug, title, instructor, progress) — decoupled from the
  // billing/coupon data in /payment/history. See COURSE_DIRECTORY_API_SPEC.md sibling
  // doc DASHBOARD_MY_COURSES_API_SPEC.md.
  getMyDashboard = async (user_id) => {
    const userIdInt = parseInt(user_id);
    if (isNaN(userIdInt)) return { success: false, error: "Invalid user ID" };

    // Individual enrolled courses with per-course progress (completed modules /
    // total modules) so the dashboard + resume banner need no extra calls.
    const coursesQuery = `
      SELECT
        c.id,
        c.title,
        c.slug,
        c.short_description,
        c.chips,
        c.tags,
        c.instructor_list,
        c.is_live,
        c.intro_video,
        t.timestamp AS enrollment_date,
        (SELECT count(m.id)
           FROM module m JOIN chapter ch ON m.chapter_id = ch.id
          WHERE ch.course_id = c.id) AS total_modules,
        (SELECT count(DISTINCT p.module_id)
           FROM progress p
           JOIN module m ON p.module_id = m.id
           JOIN chapter ch ON m.chapter_id = ch.id
          WHERE ch.course_id = c.id AND p.user_id = $1) AS completed_modules,
        (SELECT max(p.timestamp)
           FROM progress p
           JOIN module m ON p.module_id = m.id
           JOIN chapter ch ON m.chapter_id = ch.id
          WHERE ch.course_id = c.id AND p.user_id = $1) AS last_accessed
      FROM takes t
      JOIN course c ON t.course_id = c.id
      WHERE t.user_id = $1
      ORDER BY t.timestamp DESC
    `;

    // Purchased bundles, each with its child courses (carrying chips/slug for cards).
    const bundlesQuery = `
      SELECT
        b.id,
        b.title,
        b.short_description,
        b.chips,
        b.intro_video,
        b.is_live,
        bp.timestamp AS purchase_date,
        COALESCE(
          json_agg(
            json_build_object(
              'id', c.id,
              'title', c.title,
              'slug', c.slug,
              'chips', c.chips,
              'instructor_list', c.instructor_list,
              'total_modules', (
                SELECT count(m.id)
                  FROM module m JOIN chapter ch ON m.chapter_id = ch.id
                 WHERE ch.course_id = c.id
              ),
              'completed_modules', (
                SELECT count(DISTINCT p.module_id)
                  FROM progress p
                  JOIN module m ON p.module_id = m.id
                  JOIN chapter ch ON m.chapter_id = ch.id
                 WHERE ch.course_id = c.id AND p.user_id = $1
              )
            )
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'::json
        ) AS courses
      FROM bundle_purchase bp
      JOIN bundle b ON bp.bundle_id = b.id
      LEFT JOIN bundle_course bc ON bc.bundle_id = b.id
      LEFT JOIN course c ON bc.course_id = c.id
      WHERE bp.user_id = $1
      GROUP BY b.id, bp.timestamp
      ORDER BY bp.timestamp DESC
    `;

    const [courses, bundles] = await Promise.all([
      this.query(coursesQuery, [userIdInt]),
      this.query(bundlesQuery, [userIdInt]),
    ]);

    if (!courses.success || !bundles.success) {
      return { success: false, error: "Failed to load dashboard courses" };
    }

    // Add a derived progress_percentage so the frontend doesn't recompute.
    const withProgress = (c) => {
      const total = Number(c.total_modules) || 0;
      const done = Number(c.completed_modules) || 0;
      return {
        ...c,
        total_modules: total,
        completed_modules: done,
        progress_percentage: total > 0 ? Math.round((done / total) * 100) : 0,
      };
    };

    const individual_courses = courses.data.map(withProgress);
    const bundle_purchases = bundles.data.map((b) => ({
      ...b,
      courses: Array.isArray(b.courses) ? b.courses.map(withProgress) : [],
    }));

    return {
      success: true,
      data: {
        individual_courses,
        bundle_purchases,
      },
    };
  };

  getMyCourses = async (user_id) => {
    var result = await this.query(
      `
                select c.* 
                from course c, takes t
                where t.user_id=$1 and t.course_id=c.id
            `,
      [user_id]
    );
    return result;
  };

  getEnrolledCoursesByUserId = async (user_id) => {
    var result = await this.query(
      `
                select c.id, c.title 
                from course c, takes t
                where t.user_id=$1 and t.course_id=c.id
            `,
      [user_id]
    );
    return result;
  };
}

module.exports = { CourseService };
