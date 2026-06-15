const dashboard = require("./dashboard");
const revenue = require("./revenue");
const users = require("./users");
const courses = require("./courses");
const bundles = require("./bundles");
const learning = require("./learning");
const engagement = require("./engagement");
const coupons = require("./coupons");
const payments = require("./payments");
const filters = require("./filters");
const metadata = require("./metadata");

module.exports = {
  paths: {
    ...dashboard,
    ...revenue,
    ...users,
    ...courses,
    ...bundles,
    ...learning,
    ...engagement,
    ...coupons,
    ...payments,
    ...filters,
    ...metadata,
  },
};
