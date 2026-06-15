const listRoles = require('./listRoles');
const getPermissionsList = require('./getPermissionsList');
const getRole = require('./getRole');
const createRole = require('./createRole');
const updateRole = require('./updateRole');
const deleteRole = require('./deleteRole');
const getUserRoles = require('./getUserRoles');
const getUserPermissions = require('./getUserPermissions');
const assignRole = require('./assignRole');
const removeRole = require('./removeRole');

module.exports = {
    paths: {
        ...listRoles,
        ...getPermissionsList,
        ...getRole,
        ...createRole,
        ...updateRole,
        ...deleteRole,
        ...getUserRoles,
        ...getUserPermissions,
        ...assignRole,
        ...removeRole,
    }
};

