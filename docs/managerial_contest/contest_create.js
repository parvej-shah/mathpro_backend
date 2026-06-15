module.exports = {
    post: {
        security: [
            {
              bearerAuth: [],
            },
          ],
        tags: ["Contest Management"], // operation's tag
        description: "Create a contest", // short desc
        operationId: "managerialContestCreate", // unique operation id
        parameters: [{
          in:'path',
          name:'id',
          required:true,
          description:'Course id of the contest you want to create'
        }],
        requestBody: {
          // expected request body
          content: {
            // content-type
            "application/json": {
              schema: {
                $ref: "#/components/schemas/contest", // todo input data model
              },
            },
          },
        },
        "responses": {
          "200": {
            "description": "Contest Created"
          },
          "400": {
            "description": "Create Failed"
          }
        }
      },
}