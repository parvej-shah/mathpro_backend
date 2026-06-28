const crypto = require("crypto");

const REQUEST_SLOW_MS = parseInt(process.env.REQUEST_SLOW_MS || "1500", 10);
const DB_SLOW_QUERY_MS = parseInt(process.env.DB_SLOW_QUERY_MS || "250", 10);
const LOG_ALL_REQUESTS = process.env.LOG_ALL_REQUESTS === "true";
const LOG_ALL_DB_QUERIES = process.env.LOG_ALL_DB_QUERIES === "true";

function nowMs() {
  return Number(process.hrtime.bigint()) / 1e6;
}

function oneLine(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value, max = 220) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

function makeRequestId() {
  return crypto.randomBytes(6).toString("hex");
}

function extractUserId(req) {
  return (
    req.body?.user_id ||
    req.query?.user_id ||
    req.params?.user_id ||
    req.user?.id ||
    null
  );
}

function formatRequestLog(req, res, durationMs) {
  return {
    type: "http_request",
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl || req.url,
    status: res.statusCode,
    durationMs: Number(durationMs.toFixed(2)),
    ip: req.ip,
    userId: extractUserId(req),
  };
}

function shouldLogRequest(res, durationMs) {
  return LOG_ALL_REQUESTS || res.statusCode >= 500 || durationMs >= REQUEST_SLOW_MS;
}

function sanitizeSql(sql) {
  return truncate(oneLine(sql));
}

function formatQueryLog({ durationMs, rowCount, sql, source, pooled }) {
  return {
    type: "db_query",
    source,
    pooled,
    durationMs: Number(durationMs.toFixed(2)),
    rowCount: typeof rowCount === "number" ? rowCount : null,
    sql: sanitizeSql(sql),
  };
}

function shouldLogQuery(durationMs) {
  return LOG_ALL_DB_QUERIES || durationMs >= DB_SLOW_QUERY_MS;
}

module.exports = {
  DB_SLOW_QUERY_MS,
  LOG_ALL_DB_QUERIES,
  LOG_ALL_REQUESTS,
  REQUEST_SLOW_MS,
  formatQueryLog,
  formatRequestLog,
  makeRequestId,
  nowMs,
  shouldLogQuery,
  shouldLogRequest,
};
