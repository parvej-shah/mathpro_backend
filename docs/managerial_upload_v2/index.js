const uploadPresignedUrl = require("./upload_presigned_url");
const uploadDelete = require("./upload_delete");

module.exports = {
  paths: {
    "/v2/admin/upload/presigned-url": {
      post: uploadPresignedUrl,
    },
    "/v2/admin/upload/delete": {
      post: uploadDelete,
    },
  },
};
