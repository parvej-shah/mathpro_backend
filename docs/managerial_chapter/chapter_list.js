module.exports = {
    get: {
      security: [
        {
          bearerAuth: [],
        },
      ],
        tags: ["Chapter Management"], // operation's tag
        description: "List of chapters", // short desc
        operationId: "managerialChapterList", // unique operation id
        parameters: [{
          in:'path',
          name:'id',
          required:true,
          description:'Course id of the chapter you want to create'
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
            "description": "List of chapters including phase field",
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
                          id: { type: "integer", example: 10 },
                          title: { type: "string", example: "Chapter 1" },
                          serial: { type: "integer", example: 1 },
                          is_free: { type: "boolean", example: false },
                          is_live: { type: "boolean", example: true },
                          phase: {
                            type: "string",
                            example: "easy",
                            description: "Chapter phase (easy, Amateur, Advanced). Default: 'easy'",
                            enum: ["easy", "Amateur", "Advanced"]
                          },
                          chips_list: { type: "array", items: { type: "string" } },
                          course_id: { type: "integer", example: 5 }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Failed"
          }
        }
      },
}