module.exports = {
    put: {
        security: [
            {
              bearerAuth: [],
            },
          ],
        tags: ["Contest Management"], // operation's tag
        description: "Update a contest", // short desc
        operationId: "managerialContestUpdate", // unique operation id
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
                $ref: "#/components/schemas/contest", // todo input data model
              },
            },
          },
        },
        "responses": {
          "200": {
            "description": "Contest Update Done"
          },
          "400": {
            "description": "Update Failed"
          }
        }
      },
}