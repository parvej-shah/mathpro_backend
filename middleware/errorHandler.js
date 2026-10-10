const { AppError } = require("../errors/AppError");
const logger = require("../util/logger");

/**
 * Last middleware in app.js. Express (and express-promise-router, for rejected promises)
 * sends every unhandled error here.
 *
 * - AppError: its status and message, plus any extra body fields, in the usual envelope.
 * - Client errors raised by Express itself (bad JSON, body too large): their status and
 *   message, which http-errors marks safe with `expose`.
 * - Anything else is a bug: logged in full with the request id, answered with a generic 500.
 */
module.exports = function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error("http_error", err, { method: req.method, path: req.originalUrl });
    }
    return res.status(err.status).json({ success: false, error: err.message, ...err.body });
  }

  if (err && err.expose && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ success: false, error: err.message });
  }

  logger.error("http_error", err, { method: req.method, path: req.originalUrl });
  return res.status(500).json({ success: false, error: "Internal Server Error" });
};
