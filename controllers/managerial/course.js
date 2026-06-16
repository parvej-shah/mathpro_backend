var csv = require("csv-express");
const Controller = require("../base").Controller;
const CourseService =
  require("../../service/managerial/course.js").CourseService;
const RevenueService =
  require("../../service/managerial/revenueService").RevenueService;
const { getAccessibleCourseIds, checkCourseAccess } = require("../../util/courseAccessHelpers");

const courseService = new CourseService();
const revenueService = new RevenueService();
class CourseController extends Controller {
  constructor() {
    super();
  }
  list = async (req, res) => {
    const userId = req.user ? req.user.id : null;
    const access = userId ? await getAccessibleCourseIds(userId, 'course', 'manage') : null;
    var result = await courseService.list(req, access);
    return res.status(result.success ? 200 : 400).json(result);
  };
  create = async (req, res) => {
    var result = await courseService.create(req.body);
    return res.status(result.success ? 200 : 400).json(result);
  };
  update = async (req, res) => {
    // instructor_list is now managed via the instructor junction table — ignore it on save
    const { instructor_list: _ignored, ...body } = req.body;
    var result = await courseService.update(req.params.id, body);
    return res.status(result.success ? 200 : 400).json(result);
  };
  updateFull = async (req, res) => {
    var result = await courseService.updateFull(req.params.id, req.body);
    return res.status(result.success ? 200 : 400).json(result);
  };
  getEntry = async (req, res) => {
    const access = await checkCourseAccess(req.user.id, 'course', 'manage', req.params.id);
    if (!access.hasAccess) {
      return res.status(403).json({ success: false, error: 'NO_COURSE_ACCESS', message: 'No access to this course' });
    }
    var result = await courseService.get(req.params.id);
    return res.status(result.success ? 200 : 400).json(result);
  };
  getFull = async (req, res) => {
    const access = await checkCourseAccess(req.user.id, 'course', 'manage', req.params.id);
    if (!access.hasAccess) {
      return res.status(403).json({ success: false, error: 'NO_COURSE_ACCESS', message: 'No access to this course' });
    }
    var result = await courseService.getFull(req.params.id);
    return res.status(result.success ? 200 : 400).json(result);
  };
  deleteEntry = async (req, res) => {
    var result = await courseService.deleteEntry(req.params.id);
    return res.status(result.success ? 200 : 400).json(result);
  };

  getRevenue = async (req, res) => {
    var result = await revenueService.getRevenue(req.params.id);
    return res.status(result.success ? 200 : 400).send(`${result.data[0].n}`);
  };

  getAllRevenue = async (req, res) => {
    const userId = req.user ? req.user.id : null;
    const access = userId ? await getAccessibleCourseIds(userId, 'course', 'manage') : null;
    var result = await revenueService.getAllRevenue(access);
    return res.status(result.success ? 200 : 400).json(result);
  };

  getUserProgress = async (req, res) => {
    const access = await checkCourseAccess(req.user.id, 'course', 'manage', req.params.id);
    if (!access.hasAccess) {
      return res.status(403).json({ success: false, error: 'NO_COURSE_ACCESS', message: 'No access to this course' });
    }
    var result = await courseService.getUserProgress(
      req.params.user_id,
      req.params.id
    );
    return res.status(result.success ? 200 : 400).json(result);
  };
  getAllCoursePerchases = async (req, res) => {
    // Fixed: Use phone and email columns instead of login and profile->>'email'
    var query = `
            select 
                a.name,
                a.phone,
                a.email,
                t.amount,
                t.timestamp,
                t.transaction_id
            from managerial_auth a, takes t
            where a.id=t.user_id
                and t.course_id=$1
                and amount>0
            order by t.timestamp desc
        `;

    var params = [parseInt(req.query.identifier / 639)];
    var result = await courseService.query(query, params);

    res.csv([
      ["Name", "Phone", "Email", "Amount", "Date and Time", "Transaction ID"],
      ...result.data.map((d) => {
        return [
          d.name,
          d.phone,
          d.email,
          d.amount,
          new Date(d.timestamp * 1000).toLocaleString("en-US", {
            timeZone: "Asia/Dhaka",
          }),
          d.transaction_id,
        ];
      }),
    ]);
  };

  getAllPrebookings = async (req, res) => {
    var query = `
            select name,phone,email,timestamp,utm
            from prebooking
            where course_id=$1
            order by timestamp desc
        `;

    var params = [parseInt(req.query.identifier / 639)];
    var result = await courseService.query(query, params);

    res.csv([
      ["Name", "Phone", "Email", "UTM", "Date and Time"],
      ...result.data.map((d) => {
        return [
          d.name,
          d.phone,
          d.email,
          d.utm || "",
          new Date(d.timestamp * 1000).toLocaleString("en-US", {
            timeZone: "Asia/Dhaka",
          }),
        ];
      }),
    ]);
  };

