const userList = require('./user_list');
const userGet = require('./user_get');
const userCreate = require('./user_create');
const userUpdate = require('./user_update');
const userDelete = require('./user_delete');
const userResetPassword = require('./user_reset_password');

module.exports = {
    paths: {
        '/admin/users': {
            ...userList,
            ...userCreate
        },
        '/admin/users/{id}': {
            ...userGet,
            ...userUpdate,
            ...userDelete
        },
        '/admin/users/{id}/reset-password': {
            ...userResetPassword
        }
    }
};
