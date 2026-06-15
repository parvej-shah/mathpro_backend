module.exports = {
    post: {
        security: [
            {
              bearerAuth: [],
            },
          ],
        tags: ["Profile+Reward+Level"], // operation's tag
        description: "Create a level", // short desc
        operationId: "managerialLevelCreate", // unique operation id
        parameters: [{
          in:'path',
          name:'id',
          required:true,
          description:'Course id of the level you want to create'
        }],
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
            "description": "Level Created"
          },
          "400": {
            "description": "Create Failed"
          }
        }
      },
}