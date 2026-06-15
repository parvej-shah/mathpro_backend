const couponList = require("./coupon_list");
const couponCreate = require("./coupon_create");
const couponGet = require("./coupon_get");
const couponUpdate = require("./coupon_update");
const couponDelete = require("./coupon_delete");
const couponGetCourses = require("./coupon_get_courses");
const couponAddCourses = require("./coupon_add_courses");
const couponRemoveCourses = require("./coupon_remove_courses");
const couponAvailableCourses = require("./coupon_available_courses");
const couponGetBundles = require("./coupon_get_bundles");
const couponAddBundles = require("./coupon_add_bundles");
const couponRemoveBundles = require("./coupon_remove_bundles");
const couponAvailableBundles = require("./coupon_available_bundles");
const couponGetClicks = require("./coupon_get_clicks");
const couponGetClickStats = require("./coupon_get_click_stats");
const couponGetAllClicks = require("./coupon_get_all_clicks");

module.exports = {
  paths: {
    "/admin/coupon": {
      ...couponList,
      ...couponCreate,
    },
    "/admin/coupon/{id}": {
      ...couponGet,
      ...couponUpdate,
      ...couponDelete,
    },
    "/admin/coupon/{id}/courses": {
      ...couponGetCourses,
      ...couponAddCourses,
      ...couponRemoveCourses,
    },
    "/admin/coupon/available-courses": {
      ...couponAvailableCourses,
    },
    "/admin/coupon/{id}/bundles": {
      ...couponGetBundles,
      ...couponAddBundles,
      ...couponRemoveBundles,
    },
    "/admin/coupon/available-bundles": {
      ...couponAvailableBundles,
    },
    "/admin/coupon/{id}/clicks": {
      ...couponGetClicks,
    },
    "/admin/coupon/{id}/click-stats": {
      ...couponGetClickStats,
    },
    "/admin/coupon/coupon-clicks": {
      ...couponGetAllClicks,
    },
  },
};
