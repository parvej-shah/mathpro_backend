const recordView = require('./record_view');
const getRecentViews = require('./get_recent_views');
const getMostRecent = require('./get_most_recent');
const clearRecentViews = require('./clear_recent_views');

module.exports = {
    paths: {
        '/user/module/recordView': {
            ...recordView
        },
        '/user/module/recentViews/{courseId}': {
            get: getRecentViews.get,
            delete: clearRecentViews.delete
        },
        '/user/module/mostRecent/{courseId}': {
            ...getMostRecent
        }
    }
};

