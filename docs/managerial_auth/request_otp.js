module.exports = {
  post: {
    tags: ["Managerial Authentication"],
    description: "Request a registration OTP by email",
    operationId: "requestOTP",
    parameters: [],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              contact: {
                type: "string",
                description: "Email address",
                example: "user@example.com"
              }
            },
            required: ["contact"]
          }
        }
      }
    },
    responses: {
      "200": {
        description: "OTP sent successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: {
                  type: "boolean",
                  example: true
                },
                message: {
                  type: "string",
                  example: "OTP sent to your email"
                }
              }
            }
          }
        }
      },
      "400": {
        description: "Invalid contact format",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: {
                  type: "boolean",
                  example: false
                },
                error: {
                  type: "string",
                  example: "Invalid email format"
                }
              }
            }
          }
        }
      }
    }
  }
};
