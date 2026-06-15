const adminList = require('./admin_list');
const adminGet = require('./admin_get');
const adminCreate = require('./admin_create');
const adminUpdate = require('./admin_update');
const adminSetPassword = require('./admin_set_password');
const adminDelete = require('./admin_delete');

module.exports = {
    paths: {
        '/admin/admins': {
            ...adminList,
            ...adminCreate
        },
        '/admin/admins/{id}': {
            ...adminGet,
            ...adminUpdate,
            ...adminDelete
        },
        '/admin/admins/{id}/set-password': {
            ...adminSetPassword
        }
    }
};

