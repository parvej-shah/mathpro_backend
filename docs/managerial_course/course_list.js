module.exports = {
    get: {
      security: [
        {
          bearerAuth: [],
        },
      ],
        tags: ["Course Management"], // operation's tag
        description: "List of courses", // short desc
        operationId: "managerialCourseList", // unique operation id
        parameters: [], // expected params
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
            "description": "Course List"
          },
          "400": {
            "description": "Failed"
          }
        }
      },
}