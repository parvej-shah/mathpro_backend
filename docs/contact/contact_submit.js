module.exports = {
    post: {
        security: [], // Public endpoint - no authentication required
        tags: ["Contact Form"], // operation's tag
        description: "Submit contact form inquiry (Public endpoint with rate limiting: 3 requests per hour per IP)", // short desc
        operationId: "contactSubmit", // unique operation id
        parameters: [], // expected params
        requestBody: {
          // expected request body
          content: {
            // content-type
            "application/json": {
              schema: {
                $ref: "#/components/schemas/contact_submission", // input data model
              },
            },
          },
        },
        "responses": {
          "201": {
            "description": "Contact form submitted successfully",
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
                      "example": "Thank you for your inquiry. We will contact you soon."
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "id": {
                          "type": "string",
                          "example": "contact_123"
                        },
                        "submittedAt": {
                          "type": "string",
                          "format": "date-time",
                          "example": "2024-01-15T10:30:00Z"
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Validation failed",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": false
                    },
                    "error": {
                      "type": "string",
                      "example": "Validation failed"
                    },
                    "errors": {
                      "type": "object",
                      "example": {
                        "email": "Invalid email format",
                        "whatsappNumber": "Invalid phone number format. Please include country code (e.g., +880 1712 345678)"
                      }
                    },
                    "message": {
                      "type": "string",
                      "example": "Please check your input and try again."
                    }
                  }
                }
              }
            }
          },
          "429": {
            "description": "Rate limit exceeded (3 requests per hour per IP)",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": false
                    },
                    "error": {
                      "type": "string",
                      "example": "Too many requests"
                    },
                    "message": {
                      "type": "string",
                      "example": "You have exceeded the maximum number of submissions. Please try again later."
                    },
                    "retryAfter": {
                      "type": "string",
                      "example": "1 hour"
                    }
                  }
                }
              }
            }
          },
          "500": {
            "description": "Internal server error"
          }
        }
      },
}

