module.exports = {
    post: {
        security: [
            {
              bearerAuth: [],
            },
          ],
        tags: ["Chapter Management"], // operation's tag
        description: "Create a chapter. Note: 'phase' field is optional (default: 'easy'). Allowed values: 'easy', 'Amateur', 'Advanced'. Frontend handles validation.", // short desc
        operationId: "managerialChapterCreate", // unique operation id
        parameters: [{
          in:'path',
          name:'id',
          required:true,
          description:'Course id of the chapter you want to create'
        }],
        requestBody: {
          // expected request body
          content: {
            // content-type
            "application/json": {
              schema: {
                $ref: "#/components/schemas/chapter", // todo input data model
              },
            },
          },
        },
        "responses": {
          "200": {
            "description": "Chapter created successfully (phase defaults to 'easy' if not provided)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "integer", example: 10 }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Create Failed"
          }
        }
      },
}