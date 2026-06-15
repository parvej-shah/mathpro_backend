#!/usr/bin/env node
/**
 * Generic JWT generator for the MathPro managerial/user auth system.
 *
 * Builds the SAME token shape the real login flow produces
 * (service/managerial/auth.js -> buildTokenObject + signToken), so the token
 * passes every middleware in service/authMiddleWares.js, including
 * requirePermission() which does a literal `decoded.permissions.includes(...)`.
 *
 * Usage:
 *   node scripts/make-token.js <email>
 *   node scripts/make-token.js <email> --all-permissions      # inject all PERMISSIONS (for testing admin endpoints)
 *   node scripts/make-token.js <email> --permissions course.manage.all,course.create.all
 *   node scripts/make-token.js <email> --expires 7d
 *   node scripts/make-token.js <email> --quiet                # print ONLY the raw token (for `TOKEN=$(...)`)
 *
 * Notes:
 * - The user MUST exist in managerial_auth (matched by login OR email).
 * - By default the token carries the user's REAL roles/permissions from the DB.
 *   Many seeded users (incl. type=3 regular accounts) have none — use
 *   --all-permissions to mint a fully-authorized test token.
 * - Reads DB + JWT_SECRET from the backend .env, so run it from the backend root.
 */

require("dotenv").config();
const JWT = require("jsonwebtoken");
const { AuthService } = require("../service/managerial/auth.js");
const { PERMISSIONS } = require("../util/permissions.js");

function flattenPermissions(obj, out = new Set()) {
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (typeof v === "string") out.add(v);
    else if (v && typeof v === "object") flattenPermissions(v, out);
  }
  return [...out];
}

function parseArgs(argv) {
  const args = { email: null, allPermissions: false, permissions: null, expires: "7d", quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--all-permissions") args.allPermissions = true;
    else if (a === "--quiet" || a === "-q") args.quiet = true;
    else if (a === "--permissions") args.permissions = (argv[++i] || "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--expires") args.expires = argv[++i];
    else if (!a.startsWith("-") && !args.email) args.email = a;
  }
  return args;
}

(async () => {
  const args = parseArgs(process.argv.slice(2));

  if (!args.email) {
    console.error("Usage: node scripts/make-token.js <email> [--all-permissions] [--permissions a,b] [--expires 7d] [--quiet]");
    process.exit(1);
  }
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET missing — run this from the backend root so .env loads.");
    process.exit(1);
  }

  const auth = new AuthService();

  const userRes = await auth.query(
    "select id, name, type, login, email, profile from managerial_auth where login = $1 or email = $1 limit 1",
    [args.email]
  );

  if (!userRes.success || userRes.data.length === 0) {
    console.error(`No managerial_auth user found for: ${args.email}`);
    process.exit(1);
  }

  const user = userRes.data[0];

  // Resolve real roles/permissions, exactly like AuthService.login does.
  const { roles, permissions } = await auth.getUserRolesAndPermissions(user.id);

  let finalPermissions = permissions;
  if (args.allPermissions) finalPermissions = flattenPermissions(PERMISSIONS);
  else if (args.permissions) finalPermissions = [...new Set([...permissions, ...args.permissions])];

  // Same shape as AuthService.buildTokenObject().
  const tokenObject = {
    id: user.id,
    name: user.name,
    type: user.type,
    login: user.login,
    profile: user.profile,
    roles,
    permissions: finalPermissions,
    createdAt: Date.now(),
  };

  const token = auth.signToken(tokenObject, { expiresIn: args.expires });

  if (args.quiet) {
    process.stdout.write(token + "\n");
  } else {
    console.error(
      `user:        ${user.name} (id=${user.id}, type=${user.type}, ${user.login})\n` +
      `roles:       ${roles.map((r) => r.name).join(", ") || "(none)"}\n` +
      `permissions: ${finalPermissions.length}${args.allPermissions ? " (ALL — test token)" : args.permissions ? " (real + injected)" : " (real)"}\n` +
      `expires in:  ${args.expires}\n` +
      `\nAuthorization: Bearer <token below>\n`
    );
    console.log(token);
  }

  process.exit(0);
})().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
