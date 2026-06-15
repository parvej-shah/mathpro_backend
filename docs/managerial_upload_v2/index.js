const uploadPresignedUrl = require("./upload_presigned_url");

module.exports = {
  paths: {
    "/v2/admin/upload/presigned-url": {
      post: uploadPresignedUrl,
    },
  },
};
