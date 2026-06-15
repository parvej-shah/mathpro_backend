module.exports = {
    get: {
      security: [
        {
          bearerAuth: [],
        },
      ],
      tags: ["Profile+Reward+Level"], // operation's tag
        description: "List of levels", // short desc
        operationId: "managerialLevelList", // unique operation id
        parameters: [{
          in:'path',
          name:'id',
          required:true,
          description:'Course id of the level you want to create'
        }],
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
            "description": "Level List"
          },
          "400": {
            "description": "Failed"
          }
        }
      },
}