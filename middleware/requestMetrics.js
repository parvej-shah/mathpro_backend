const {
  formatRequestLog,
  makeRequestId,
  nowMs,
  shouldLogRequest,
} = require("../util/observability");
const { requestContext } = require("../util/logger");

module.exports = function requestMetrics(req, res, next) {
  req.requestId = req.headers["x-request-id"] || makeRequestId();
  res.setHeader("x-request-id", req.requestId);

  const startedAt = nowMs();

  res.on("finish", () => {
    const durationMs = nowMs() - startedAt;

    if (!shouldLogRequest(res, durationMs)) return;

    console.log(JSON.stringify(formatRequestLog(req, res, durationMs)));
  });

  // Everything this request runs (including async service code) logs with its id.
  requestContext.run({ requestId: req.requestId }, next);
};
