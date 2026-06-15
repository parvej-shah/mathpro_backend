const managerialChapterList = require('./chapter_list');
const managerialChapterCreate = require('./chapter_create');
const managerialChapterUpdate = require('./chapter_update');
const managerialChapterGet = require('./chapter_get');
const managerialChapterDelete = require('./chapter_delete');

module.exports = {
    paths:{
        '/admin/chapter/list/{id}':{
            ...managerialChapterList
        },
        '/admin/chapter/get/{id}':{
            ...managerialChapterGet
        },
        '/admin/chapter/create/{id}':{
            ...managerialChapterCreate
        },
        '/admin/chapter/update/{id}':{
            ...managerialChapterUpdate
        },
        '/admin/chapter/delete/{id}':{
            ...managerialChapterDelete
        }
        // '/todos/{id}':{
        //     ...getTodo,
        //     ...updateTodo,
        //     ...deleteTodo
        // }
    }
}