module.exports = {
    delete: {
        security: [
            {
              bearerAuth: [],
            },
          ],
        tags: ["Module Management"], // operation's tag
        description: "Delete a single module", // short desc
        operationId: "managerialModuleDelete", // unique operation id
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
            "description": "Module Deleted"
          },
          "400": {
            "description": "Failed"
          }
        }
      },
}