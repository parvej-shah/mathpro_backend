/**
 * Query Utilities for Analytics V2
 * Helper functions for building SQL queries
 */

/**
 * Build WHERE clause for date filtering
 * @param {number|null} startDate - Start timestamp (Unix seconds)
 * @param {number|null} endDate - End timestamp (Unix seconds)
 * @param {string} columnName - Column name to filter (default: 'timestamp')
 * @param {boolean} isIntegerTimestamp - If true, column is INTEGER (Unix timestamp), if false it's TIMESTAMP type (default: true)
 * @returns {Object} { clause: string, params: array }
 */
function buildDateFilter(startDate, endDate, columnName = "timestamp", isIntegerTimestamp = true) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (startDate) {
    if (isIntegerTimestamp) {
      // INTEGER timestamp columns: compare directly
      conditions.push(`${columnName} >= $${paramIndex}`);
    } else {
      // TIMESTAMP columns: use to_timestamp()
      conditions.push(`${columnName} >= to_timestamp($${paramIndex})`);
    }
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    if (isIntegerTimestamp) {
      // INTEGER timestamp columns: compare directly
      conditions.push(`${columnName} <= $${paramIndex}`);
    } else {
      // TIMESTAMP columns: use to_timestamp()
      conditions.push(`${columnName} <= to_timestamp($${paramIndex})`);
    }
    params.push(endDate);
    paramIndex++;
  }

  const clause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return { clause, params };
}

/**
 * Build WHERE clause for ID filtering
 * @param {number|null} id - ID value
 * @param {string} columnName - Column name to filter
 * @param {Array} params - Existing params array
 * @returns {Object} { clause: string, params: array }
 */
function buildIdFilter(id, columnName, params = []) {
  if (!id) {
    return { clause: "", params };
  }

  const paramIndex = params.length + 1;
  return {
    clause: `WHERE ${columnName} = $${paramIndex}`,
    params: [...params, id],
  };
}

/**
 * Build pagination clause
 * @param {number} limit - Limit value
 * @param {number} offset - Offset value
 * @param {Array} params - Existing params array
 * @returns {Object} { clause: string, params: array }
 */
function buildPagination(limit, offset, params = []) {
  const limitIndex = params.length + 1;
  const offsetIndex = params.length + 2;

  return {
    clause: `LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    params: [...params, limit, offset],
  };
}

/**
 * Build ORDER BY clause
 * @param {string} sortBy - Column to sort by
 * @param {string} order - 'asc' or 'desc' (default: 'desc')
 * @returns {string} ORDER BY clause
 */
function buildOrderBy(sortBy, order = "desc") {
  if (!sortBy) {
    return "";
  }

  const validOrder = order.toLowerCase() === "asc" ? "ASC" : "DESC";
  return `ORDER BY ${sortBy} ${validOrder}`;
}

/**
 * Validate and sanitize limit value
 * @param {number|string} limit - Limit value
 * @param {number} defaultLimit - Default limit (default: 20)
 * @param {number} maxLimit - Maximum limit (default: 100)
 * @returns {number} Validated limit
 */
function validateLimit(limit, defaultLimit = 20, maxLimit = 100) {
  const parsed = parseInt(limit);
  if (isNaN(parsed) || parsed < 1) {
    return defaultLimit;
  }
  return Math.min(parsed, maxLimit);
}

/**
 * Validate and sanitize offset value
 * @param {number|string} offset - Offset value
 * @returns {number} Validated offset
 */
function validateOffset(offset) {
  const parsed = parseInt(offset);
  return isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

/**
 * Build combined WHERE clause from multiple conditions
 * @param {Array} conditions - Array of condition strings
 * @returns {string} WHERE clause
 */
function combineConditions(conditions) {
  const validConditions = conditions.filter((c) => c && c.trim());
  if (validConditions.length === 0) {
    return "";
  }
  return `WHERE ${validConditions.join(" AND ")}`;
}

/**
 * Build date grouping clause for time-series queries
 * @param {string} groupBy - 'day', 'week', 'month', 'quarter', 'year'
 * @param {string} columnName - Column name (default: 'timestamp')
 * @param {boolean} isIntegerTimestamp - If true, column is INTEGER (Unix timestamp), if false it's TIMESTAMP type (default: true)
 * @returns {string} GROUP BY clause with date truncation
 */
function buildDateGrouping(groupBy, columnName = "timestamp", isIntegerTimestamp = true) {
  // For INTEGER timestamps, convert to timestamp first, then truncate
  // For TIMESTAMP columns, truncate directly
  const timestampExpr = isIntegerTimestamp
    ? `to_timestamp(${columnName})`
    : columnName;

  const groupingMap = {
    day: `DATE_TRUNC('day', ${timestampExpr})`,
    week: `DATE_TRUNC('week', ${timestampExpr})`,
    month: `DATE_TRUNC('month', ${timestampExpr})`,
    quarter: `DATE_TRUNC('quarter', ${timestampExpr})`,
    year: `DATE_TRUNC('year', ${timestampExpr})`,
  };

  const grouping = groupingMap[groupBy.toLowerCase()];
  if (!grouping) {
    return `DATE_TRUNC('day', ${timestampExpr})`;
  }

  return grouping;
}

/**
 * Format date group for display
 * @param {string} groupBy - Grouping type
 * @param {Date} date - Date object
 * @returns {string} Formatted date string
 */
function formatDateGroup(groupBy, date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  switch (groupBy.toLowerCase()) {
    case "day":
      return `${year}-${month}-${day}`;
    case "week":
      // Return start of week
      return `${year}-${month}-${day}`;
    case "month":
      return `${year}-${month}`;
    case "quarter":
      const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
      return `${year}-Q${quarter}`;
    case "year":
      return `${year}`;
    default:
      return `${year}-${month}-${day}`;
  }
}

module.exports = {
  buildDateFilter,
  buildIdFilter,
  buildPagination,
  buildOrderBy,
  validateLimit,
  validateOffset,
  combineConditions,
  buildDateGrouping,
  formatDateGroup,
};
