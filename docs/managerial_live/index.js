const liveList = require("./live_list");
const liveGet = require("./live_get");
const liveCreate = require("./live_create");
const liveUpdate = require("./live_update");
const liveDelete = require("./live_delete");
const liveInterestCount = require("./live_interest_count");
const liveBulkImport = require("./live_bulk_import");
const liveExport = require("./live_export");
const liveTemplate = require("./live_template");
const liveBulkDelete = require("./live_bulk_delete");

module.exports = {
  paths: {
    "/admin/live/list": {
      ...liveList,
    },
    "/admin/live/get/{id}": {
      ...liveGet,
    },
    "/admin/live/create/{id}": {
      ...liveCreate,
    },
    "/admin/live/update/{id}": {
      ...liveUpdate,
    },
    "/admin/live/delete/{id}": {
      ...liveDelete,
    },
    "/admin/live/interestCount/{id}": {
      ...liveInterestCount,
    },
    "/admin/live/bulk-import": {
      ...liveBulkImport,
    },
    "/admin/live/export": {
      ...liveExport,
    },
    "/admin/live/template": {
      ...liveTemplate,
    },
    "/admin/live/bulk-delete": {
      ...liveBulkDelete,
    },
  },
};

