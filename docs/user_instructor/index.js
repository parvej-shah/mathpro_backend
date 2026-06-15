/**
 * User Instructor API Swagger Documentation
 */

const instructorList = require('./instructor_list');

module.exports = {
  paths: {
    '/user/instructor/list': {
      get: instructorList,
    },
  },
};

