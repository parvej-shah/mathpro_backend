module.exports = {
    get: {
        security: [
            {
              bearerAuth: [],
            },
          ],
        tags: ["Module Management"], // operation's tag
        description: "Get a single module", // short desc
        operationId: "managerialModuleGet", // unique operation id
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
}