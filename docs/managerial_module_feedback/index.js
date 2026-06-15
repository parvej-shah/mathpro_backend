const getAllFeedback = require('./get_all_feedback');
const getModuleStats = require('./get_module_stats');
const getCourseReport = require('./get_course_report');
const exportFeedback = require('./export_feedback');

module.exports = {
    paths: {
        '/admin/module-feedback': {
            ...getAllFeedback
        },
        '/admin/module-feedback/export': {
            ...exportFeedback
        },
        '/admin/module-feedback/stats/{moduleId}': {
            ...getModuleStats
        },
        '/admin/module-feedback/course/{courseId}/report': {
            ...getCourseReport
        }
    }
};

