module.exports = {
  post: {
    tags: ["Managerial Authentication"],
    description: "Reset password using an email OTP",
    operationId: "resetPassword",
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
              },
              otp: {
                type: "string",
                description: "6-digit OTP code",
                example: "123456"
              },
              newPassword: {
                type: "string",
                description: "New password",
                example: "NewSecurePass123"
              }
            },
            required: ["contact", "otp", "newPassword"]
          }
        }
      }
    },
    responses: {
      "200": {
        description: "Password reset successful",
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
                  example: "Password reset successful"
                }
              }
            }
          }
        }
      },
      "400": {
        description: "Password reset failed",
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
                  example: "Invalid or expired OTP"
                }
              }
            }
          }
        }
      }
    }
  }
};
