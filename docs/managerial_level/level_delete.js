module.exports = {
    delete: {
        security: [
            {
              bearerAuth: [],
            },
          ],
          tags: ["Profile+Reward+Level"], // operation's tag
        description: "Delete a single level", // short desc
        operationId: "managerialLevelDelete", // unique operation id
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
            "description": "Level Deleted"
          },
          "400": {
            "description": "Failed"
          }
        }
      },
}