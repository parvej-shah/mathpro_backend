// Course-access replies shared by the admin controllers.
const { checkCourseAccess, assertCourseAccess } = require('../../util/courseAccessHelpers');

// 403 NO_COURSE_ACCESS. With `notFoundMessage`, a failed assertCourseAccess whose resource
// doesn't exist gets that message instead (still a 403).
const noCourseAccess = (res, access, notFoundMessage) => res.status(403).json({
    success: false,
    error: 'NO_COURSE_ACCESS',
    message: notFoundMessage && access.reason === 'resource_not_found' ? notFoundMessage : 'No access to this course'
});

// Answers 403 NO_COURSE_ACCESS unless the user's DB roles grant `<resource>.manage` on the
// course. Returns the sent response when denied, otherwise null:
//   if (await denyCourseAccess(res, req.user.id, 'course', courseId)) return;
const denyCourseAccess = async (res, userId, resource, courseId) => {
    const access = await checkCourseAccess(userId, resource, 'manage', courseId);
    return access.hasAccess ? null : noCourseAccess(res);
};

// The same for a course-owned resource (announcement, chapter, module, routine) looked up by
// id: 403 NO_COURSE_ACCESS, with `notFoundMessage` when the resource doesn't exist.
const denyResourceAccess = async (res, userId, resourceType, resourceId, notFoundMessage) => {
    const access = await assertCourseAccess(userId, resourceType, 'manage', resourceType, resourceId);
    return access.hasAccess ? null : noCourseAccess(res, access, notFoundMessage);
};

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
    return courseAccess.hasAccess ? null : noCourseAccess(res);
};

module.exports = { noCourseAccess, denyCourseAccess, denyResourceAccess, rejectCourseFilter };
