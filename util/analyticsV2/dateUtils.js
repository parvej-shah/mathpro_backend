/**
 * Date Utilities for Analytics V2
 * All dates are in Unix timestamps (seconds)
 * All dates stored/processed in UTC, but keep Dhaka timezone in mind for display
 */

/**
 * Get start of day in Unix timestamp (UTC)
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {number} Start of day timestamp
 */
function startOfDay(timestamp) {
  const date = new Date(timestamp * 1000);
  date.setUTCHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

/**
 * Get start of week (Monday) in Unix timestamp (UTC)
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {number} Start of week timestamp
 */
function startOfWeek(timestamp) {
  const date = new Date(timestamp * 1000);
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  date.setUTCDate(diff);
  date.setUTCHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

/**
 * Get start of month in Unix timestamp (UTC)
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {number} Start of month timestamp
 */
function startOfMonth(timestamp) {
  const date = new Date(timestamp * 1000);
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

/**
 * Get start of quarter in Unix timestamp (UTC)
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {number} Start of quarter timestamp
 */
function startOfQuarter(timestamp) {
  const date = new Date(timestamp * 1000);
  const quarter = Math.floor(date.getUTCMonth() / 3);
  date.setUTCMonth(quarter * 3, 1);
  date.setUTCHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

/**
 * Get start of year in Unix timestamp (UTC)
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {number} Start of year timestamp
 */
function startOfYear(timestamp) {
  const date = new Date(timestamp * 1000);
  date.setUTCMonth(0, 1);
  date.setUTCHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

/**
 * Get date preset range based on preset name
 * @param {string} preset - Preset name ('today', 'yesterday', 'this_week', etc.)
 * @returns {Object} { start: number, end: number } - Unix timestamps
 */
function getDatePreset(preset) {
  const now = Math.floor(Date.now() / 1000);
  const day = 86400; // seconds in a day
  const week = 7 * day;
  const month = 30 * day; // Approximate month
  const quarter = 90 * day; // Approximate quarter
  const year = 365 * day; // Approximate year

  switch (preset) {
    case "today":
      return { start: startOfDay(now), end: now };
    case "yesterday":
      const yesterdayStart = startOfDay(now - day);
      return { start: yesterdayStart, end: startOfDay(now) };
    case "this_week":
      return { start: startOfWeek(now), end: now };
    case "last_week":
      const lastWeekStart = startOfWeek(now - week);
      return { start: lastWeekStart, end: startOfWeek(now) };
    case "this_month":
      return { start: startOfMonth(now), end: now };
    case "last_month":
      const lastMonthStart = startOfMonth(now - month);
      return { start: lastMonthStart, end: startOfMonth(now) };
    case "this_quarter":
      return { start: startOfQuarter(now), end: now };
    case "last_quarter":
      const lastQuarterStart = startOfQuarter(now - quarter);
      return { start: lastQuarterStart, end: startOfQuarter(now) };
    case "this_year":
      return { start: startOfYear(now), end: now };
    case "last_year":
      const lastYearStart = startOfYear(now - year);
      return { start: lastYearStart, end: startOfYear(now) };
    case "last_7_days":
      return { start: now - 7 * day, end: now };
    case "last_30_days":
      return { start: now - 30 * day, end: now };
    case "last_90_days":
      return { start: now - 90 * day, end: now };
    case "last_365_days":
      return { start: now - 365 * day, end: now };
    default:
      return null;
  }
}

/**
 * Parse date range from query parameters
 * Supports both preset and custom date ranges
 * @param {string|number} startDate - Start date (preset name or Unix timestamp)
 * @param {string|number} endDate - End date (Unix timestamp or null)
 * @param {string} period - Period preset (optional)
 * @returns {Object} { start: number, end: number } - Unix timestamps (null for all time)
 */
function parseDateRange(startDate, endDate, period) {
  // Handle "all_time" or "all" preset
  if (period === "all_time" || period === "all" || startDate === "all_time" || startDate === "all") {
    return {
      start: null,
      end: null,
    };
  }

  // If period is provided, use preset
  if (period) {
    const preset = getDatePreset(period);
    if (preset) {
      return preset;
    }
  }

  // If startDate is a preset name
  if (startDate && typeof startDate === "string" && !/^\d+$/.test(startDate)) {
    const preset = getDatePreset(startDate);
    if (preset) {
      return preset;
    }
  }

  // Parse custom date range
  // If both are null/undefined, return all time
  if (!startDate && !endDate) {
    return {
      start: null,
      end: null,
    };
  }

  const start = startDate ? parseInt(startDate) : null;
  const end = endDate ? parseInt(endDate) : Math.floor(Date.now() / 1000);

  return {
    start: start,
    end: end,
  };
}

/**
 * Get date range for previous period (for comparison)
 * @param {number} start - Start timestamp
 * @param {number} end - End timestamp
 * @returns {Object} { start: number, end: number } - Previous period timestamps
 */
function getPreviousPeriod(start, end) {
  const duration = end - start;
  return {
    start: start - duration,
    end: start,
  };
}

/**
 * Format timestamp for PostgreSQL query
 * Converts Unix timestamp (seconds) to PostgreSQL timestamp
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} PostgreSQL timestamp string
 */
function toPostgresTimestamp(timestamp) {
  return `to_timestamp(${timestamp})`;
}

/**
 * Calculate growth percentage
 * @param {number} current - Current value
 * @param {number} previous - Previous value
 * @returns {number} Growth percentage (can be negative)
 */
function calculateGrowthPercentage(current, previous) {
  if (!previous || previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return parseFloat(((current - previous) / previous) * 100).toFixed(2);
}

module.exports = {
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  getDatePreset,
  parseDateRange,
  getPreviousPeriod,
  toPostgresTimestamp,
  calculateGrowthPercentage,
};
