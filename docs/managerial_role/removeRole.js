module.exports = {
  "/admin/roles/users/{userId}/roles/{roleId}": {
    delete: {
      security: [{ bearerAuth: [] }],
      tags: ["Managerial Role Management"],
      summary: "Remove role from user",
      description: "Remove a role assignment from a user. Tracks who made the removal. Requires admin authentication.",
      operationId: "removeRole",
      parameters: [
        {
          in: "path",
          name: "userId",
          required: true,
          schema: {
            type: "integer"
          },
          description: "User ID"
        },
        {
          in: "path",
          name: "roleId",
          required: true,
          schema: {
            type: "integer"
          },
          description: "Role ID to remove"
        }
      ],
      responses: {
        200: {
          description: "Role removed successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "Role removed successfully" },
                  data: {
                    type: "object",
                    properties: {
                      user_id: { type: "integer", example: 123 },
                      role_id: { type: "integer", example: 3 }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: "Invalid user/role ID or user doesn't have the role",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { 
                    type: "string", 
                    example: "User does not have this role" 
                  },
                  error: { type: "string", example: "REMOVE_FAILED" }
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

