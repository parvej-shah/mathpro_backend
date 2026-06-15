const managerialContestList = require('./contest_list');
const managerialContestCreate = require('./contest_create');
const managerialContestUpdate = require('./contest_update');
const managerialContestGet = require('./contest_get');
const managerialContestDelete = require('./contest_delete');

module.exports = {
    paths:{
        '/admin/contest/list/{id}':{
            ...managerialContestList
        },
        '/admin/contest/get/{id}':{
            ...managerialContestGet
        },
        '/admin/contest/create/{id}':{
            ...managerialContestCreate
        },
        '/admin/contest/update/{id}':{
            ...managerialContestUpdate
        },
        '/admin/contest/delete/{id}':{
            ...managerialContestDelete
        }
        // '/todos/{id}':{
        //     ...getTodo,
        //     ...updateTodo,
        //     ...deleteTodo
        // }
    }
}