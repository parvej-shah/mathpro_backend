module.exports = {
    post: {
        tags: ["Managerial Authentication"], // operation's tag
        description: "Login with email and password", // short desc
        operationId: "managerialLogin", // unique operation id
        parameters: [], // expected params
        requestBody: {
          // expected request body
          content: {
            // content-type
            "application/json": {
              schema: {
                type: "object",
                required: ["login", "password"],
                properties: {
                  login: {
                    type: "string",
                    description: "Email address",
                    example: "jane@example.com"
                  },
                  password: {
                    type: "string",
                    example: "SecurePass123"
                  }
                }
              },
            },
          },
        },
        "responses": {
          "200": {
            "description": "Login Successful",
            "schema": {
              "type": "object",
              "properties": {
                "success": {
                  "type": "boolean"
                },
                "token": {
                    "type": "string"
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
