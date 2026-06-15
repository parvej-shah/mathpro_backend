module.exports = {
  post: {
    tags: ["Managerial Authentication"],
    description: "Request a password reset OTP by email",
    operationId: "forgotPassword",
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
        description: "Password reset OTP sent successfully",
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
                  example: "Password reset OTP sent successfully"
                }
              }
            }
          }
        }
      },
      "400": {
        description: "Request failed",
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
                  example: "No account found with this email"
                }
              }
            }
          }
        }
      }
    }
  }
};
