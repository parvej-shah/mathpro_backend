// Course-access replies shared by the admin controllers.
const { checkCourseAccess } = require('../../util/courseAccessHelpers');

const noCourseAccess = (res) => res.status(403).json({
    success: false,
    error: 'NO_COURSE_ACCESS',
    message: 'No access to this course'
});

// For an optional `courseId` query filter: a non-numeric id is a 400, a course the user can't
// `<resource>.<action>` is a 403. Returns the sent response when rejected, otherwise null.
const rejectCourseFilter = async (res, userId, courseId, resource, action) => {
    if (!courseId) return null;
    const parsedCourseId = parseInt(courseId);
    if (isNaN(parsedCourseId)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid course ID'
        });
    }
    const courseAccess = await checkCourseAccess(userId, resource, action, parsedCourseId);
    if (!courseAccess.hasAccess) return noCourseAccess(res);
    return null;
};

module.exports = { noCourseAccess, rejectCourseFilter };
