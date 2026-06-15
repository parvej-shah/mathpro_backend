module.exports = {
    put: {
        security: [
            {
              bearerAuth: [],
            },
          ],
        tags: ["Course Management"], // operation's tag
        description: "Update a course", // short desc
        operationId: "managerialCourseUpdate", // unique operation id
        parameters: [{
            in:'path',
            name:'id',
            required:true
        }], // expected params
        requestBody: {
          // expected request body
          content: {
            // content-type
            "application/json": {
              schema: {
                $ref: "#/components/schemas/course", // todo input data model
              },
            },
          },
        },
        "responses": {
          "200": {
            "description": "Course Update Done"
          },
          "400": {
            "description": "Update Failed"
          }
        }
      },
}