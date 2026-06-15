module.exports = {
    get: {
        security: [
            {
              bearerAuth: [],
            },
          ],
        tags: ["Contact Form"], // operation's tag
        description: "Get all contact form submissions (Admin only)", // short desc
        operationId: "contactList", // unique operation id
        parameters: [
          {
            in: 'query',
            name: 'status',
            required: false,
            description: 'Filter by status (new, read, replied)',
            schema: {
              type: 'string',
              enum: ['new', 'read', 'replied']
            }
          },
          {
            in: 'query',
            name: 'limit',
            required: false,
            description: 'Number of results per page (default: 50)',
            schema: {
              type: 'integer',
              default: 50,
              minimum: 1,
              maximum: 100
            }
          },
          {
            in: 'query',
            name: 'offset',
            required: false,
            description: 'Pagination offset (default: 0)',
            schema: {
              type: 'integer',
              default: 0,
              minimum: 0
            }
          }
        ], // expected params
        "responses": {
          "200": {
            "description": "List of contact submissions retrieved successfully",
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
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/contact_submission_response"
                      }
                    },
                    "pagination": {
                      "type": "object",
                      "properties": {
                        "total": {
                          "type": "integer",
                          "example": 100
                        },
                        "limit": {
                          "type": "integer",
                          "example": 50
                        },
                        "offset": {
                          "type": "integer",
                          "example": 0
                        },
                        "hasMore": {
                          "type": "boolean",
                          "example": true
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "Unauthorized - Missing or invalid authentication token"
          },
          "403": {
            "description": "Forbidden - Insufficient permissions"
          },
          "500": {
            "description": "Internal server error"
          }
        }
      },
}

