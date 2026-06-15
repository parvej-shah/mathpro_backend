const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const docs = require("./docs");

const adminAuthRoutes = require("./routes/managerial/auth");
const adminRoutes = require("./routes/managerial/admin");
const adminUserRoutes = require("./routes/managerial/user");
const adminRoleRoutes = require("./routes/managerial/role");
const adminCourseRoutes = require("./routes/managerial/course");
const adminTeachersRoutes = require("./routes/managerial/teacher");
const userCourseRoutes = require("./routes/user/course");
const adminChapterRoutes = require("./routes/managerial/chapter");
const adminLevelRoutes = require("./routes/managerial/level");
const adminLiveRoutes = require("./routes/managerial/live");
const userLiveRoutes = require("./routes/user/live");
const userSupportRoutes = require("./routes/user/support");
const adminModuleRoutes = require("./routes/managerial/module");
const userModuleRoutes = require("./routes/user/module");
const userMeetingRoutes = require("./routes/user/meeting");
const userPaymentRoutes = require("./routes/user/payment");
const userNotificationRoutes = require("./routes/user/notification");
const adminAnnouncementRoutes = require("./routes/managerial/announcement");
const userActivityRoutes = require("./routes/user/activity");
const adminRoutineRoutes = require("./routes/managerial/routine");
const adminFaqRoutes = require("./routes/managerial/faq");
const userFaqRoutes = require("./routes/user/faq");
const adminTestimonialRoutes = require("./routes/managerial/testimonial");
const userTestimonialRoutes = require("./routes/user/testimonial");

const DBService = require("./service/base").Service;
const dbService = new DBService();

const inAuthRoutes = require("./routes/in/auth");
const inItemRoutes = require("./routes/in/item");
const { user } = require("pg/lib/defaults");

const app = express();

// Trust proxy for accurate IP addresses (important for Cloudflare and rate limiting)
app.set('trust proxy', true);

app.use(cors());
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(bodyParser.json({ limit: "50mb" }));

app.use(
  cors({
    // origin: "http://localhost:5174", // Your frontend URL
    origin: "*",
    credentials: true,
  })
);

const port = process.env.PORT || 8000;
let swaggerUiAssets = null;
let swaggerDocsHandler = null;

app.post("/register", async (req, res) => {
  return res.status(410).json({
    success: false,
    error: "Deprecated endpoint. /register is no longer supported.",
    code: "ENDPOINT_DEPRECATED",
  });
});

app.use("/api-docs", (req, res, next) => {
  if (!swaggerUiAssets) {
    swaggerUiAssets = require("swagger-ui-express");
  }

  if (!swaggerDocsHandler) {
    swaggerDocsHandler = swaggerUiAssets.setup(docs);
  }

  return swaggerUiAssets.serve(req, res, () => swaggerDocsHandler(req, res, next));
});

app.get("/ping", function (req, res) {
  res.json({
    message: "pong",
  });
});

// Add a new health endpoint
app.get("/health", (req, res) => {
  res.send("Math Pro Backend is LIVE!");
});

app.use("/admin/auth", adminAuthRoutes);
app.use("/admin/admins", adminRoutes);
app.use("/admin/users", adminUserRoutes);
app.use("/admin/roles", adminRoleRoutes);
app.use("/admin/course", adminCourseRoutes);
app.use("/admin/teacher", adminTeachersRoutes);
app.use("/user/course", userCourseRoutes);
app.use("/admin/chapter", adminChapterRoutes);
app.use("/admin/level", adminLevelRoutes);
app.use("/admin/live", adminLiveRoutes);
app.use("/user/live", userLiveRoutes);
app.use("/admin/module", adminModuleRoutes);
app.use("/user/module", userModuleRoutes);
// V2 Phase 8 routes
app.use("/v2/admin/module", require("./routes/managerial/moduleV2"));
app.use("/v2/admin/course", require("./routes/managerial/courseV2"));
app.use("/v2/admin/teacher", require("./routes/managerial/teacherV2"));
app.use("/v2/admin/upload", require("./routes/managerial/uploadV2"));
app.use("/v2/user/upload", require("./routes/user/uploadV2"));
app.use("/user/support", userSupportRoutes);
app.use("/user/meeting", userMeetingRoutes);
app.use("/user/payment", userPaymentRoutes);
app.use("/admin/payment", require("./routes/managerial/payment"));
app.use("/user/profile", require("./routes/user/profile"));
// Coupon routes
app.use("/admin/coupon", require("./routes/managerial/coupon"));
app.use("/user/coupon", require("./routes/user/coupon"));

