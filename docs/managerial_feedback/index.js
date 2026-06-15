const feedbackList = require('./feedback_list');
const feedbackStats = require('./feedback_stats');
const feedbackDelete = require('./feedback_delete');
const feedbackExport = require('./feedback_export');

module.exports = {
    paths: {
        '/admin/feedback': {
            ...feedbackList
        },
        '/admin/feedback/stats': {
            ...feedbackStats
        },
        '/admin/feedback/{feedbackId}': {
            ...feedbackDelete
        },
        '/admin/feedback/export': {
            ...feedbackExport
        }
    }
}
