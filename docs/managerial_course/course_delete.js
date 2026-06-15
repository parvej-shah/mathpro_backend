module.exports = {
    delete: {
        security: [
            {
              bearerAuth: [],
            },
          ],
        tags: ["Course Management"], // operation's tag
        description: "Delete a single course", // short desc
        operationId: "managerialCourseDelete", // unique operation id
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
            "description": "Course Deleted"
          },
          "400": {
            "description": "Failed"
          }
        }
      },
}