const managerialModuleList = require('./module_list');
const managerialModuleCreate = require('./module_create');
const managerialModuleUpdate = require('./module_update');
const managerialModuleGet = require('./module_get');
const managerialModuleDelete = require('./module_delete');

module.exports = {
    paths:{
        '/admin/module/list/{id}':{
            ...managerialModuleList
        },
        '/admin/module/get/{id}':{
            ...managerialModuleGet
        },
        '/user/module/get/{id}':{
          get: {
            security: [
                {
                  bearerAuth: [],
                },
              ],
            tags: ["Module Management"], // operation's tag
            description: "Get a single module for user", // short desc
            operationId: "userModuleGet", // unique operation id
            parameters: [{
                in:'path',
                name:'id',
                required:true
            }], // expected params
            // requestBody: {
            //   // expected request body
            //   content: {
            //     // content-type
            //     "application/json": {
            //       schema: {
            //         $ref: "#/components/schemas/managerial_", // todo input data model
            //       },
            //     },
            //   },
            // },
            "responses": {
              "200": {
                "description": "Module Body"
              },
              "400": {
                "description": "Failed"
              }
            }
          },
        },
        '/admin/module/create/{id}':{
            ...managerialModuleCreate
        },
        '/admin/module/update/{id}':{
            ...managerialModuleUpdate
        },
        '/admin/module/delete/{id}':{
            ...managerialModuleDelete
        },
        '/user/module/addProgress/{moduleId}':{
            post: {
                security: [
                    {
                      bearerAuth: [],
                    },
                  ],
                tags: ["Module Management"], // operation's tag
                description: "Post a progress", // short desc
                operationId: "userModuleProgressPost", // unique operation id
                parameters: [{
                    in:'path',
                    name:'moduleId',
                    required:true
                },
                {
                  in:'query',
                  name:'points',
                  required:true
              },
              {
                in:'query',
                name:'type',
                required:true
            }], // expected params
                requestBody: {
                  // expected request body
                 
                },
                "responses": {
                  "200": {
                    "description": "Progress Pushed"
                  },
                  "400": {
                    "description": "Progress Push Failed"
                  }
                }
              },
        },
        // '/todos/{id}':{
        //     ...getTodo,
        //     ...updateTodo,
        //     ...deleteTodo
        // }
    }
}
