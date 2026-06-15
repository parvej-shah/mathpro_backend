module.exports = {
    get: {
        security: [
            {
              bearerAuth: [],
            },
          ],
        tags: ["Contact Form"], // operation's tag
        description: "Get a single contact form submission by ID (Admin only)", // short desc
        operationId: "contactGet", // unique operation id
        parameters: [
          {
            in: 'path',
            name: 'id',
            required: true,
            description: 'Submission ID (numeric, without "contact_" prefix)',
            schema: {
              type: 'integer'
            }
          }
        ], // expected params
        "responses": {
          "200": {
            "description": "Contact submission retrieved successfully",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true
                    },
                    "data": {
                      "$ref": "#/components/schemas/contact_submission_detail"
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Invalid submission ID"
          },
          "401": {
            "description": "Unauthorized - Missing or invalid authentication token"
          },
          "403": {
            "description": "Forbidden - Insufficient permissions"
          },
          "404": {
            "description": "Submission not found"
          },
          "500": {
            "description": "Internal server error"
          }
        }
      },
}

