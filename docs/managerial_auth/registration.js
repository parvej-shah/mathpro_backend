module.exports = {
    post: {
        tags: ["Managerial Authentication"], // operation's tag
        description: "Register a regular user with email and OTP", // short desc
        operationId: "managerialRegister", // unique operation id
        parameters: [], // expected params
        requestBody: {
          // expected request body
          content: {
            // content-type
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "login", "password", "otp"],
                properties: {
                  name: {
                    type: "string",
                    example: "Jane Doe"
                  },
                  login: {
                    type: "string",
                    description: "Email address",
                    example: "jane@example.com"
                  },
                  password: {
                    type: "string",
                    example: "SecurePass123"
                  },
                  otp: {
                    type: "string",
                    example: "123456"
                  }
                }
              },
            },
          },
        },
        "responses": {
          "201": {
            "description": "Registration Successful",
            "schema": {
              "type": "object",
              "properties": {
                "success": {
                  "type": "boolean"
                }
              }
            }
          },
          "400": {
            "description": "Registration Failed",
            "schema": {
              "type": "object",
              "properties": {
                "success": {
                  "type": "boolean"
                }
              }
            }
          }
        }
      },
}
