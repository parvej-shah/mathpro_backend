const routineList = require('./routine_list');
const routineListByCourse = require('./routine_list_by_course');
const routineCreate = require('./routine_create');
const routineUpdate = require('./routine_update');
const routineGet = require('./routine_get');
const routineDelete = require('./routine_delete');
const routineToggleActive = require('./routine_toggle_active');

module.exports = {
    '/admin/routine/list': routineList,
    '/admin/routine/course/{courseId}': routineListByCourse,
    '/admin/routine/create/{courseId}': routineCreate,
    '/admin/routine/update/{id}': routineUpdate,
    '/admin/routine/get/{id}': routineGet,
    '/admin/routine/delete/{id}': routineDelete,
    '/admin/routine/toggle-active/{id}': routineToggleActive,
};
