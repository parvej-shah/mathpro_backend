module.exports = {
    get: {
        security: [
            {
              bearerAuth: [],
            },
          ],
        tags: ["Contest Management"], // operation's tag
        description: "Get a single contest", // short desc
        operationId: "managerialContestGet", // unique operation id
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
            "description": "Contest Body"
          },
          "400": {
            "description": "Failed"
          }
        }
      },
}