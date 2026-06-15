module.exports = {
    put: {
        security: [
            {
              bearerAuth: [],
            },
          ],
        tags: ["Module Management"], // operation's tag
        description: "Update a module", // short desc
        operationId: "managerialModuleUpdate", // unique operation id
        parameters: [{
            in:'path',
            name:'id',
            required:true
        }], // expected params
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
            "description": "Module Update Done"
          },
          "400": {
            "description": "Update Failed"
          }
        }
      },
}