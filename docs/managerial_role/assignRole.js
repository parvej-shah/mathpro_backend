module.exports = {
  "/admin/roles/users/{userId}/roles": {
    post: {
      security: [{ bearerAuth: [] }],
      tags: ["Managerial Role Management"],
      summary: "Assign role to user",
      description: "Assign a role to a user. Prevents duplicate assignments. Tracks who made the assignment. Requires admin authentication.",
      operationId: "assignRole",
      parameters: [
        {
          in: "path",
          name: "userId",
          required: true,
          schema: {
            type: "integer"
          },
          description: "User ID"
        }
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["role_id"],
              properties: {
                role_id: {
                  type: "integer",
                  description: "Role ID to assign",
                  example: 3
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: "Role assigned successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "Role assigned successfully" },
                  data: {
                    type: "object",
                    properties: {
                      user_id: { type: "integer", example: 123 },
                      role_id: { type: "integer", example: 3 },
                      updated_by: { type: "integer", example: 1 },
                      created_at: { type: "string", format: "date-time" },
                      updated_at: { type: "string", format: "date-time" }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: "Invalid user/role ID, role not found, or duplicate assignment",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { 
                    type: "string", 
                    example: "User already has this role" 
                  },
                  error: { type: "string", example: "ASSIGN_FAILED" }
                }
              }
            }
          }
        },
        401: {
          description: "Unauthorized"
        },
        403: {
          description: "Forbidden"
        },
        500: {
          description: "Internal server error"
        }
      }
    }
  }
};

