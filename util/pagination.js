// Reads page/limit from a query object. A missing, zero or non-numeric value falls back to
// the default, and limit is capped at maxLimit. Returns raw numbers (plus the SQL offset);
// the caller keeps its own response envelope, since endpoints differ in key names.
function parsePagination(query, { defaultPage = 1, defaultLimit = 10, maxLimit = Infinity } = {}) {
  const page = parseInt(query.page) || defaultPage;
  const limit = Math.min(parseInt(query.limit) || defaultLimit, maxLimit);
  return { page, limit, offset: (page - 1) * limit };
}

module.exports = { parsePagination };
