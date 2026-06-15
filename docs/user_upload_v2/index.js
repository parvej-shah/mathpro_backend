const uploadPresignedUrl = require("./upload_presigned_url");

module.exports = {
  paths: {
    "/v2/user/upload/presigned-url": {
      post: uploadPresignedUrl,
    },
  },
};
