const axios = require("axios");

/**
 * Fire-and-forget cache revalidation to the student Frontend.
 *
 * The Frontend's public catalog pages (/, /courses, /combos) are statically
 * rendered with a long ISR safety-net timer; real freshness comes from this
 * webhook. After an admin write succeeds, we POST the affected cache tags to
 * the Frontend's /api/revalidate route so it rebuilds those pages within
 * seconds instead of waiting on the timer.
 *
 * Guarded by a shared secret (REVALIDATE_SECRET). Never throws — a failed or
 * unreachable Frontend must not affect the admin's request; the Frontend's
 * timer is the backstop.
 *
 * Valid tags (must match the Frontend's allow-list):
 *   courses | combos | instructors | public-testimonials | faqs
 */
function revalidateFrontend(tags) {
  const base = process.env.FRONTEND_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!base || !secret) return; // not configured — silently skip

  axios
    .post(
      `${base.replace(/\/$/, "")}/api/revalidate`,
      { tags },
      {
        headers: { "x-revalidate-secret": secret },
        timeout: 5000,
      }
    )
    .catch((err) => {
      console.error(
        "[revalidate] frontend revalidation failed:",
        err.message
      );
    });
}

/**
 * Express middleware factory. Mount on an admin mutation router so that after
 * any successful (2xx) write response, the given tags are revalidated.
 *
 *   router.use(revalidateOnWrite(["courses", "combos"]));
 *
 * Only POST/PUT/PATCH/DELETE trigger it (GETs are reads). The fetch fires
 * after the response is sent, so it never adds latency to the admin request.
 */
function revalidateOnWrite(tags) {
  const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  return (req, res, next) => {
    if (writeMethods.has(req.method)) {
      res.on("finish", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          revalidateFrontend(tags);
        }
      });
    }
    next();
  };
}

module.exports = { revalidateFrontend, revalidateOnWrite };
