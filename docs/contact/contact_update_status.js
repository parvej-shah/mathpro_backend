module.exports = {
    put: {
        security: [
            {
              bearerAuth: [],
            },
          ],
        tags: ["Contact Form"], // operation's tag
        description: "Update contact form submission status (Admin only)", // short desc
        operationId: "contactUpdateStatus", // unique operation id
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
        requestBody: {
          // expected request body
          content: {
            // content-type
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: {
                  status: {
                    type: "string",
                    enum: ["new", "read", "replied"],
                    description: "New status for the submission",
                    example: "read"
                  }
                }
              },
            },
          },
        },
        "responses": {
          "200": {
            "description": "Status updated successfully",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true
                    },
                    "message": {
                      "type": "string",
                      "example": "Status updated successfully"
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "id": {
                          "type": "string",
                          "example": "contact_123"
                        },
                        "status": {
                          "type": "string",
                          "enum": ["new", "read", "replied"],
                          "example": "read"
                        },
                        "updatedAt": {
                          "type": "string",
                          "format": "date-time",
                          "example": "2024-01-15T11:00:00Z"
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Invalid submission ID or status value"
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

