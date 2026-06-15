module.exports = {
    post: {
        security: [
            {
              bearerAuth: [],
            },
          ],
        tags: ["Module Management"], // operation's tag
        description: "Create a module", // short desc
        operationId: "managerialModuleCreate", // unique operation id
        parameters: [{
          in:'path',
          name:'id',
          required:true,
          description:'Chapter id of the module you want to create'
        }],
        requestBody: {
          // expected request body
          content: {
            // content-type
            "application/json": {
              schema: {
                $ref: "#/components/schemas/module", // todo input data model
              },
            },
          },
        },
        "responses": {
          "200": {
            "description": "Module Created"
          },
          "400": {
            "description": "Create Failed"
          }
        }
      },
}