const feedbackSubmit = require('./feedback_submit');
const feedbackCheck = require('./feedback_check');
const feedbackCourseAverage = require('./feedback_course_average');
const feedbackCourseList = require('./feedback_course_list');
const feedbackUpdate = require('./feedback_update');
const feedbackDelete = require('./feedback_delete');

module.exports = {
    paths: {
        '/user/feedback': {
            ...feedbackSubmit
        },
        '/user/feedback/check/{userId}/{courseId}': {
            ...feedbackCheck
        },
        '/user/feedback/course/{courseId}/average': {
            ...feedbackCourseAverage
        },
        '/user/feedback/course/{courseId}': {
            ...feedbackCourseList
        },
        '/user/feedback/{feedbackId}': {
            ...feedbackUpdate,
            ...feedbackDelete
        }
    }
}
