// Pagination input parsing and the page-meta block of list responses.
// Missing, non-numeric or below-minimum values fall back to the default (a limit or page of
// 0 or less would otherwise reach SQL as LIMIT 0 / a negative OFFSET), and limit is capped at
// maxLimit. Callers keep their own response envelope, since endpoints differ in key names.

// A limit of at least 1, else defaultLimit; capped at maxLimit.
function toLimit(value, { defaultLimit = 10, maxLimit = Infinity } = {}) {
  const parsed = parseInt(value);
  return Number.isNaN(parsed) || parsed < 1 ? defaultLimit : Math.min(parsed, maxLimit);
}

// An offset of at least 0, else 0.
function toOffset(value) {
  const parsed = parseInt(value);
  return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

// page/limit style: { page, limit, offset } from query.page / query.limit.
function parsePagination(query, { defaultPage = 1, defaultLimit = 10, maxLimit = Infinity } = {}) {
  const page = toLimit(query.page, { defaultLimit: defaultPage });
  const limit = toLimit(query.limit, { defaultLimit, maxLimit });
  return { page, limit, offset: (page - 1) * limit };
}

// limit/offset style: { limit, offset } from query.limit / query.offset.
function parseLimitOffset(query, { defaultLimit = 10, maxLimit = Infinity } = {}) {
  return { limit: toLimit(query.limit, { defaultLimit, maxLimit }), offset: toOffset(query.offset) };
}

// The { page, limit, total, totalPages } block most list endpoints return.
function pageMeta(page, limit, total) {
  return { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) };
}

module.exports = { toLimit, toOffset, parsePagination, parseLimitOffset, pageMeta };
