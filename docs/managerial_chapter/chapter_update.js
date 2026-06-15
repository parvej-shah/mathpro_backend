module.exports = {
    put: {
        security: [
            {
              bearerAuth: [],
            },
          ],
        tags: ["Chapter Management"], // operation's tag
        description: "Update a chapter. Note: 'phase' field is optional. Allowed values: 'easy', 'Amateur', 'Advanced'. Frontend handles validation.", // short desc
        operationId: "managerialChapterUpdate", // unique operation id
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
                $ref: "#/components/schemas/chapter", // todo input data model
              },
            },
          },
        },
        "responses": {
          "200": {
            "description": "Chapter updated successfully (phase preserved if not provided, defaults to 'easy' if empty)",
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
            "description": "Update Failed"
          }
        }
      },
}