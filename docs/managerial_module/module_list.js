module.exports = {
    get: {
      security: [
        {
          bearerAuth: [],
        },
      ],
        tags: ["Module Management"], // operation's tag
        description: "List of modules", // short desc
        operationId: "managerialModuleList", // unique operation id
        parameters: [{
          in:'path',
          name:'id',
          required:true,
          description:'Course id of the module you want to create'
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
            "description": "Module List"
          },
          "400": {
            "description": "Failed"
          }
        }
      },
}