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
const adminModuleRoutes = require("./routes/managerial/module");
const userModuleRoutes = require("./routes/user/module");
const userPaymentRoutes = require("./routes/user/payment");
const userNotificationRoutes = require("./routes/user/notification");
const adminAnnouncementRoutes = require("./routes/managerial/announcement");
const adminRoutineRoutes = require("./routes/managerial/routine");
const adminFaqRoutes = require("./routes/managerial/faq");
const userFaqRoutes = require("./routes/user/faq");
const adminTestimonialRoutes = require("./routes/managerial/testimonial");
const userTestimonialRoutes = require("./routes/user/testimonial");

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
app.use("/admin/module", adminModuleRoutes);
app.use("/user/module", userModuleRoutes);
// V2 Phase 8 routes
app.use("/v2/admin/module", require("./routes/managerial/moduleV2"));
app.use("/v2/admin/course", require("./routes/managerial/courseV2"));
app.use("/v2/admin/teacher", require("./routes/managerial/teacherV2"));
app.use("/v2/admin/upload", require("./routes/managerial/uploadV2"));
app.use("/v2/user/upload", require("./routes/user/uploadV2"));
app.use("/user/payment", userPaymentRoutes);
app.use("/admin/payment", require("./routes/managerial/payment"));
app.use("/user/profile", require("./routes/user/profile"));
// Coupon routes
app.use("/admin/coupon", require("./routes/managerial/coupon"));
app.use("/user/coupon", require("./routes/user/coupon"));

app.use("/user/notification", userNotificationRoutes);
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

// Streak tracking routes
app.use("/user/streak", require("./routes/user/streak"));
app.use("/admin/streak", require("./routes/managerial/streak"));

// Import the new route modules
const revenueRoutes = require("./routes/managerial/revenue");
const analyticsRoutes = require("./routes/managerial/analytics");

// Mount the new routes
app.use("/admin/revenue", revenueRoutes);
app.use("/admin/analytics", analyticsRoutes);

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