app.use("/user/notification", userNotificationRoutes);
app.use("/user/activity", userActivityRoutes);
app.use("/admin/announcement", adminAnnouncementRoutes);
app.use("/admin/routine", adminRoutineRoutes);
app.use("/admin/faq", adminFaqRoutes);
app.use("/user/faq", userFaqRoutes);
app.use("/admin/testimonial", adminTestimonialRoutes);
app.use("/user/testimonial", userTestimonialRoutes);

// Bundle routes
app.use("/admin/bundle", require("./routes/managerial/bundle"));
app.use("/user/bundle", require("./routes/user/bundle"));

// Book catalogue routes
app.use("/admin/book", require("./routes/managerial/book"));

// Instructor routes (public)
app.use("/user/instructor", require("./routes/user/instructor"));

// After-purchase message routes
app.use("/admin/aftermessage", require("./routes/managerial/aftermessage"));
app.use("/user/aftermessage", require("./routes/user/aftermessage"));

// Streak tracking routes
app.use("/user/streak", require("./routes/user/streak"));
app.use("/admin/streak", require("./routes/managerial/streak"));

app.use("/in/auth", inAuthRoutes);
app.use("/in/item", inItemRoutes);

app.post("/homepageData", async (req, res) => {
  const pageName = req.query.page_name;
  const data = req.body;

  if (!pageName || !data) {
    return res.status(400).json({ message: "Missing page name or data" });
  }

  try {
    // Using UPSERT to insert or update existing data
    const query = `
          INSERT INTO homepage_data (page_name, data)
          VALUES ($1, $2)
          ON CONFLICT (page_name) DO UPDATE
          SET data = EXCLUDED.data;
      `;

    // Run the query
    const result = await dbService.query(query, [pageName, data]);
    if (result.success)
      res.status(200).json({ message: "Data updated successfully" });
    else res.status(500).json({ message: "Error updating the database" });
  } catch (error) {
    res.status(500).json({ message: "Error updating the database" });
  }
});

app.get("/homepageData", async (req, res) => {
  const pageName = req.query.page_name;

  if (!pageName) {
    return res.status(400).json({ message: "Missing page name" });
  }

  try {
    // Using UPSERT to insert or update existing data
    const query = `
          SELECT * FROM homepage_data WHERE page_name=$1
      `;

    // Run the query
    const result = await dbService.query(query, [pageName]);
    if (result.success) res.status(200).json(result.data[0].data);
    else
      res.status(500).json({ message: "Error getting data from the database" });
  } catch (error) {
    res.status(500).json({ message: "Error getting data from the database" });
  }
});

// Import the new route modules
const revenueRoutes = require("./routes/managerial/revenue");
const analyticsRoutes = require("./routes/managerial/analytics");

// Mount the new routes
app.use("/admin/revenue", revenueRoutes);
app.use("/admin/analytics", analyticsRoutes);

// Contact form routes (public POST, admin GET)
const contactRoutes = require("./routes/contact");
app.use("/api/contact", contactRoutes);

// Feedback routes
const userFeedbackRoutes = require("./routes/user/feedback");
const adminFeedbackRoutes = require("./routes/managerial/feedback");
app.use("/user/feedback", userFeedbackRoutes);
app.use("/admin/feedback", adminFeedbackRoutes);

// Module Feedback routes (per-module like/dislike with detailed feedback)
const userModuleFeedbackRoutes = require("./routes/user/moduleFeedback");
const adminModuleFeedbackRoutes = require("./routes/managerial/moduleFeedback");
app.use("/user/module-feedback", userModuleFeedbackRoutes);
app.use("/admin/module-feedback", adminModuleFeedbackRoutes);

module.exports = app;
