/**
 * Analytics V2 Metadata Service
 * Provides help text and metadata for all data points
 */

class AnalyticsV2MetadataService {
  constructor() {
    this.metadata = {
      dashboard: {
        summary: {
          total_users: {
            label: "Total Users",
            helpText: "Total number of registered users (type 3) in the system. Includes all users regardless of activity status.",
            unit: "users",
            category: "users",
          },
          total_courses: {
            label: "Total Courses",
            helpText: "Total number of live courses available on the platform. Only includes courses marked as live (is_live = true).",
            unit: "courses",
            category: "courses",
          },
          total_bundles: {
            label: "Total Bundles",
            helpText: "Total number of live and active bundles available on the platform. Only includes bundles marked as live and active.",
            unit: "bundles",
            category: "bundles",
          },
          total_revenue: {
            label: "Total Revenue",
            helpText: "Total revenue generated from all course enrollments and bundle purchases since platform launch. This is cumulative revenue.",
            unit: "currency",
            category: "revenue",
          },
          total_enrollments: {
            label: "Total Enrollments",
            helpText: "Total number of course enrollments across all courses. Each enrollment represents a user who purchased a course.",
            unit: "enrollments",
            category: "enrollments",
          },
          active_users_30d: {
            label: "Active Users (30d)",
            helpText: "Number of unique users who have made progress (completed modules) in the last 30 days. Measures user engagement.",
            unit: "users",
            category: "engagement",
          },
        },
        operational: {
          recent_enrollments_24h: {
            label: "Recent Enrollments (24h)",
            helpText: "Number of successful course enrollments in the last 24 hours. Only counts enrollments from VALID payments (status='VALID' AND processing_status='SUCCESS').",
            unit: "enrollments",
            category: "enrollments",
          },
          recent_payments_24h: {
            label: "Recent Payments (24h)",
            helpText: "Number of successful payments (courses + bundles) in the last 24 hours. Only counts VALID payments (status='VALID' AND processing_status='SUCCESS').",
            unit: "payments",
            category: "payments",
          },
          recent_payment_amount_24h: {
            label: "Payment Amount (24h)",
            helpText: "Total amount from successful payments in the last 24 hours. Only includes VALID payments (status='VALID' AND processing_status='SUCCESS').",
            unit: "currency",
            category: "revenue",
          },
          failed_payment_rate_24h: {
            label: "Failed Payment Rate (24h)",
            helpText: "Percentage of payment attempts that failed in the last 24 hours. Calculated as (failed payments / total payment attempts) × 100. Includes all payment attempts regardless of status.",
            unit: "percentage",
            category: "payments",
          },
        },
        revenue: {
          current: {
            label: "Current Revenue",
            helpText: "Total revenue generated in the selected date range. Includes revenue from both course enrollments and bundle purchases.",
            unit: "currency",
            category: "revenue",
          },
          previous: {
            label: "Previous Revenue",
            helpText: "Total revenue generated in the previous equivalent period (for comparison). Used to calculate growth percentage.",
            unit: "currency",
            category: "revenue",
          },
          growth_percentage: {
            label: "Revenue Growth",
            helpText: "Percentage change in revenue compared to the previous period. Positive values indicate growth, negative values indicate decline.",
            unit: "percentage",
            category: "revenue",
          },
        },
        enrollments: {
          current: {
            label: "Current Enrollments",
            helpText: "Number of course enrollments in the selected date range.",
            unit: "enrollments",
            category: "enrollments",
          },
          previous: {
            label: "Previous Enrollments",
            helpText: "Number of course enrollments in the previous equivalent period (for comparison).",
            unit: "enrollments",
            category: "enrollments",
          },
          growth_percentage: {
            label: "Enrollment Growth",
            helpText: "Percentage change in enrollments compared to the previous period.",
            unit: "percentage",
            category: "enrollments",
          },
        },
      },
      revenue: {
        total_revenue: {
          label: "Total Revenue",
          helpText: "Combined revenue from courses and bundles in the selected period.",
          unit: "currency",
          category: "revenue",
        },
        course_revenue: {
          label: "Course Revenue",
          helpText: "Revenue generated from course enrollments only.",
          unit: "currency",
          category: "revenue",
        },
        bundle_revenue: {
          label: "Bundle Revenue",
          helpText: "Revenue generated from bundle purchases only.",
          unit: "currency",
          category: "revenue",
        },
        with_coupon_revenue: {
          label: "Revenue with Coupons",
          helpText: "Revenue from transactions where coupons were applied. This is the final amount paid after discount.",
          unit: "currency",
          category: "revenue",
        },
        without_coupon_revenue: {
          label: "Revenue without Coupons",
          helpText: "Revenue from transactions where no coupons were used.",
          unit: "currency",
          category: "revenue",
        },
        discount_given: {
          label: "Total Discount Given",
          helpText: "Total amount of discounts applied through coupons. This is the money saved by users, not revenue.",
          unit: "currency",
          category: "revenue",
        },
        average_order_value: {
          label: "Average Order Value",
          helpText: "Average amount per transaction. Calculated as total revenue divided by total number of transactions.",
          unit: "currency",
          category: "revenue",
        },
        total_transactions: {
          label: "Total Transactions",
          helpText: "Total number of payment transactions (courses + bundles) in the selected period.",
          unit: "transactions",
          category: "revenue",
        },
      },
      users: {
        total_users: {
          label: "Total Users",
          helpText: "Total number of registered users in the system.",
          unit: "users",
          category: "users",
        },
        regular_users: {
          label: "Regular Users",
          helpText: "Number of regular users (type 3). Excludes admin and moderator accounts.",
          unit: "users",
          category: "users",
        },
        admins: {
          label: "Admins",
          helpText: "Number of admin and moderator accounts (type 1 and 2).",
          unit: "users",
          category: "users",
        },
        new_users_today: {
          label: "New Users Today",
          helpText: "Number of new user registrations today (UTC).",
          unit: "users",
          category: "users",
        },
        new_users_this_month: {
          label: "New Users This Month",
          helpText: "Number of new user registrations this month (UTC).",
          unit: "users",
          category: "users",
        },
        active_users_7d: {
          label: "Active Users (7d)",
          helpText: "Number of unique users who made progress (completed modules) in the last 7 days.",
          unit: "users",
          category: "engagement",
        },
        active_users_30d: {
          label: "Active Users (30d)",
          helpText: "Number of unique users who made progress (completed modules) in the last 30 days.",
          unit: "users",
          category: "engagement",
        },
        paying_users: {
          label: "Paying Users",
          helpText: "Number of users who have made at least one purchase (course or bundle).",
          unit: "users",
          category: "users",
        },
        conversion_rate: {
          label: "Conversion Rate",
          helpText: "Percentage of regular users who have made at least one purchase. Calculated as (paying users / regular users) × 100.",
          unit: "percentage",
          category: "users",
        },
      },
      courses: {
        total_courses: {
          label: "Total Courses",
          helpText: "Total number of courses in the system.",
          unit: "courses",
          category: "courses",
        },
        live_courses: {
          label: "Live Courses",
          helpText: "Number of courses currently marked as live (available for purchase).",
          unit: "courses",
          category: "courses",
        },
        total_enrollments: {
          label: "Total Enrollments",
          helpText: "Total number of course enrollments across all courses.",
          unit: "enrollments",
          category: "enrollments",
        },
        average_enrollments_per_course: {
          label: "Avg Enrollments per Course",
          helpText: "Average number of enrollments per course. Calculated as total enrollments divided by total courses.",
          unit: "enrollments",
          category: "enrollments",
        },
        completion_rate: {
          label: "Completion Rate",
          helpText: "Percentage of enrolled students who have completed all modules in a course.",
          unit: "percentage",
          category: "engagement",
        },
      },
      bundles: {
        total_bundles: {
          label: "Total Bundles",
          helpText: "Total number of bundles in the system.",
          unit: "bundles",
          category: "bundles",
        },
        live_bundles: {
          label: "Live Bundles",
          helpText: "Number of bundles currently marked as live and active.",
          unit: "bundles",
          category: "bundles",
        },
        total_purchases: {
          label: "Total Purchases",
          helpText: "Total number of bundle purchases across all bundles.",
          unit: "purchases",
          category: "bundles",
        },
        total_revenue: {
          label: "Bundle Revenue",
          helpText: "Total revenue generated from bundle purchases.",
          unit: "currency",
          category: "revenue",
        },
      },
      learning: {
        total_modules_completed: {
          label: "Modules Completed",
          helpText: "Total number of modules completed by all users. Each completion represents a user finishing a module.",
          unit: "modules",
          category: "learning",
        },
        active_learners_30d: {
          label: "Active Learners (30d)",
          helpText: "Number of unique users who have completed at least one module in the last 30 days.",
          unit: "users",
          category: "learning",
        },
        average_completion_rate: {
          label: "Average Completion Rate",
          helpText: "Average course completion rate across all courses. Calculated as average of individual course completion rates.",
          unit: "percentage",
          category: "learning",
        },
        current_streak: {
          label: "Current Streak",
          helpText: "Number of consecutive days a user has been active (completed at least one module).",
          unit: "days",
          category: "learning",
        },
        longest_streak: {
          label: "Longest Streak",
          helpText: "Longest consecutive days a user has been active. This is their personal best streak.",
          unit: "days",
          category: "learning",
        },
      },
      engagement: {
        average_streak_days: {
          label: "Average Streak Days",
          helpText: "Average learning streak across all users. Shows overall platform engagement.",
          unit: "days",
          category: "engagement",
        },
      },
      coupons: {
        total_coupons: {
          label: "Total Coupons",
          helpText: "Total number of coupons created (excluding deleted ones).",
          unit: "coupons",
          category: "coupons",
        },
        active_coupons: {
          label: "Active Coupons",
          helpText: "Number of coupons currently active and available for use.",
          unit: "coupons",
          category: "coupons",
        },
        total_usage: {
          label: "Total Usage",
          helpText: "Total number of times coupons have been used successfully.",
          unit: "uses",
          category: "coupons",
        },
        conversion_rate: {
          label: "Coupon Conversion Rate",
          helpText: "Percentage of transactions that used a coupon. Calculated as (coupon transactions / total transactions) × 100.",
          unit: "percentage",
          category: "coupons",
        },
      },
      payments: {
        total_payments: {
          label: "Total Payments",
          helpText: "Total number of payment attempts (including failed ones).",
          unit: "payments",
          category: "payments",
        },
        successful_payments: {
          label: "Successful Payments",
          helpText: "Number of payments that succeeded (status='VALID' AND processing_status='SUCCESS').",
          unit: "payments",
          category: "payments",
        },
        failed_payments: {
          label: "Failed Payments",
          helpText: "Number of payments that failed (status='FAILED' OR processing_status='FAILED').",
          unit: "payments",
          category: "payments",
        },
        success_rate: {
          label: "Payment Success Rate",
          helpText: "Percentage of payment attempts that succeeded. Calculated as (successful / total) × 100.",
          unit: "percentage",
          category: "payments",
        },
        average_transaction_value: {
          label: "Average Transaction Value",
          helpText: "Average amount per successful payment transaction.",
          unit: "currency",
          category: "payments",
        },
      },
    };
  }

  /**
   * Get metadata for a specific data point
   * @param {string} category - Category (dashboard, revenue, users, etc.)
   * @param {string} key - Data point key
   * @returns {Object|null} Metadata object or null if not found
   */
  getMetadata(category, key) {
    if (this.metadata[category] && this.metadata[category][key]) {
      return this.metadata[category][key];
    }
    return null;
  }

  /**
   * Get all metadata for a category
   * @param {string} category - Category name
   * @returns {Object} All metadata for the category
   */
  getCategoryMetadata(category) {
    return this.metadata[category] || {};
  }

  /**
   * Get all metadata
   * @returns {Object} Complete metadata structure
   */
  getAllMetadata() {
    return this.metadata;
  }

  /**
   * Get metadata for dashboard overview
   * @returns {Object} Dashboard metadata
   */
  getDashboardMetadata() {
    return {
      summary: this.metadata.dashboard.summary,
      operational: this.metadata.dashboard.operational,
      revenue: this.metadata.dashboard.revenue,
      enrollments: this.metadata.dashboard.enrollments,
    };
  }
}

module.exports = { AnalyticsV2MetadataService };
