const managerialLevelList = require('./level_list');
const managerialLevelCreate = require('./level_create');
const managerialLevelUpdate = require('./level_update');
const managerialLevelGet = require('./level_get');
const managerialLevelDelete = require('./level_delete');

module.exports = {
    paths:{
        '/admin/level/list/{id}':{
            ...managerialLevelList
        },
        '/admin/level/get/{id}':{
            ...managerialLevelGet
        },
        '/admin/level/create/{id}':{
            ...managerialLevelCreate
        },
        '/admin/level/update/{id}':{
            ...managerialLevelUpdate
        },
        '/admin/level/delete/{id}':{
            ...managerialLevelDelete
        },
        '/admin/level/requestGift/{level_id}': {
            post: {
              security: [
                {
                  bearerAuth: [],
                },
              ],
              tags: ["Profile+Reward+Level"], // operation's tag
              description: "Request a gift", // short desc
              operationId: "userRequestGift", // unique operation id 
              parameters: [ {
                in: 'path',
                name: 'level_id',
                required: true,
              }], // expected params
              requestBody: {
               
              },
              "responses": {
                "200": {
                  "description": "Gift requested successfully"
                },
                "400": {
                  "description": "Gift request failed"
                }
              }
            },
          },
          '/admin/level/getGiftRequests': {
            get: {
              security: [
                {
                  bearerAuth: [],
                },
              ],
              tags: ["Profile+Reward+Level"], // operation's tag
              description: "Get requested gifts", // short desc
              operationId: "userGetRequestedGiftList", // unique operation id 
              parameters: [ ], // expected params
              requestBody: {
               
              },
              "responses": {
                "200": {
                  "description": "Gift request list"
                },
                "400": {
                  "description": "Gift request list fetch failed"
                }
              }
            },
          },
          '/admin/level/approveGiftRequest': {
            put: {
              security: [
                {
                  bearerAuth: [],
                },
              ],
              tags: ["Profile+Reward+Level"], // operation's tag
              description: "Approve a requested Gift", // short desc
              operationId: "userApproveGiftRequest", // unique operation id 
              parameters: [], // expected params
              requestBody: {
                // expected request body
                content: {
                  // content-type
                  "application/json": {
                    schema: {
                      type: "object",
                        description: "data",
                        example: {
                          level_id:1,
                          reciever_user_id:64
                        }
                    },
                  },
                },
              },
              "responses": {
                "200": {
                  "description": "Gift request approved successfully"
                },
                "400": {
                  "description": "Gift request approval failed"
                }
              }
            },
          },
          '/admin/level/getGiftPage/{course_id}': {
            get: {
              security: [
                {
                  bearerAuth: [],
                },
              ],
              tags: ["Profile+Reward+Level"], // operation's tag
              description: "Get data of gift page", // short desc
              operationId: "userGetGiftPage", // unique operation id 
              parameters: [ {
                in: 'path',
                name: 'course_id',
                required: true,
                example:1
              }], // expected params
              requestBody: {
               
              },
              "responses": {
                "200": {
                  "description": "Gift page data fetched successfully"
                },
                "400": {
                  "description": "Gift page data fetch failed"
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