  getAllCoursePerchasesApi = async (req, res) => {
    const courseId = parseInt(req.query.identifier / 639);

    // Course access check
    const access = await checkCourseAccess(req.user.id, 'course', 'manage', courseId);
    if (!access.hasAccess) {
      return res.status(403).json({ success: false, error: 'NO_COURSE_ACCESS', message: 'No access to this course' });
    }

    var query = `
            select 
                a.id as user_id, 
                a.name,
                a.phone,
                a.email,
                a.profile,
                t.amount,
                t.timestamp,
                t.transaction_id,
                -- Coupon information
                CASE WHEN cu.id IS NOT NULL THEN true ELSE false END as coupon_used,
                c.code as coupon_code,
                c.name as coupon_name,
                c.discount_type,
                c.discount_value,
                cu.original_price,
                cu.discount_amount,
                cu.final_price,
                COALESCE(cu.discount_amount, 0) as amount_saved
            from managerial_auth a
            inner join takes t on a.id = t.user_id
            left join coupon_usage cu on cu.transaction_id = t.transaction_id 
                and cu.course_id = t.course_id 
                and cu.user_id = t.user_id
                and cu.payment_status = 'completed'
            left join coupons c on cu.coupon_id = c.id
            where t.course_id = $1
            order by t.timestamp desc
        `;

    var params = [courseId];
    var result = await courseService.query(query, params);

    // console.log(
    //   `[DEBUG] getAllCoursePerchasesApi - Query returned ${result.rowCount || 0} rows for course_id: ${courseId}`
    // );

    return res.status(result.success ? 200 : 400).json(result);
  };

  getAllPrebookingsApi = async (req, res) => {
    const courseId = parseInt(req.query.identifier / 639);

    const access = await checkCourseAccess(req.user.id, 'course', 'manage', courseId);
    if (!access.hasAccess) {
      return res.status(403).json({ success: false, error: 'NO_COURSE_ACCESS', message: 'No access to this course' });
    }

    var query = `
            select name,phone,email,timestamp,utm
            from prebooking
            where course_id=$1
            order by timestamp desc
        `;

    var params = [courseId];
    var result = await courseService.query(query, params);
    return res.status(result.success ? 200 : 400).json(result);
  };

  // Update UTM field for a course prebooking
  updatePrebookingUtm = async (req, res) => {
    try {
      const { prebookingId } = req.params;
      const { utm } = req.body;

      if (!prebookingId) {
        return res.status(400).json({
          success: false,
          error: "Prebooking ID is required",
        });
      }

      const query = `UPDATE prebooking SET utm = $1 WHERE id = $2 RETURNING *`;
      const params = [utm || null, parseInt(prebookingId)];
      const result = await courseService.query(query, params);

      if (result.success && result.data.length > 0) {
        return res.status(200).json({
          success: true,
          message: "UTM field updated successfully",
          data: result.data[0],
        });
      } else {
        return res.status(400).json({
          success: false,
          error: "Failed to update UTM field or prebooking not found",
        });
      }
    } catch (error) {
      console.error("Update prebooking UTM error:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  // Delete UTM field for a course prebooking (set to NULL)
  deletePrebookingUtm = async (req, res) => {
    try {
      const { prebookingId } = req.params;

      if (!prebookingId) {
        return res.status(400).json({
          success: false,
          error: "Prebooking ID is required",
        });
      }

      const query = `UPDATE prebooking SET utm = NULL WHERE id = $1 RETURNING *`;
      const params = [parseInt(prebookingId)];
      const result = await courseService.query(query, params);

      if (result.success && result.data.length > 0) {
        return res.status(200).json({
          success: true,
          message: "UTM field deleted successfully",
          data: result.data[0],
        });
      } else {
        return res.status(400).json({
          success: false,
          error: "Failed to delete UTM field or prebooking not found",
        });
      }
    } catch (error) {
      console.error("Delete prebooking UTM error:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  };

  // getAllCoursePerchases=async (req,res)=>{
  //     var query=`
  //         select a.name,a.login as phone,t.amount,t.timestamp,t.transaction_id
  //         from managerial_auth a, takes t
  //         where a.id=t.user_id
  //             and t.course_id=$1
  //             and amount>0
  //         order by t.timestamp asc
  //     `

  //     var params=[parseInt(req.query.identifier/639)]
  //     var result=await courseService.query(query,params)

  //     console.log(result.data.length)

  //     await new Promise(async resolve=>{
  //         for(var i=256;i<result.data.length;i++){
  //             var res=await messagingService.sendMessage(
  //                 result.data[i].phone,
  //                 `Dear ${result.data[i].name}, please join the facebook group for "Recursion 23 : Simplified CSE Course for All Department" : https://www.facebook.com/groups/1131897868161642`
  //             )
  //             console.log(i)
  //         }
  //         resolve()
  //     })
  // }
}

module.exports = { CourseController };
