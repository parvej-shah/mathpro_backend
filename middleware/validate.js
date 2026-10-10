/**
 * Route-level input checks (REFACTOR_PLAN.md task 3.7). A schema says what the handler needs;
 * a request that doesn't have it is answered 400 `{ success: false, error }`, the reply these
 * handlers always gave. Place it right before the handler so limiters and auth still run first.
 *
 *   router.route('/login').post(limiter, validate({ required: ['login', 'password'],
 *       error: 'Login and password are required' }), controller.login);
 *
 * `required`: body fields that must be present and non-empty (falsy counts as missing).
 */
const validate = ({ required = [], error }) => (req, res, next) => {
    const body = req.body || {};
    if (required.some((field) => !body[field])) {
        return res.status(400).json({ success: false, error });
    }
    return next();
};

module.exports = { validate };
