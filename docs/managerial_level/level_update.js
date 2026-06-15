module.exports = {
    put: {
        security: [
            {
              bearerAuth: [],
            },
          ],
          tags: ["Profile+Reward+Level"], // operation's tag
        description: "Update a level", // short desc
        operationId: "managerialLevelUpdate", // unique operation id
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
                $ref: "#/components/schemas/level", // todo input data model
              },
            },
          },
        },
        "responses": {
          "200": {
            "description": "Level Update Done"
          },
          "400": {
            "description": "Update Failed"
          }
        }
      },
}