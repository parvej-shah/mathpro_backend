module.exports = {
    post: {
        security: [
            {
              bearerAuth: [],
            },
          ],
        tags: ["Course Management"], // operation's tag
        description: "Create a course", // short desc
        operationId: "managerialCourseCreate", // unique operation id
        parameters: [], // expected params
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
            "description": "Course Created"
          },
          "400": {
            "description": "Create Failed"
          }
        }
      },
}