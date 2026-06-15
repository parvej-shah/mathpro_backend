const submitFeedback = require('./submit_feedback');
const getModuleFeedback = require('./get_module_feedback');
const getCourseFeedback = require('./get_course_feedback');
const deleteFeedback = require('./delete_feedback');
const getModuleStats = require('./get_module_stats');

module.exports = {
    paths: {
        '/user/module-feedback': {
            ...submitFeedback
        },
        '/user/module-feedback/course/{courseId}': {
            ...getCourseFeedback
        },
        '/user/module-feedback/{moduleId}': {
            ...getModuleFeedback,
            ...deleteFeedback
        },
        '/user/module-feedback/{moduleId}/stats': {
            ...getModuleStats
        }
    }
};

