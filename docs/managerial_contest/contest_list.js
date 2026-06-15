module.exports = {
    get: {
      security: [
        {
          bearerAuth: [],
        },
      ],
        tags: ["Contest Management"], // operation's tag
        description: "List of contests", // short desc
        operationId: "managerialContestList", // unique operation id
        parameters: [{
          in:'path',
          name:'id',
          required:true,
          description:'Course id of the contest you want to create'
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
            "description": "Contest List"
          },
          "400": {
            "description": "Failed"
          }
        }
      },
}