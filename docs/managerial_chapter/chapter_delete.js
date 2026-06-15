module.exports = {
    delete: {
        security: [
            {
              bearerAuth: [],
            },
          ],
        tags: ["Chapter Management"], // operation's tag
        description: "Delete a single chapter", // short desc
        operationId: "managerialChapterDelete", // unique operation id
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
            "description": "Chapter Deleted"
          },
          "400": {
            "description": "Failed"
          }
        }
      },
}