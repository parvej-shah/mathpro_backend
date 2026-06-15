module.exports = {
  "/admin/roles/{id}": {
    delete: {
      security: [{ bearerAuth: [] }],
      tags: ["Managerial Role Management"],
      summary: "Delete a role",
      description: "Delete a custom role. System roles (admin, moderator, student, teacher) cannot be deleted. Roles assigned to users cannot be deleted. Requires admin authentication.",
      operationId: "deleteRole",
      parameters: [
        {
          in: "path",
          name: "id",
          required: true,
          schema: {
            type: "integer"
          },
          description: "Role ID"
        }
      ],
      responses: {
        200: {
          description: "Role deleted successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "Role deleted successfully" }
                }
              }
            }
          }
        },
        400: {
          description: "Cannot delete system role, role in use, or role not found",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { 
                    type: "string", 
                    example: "Cannot delete system roles" 
                  },
                  error: { type: "string", example: "DELETE_FAILED" }
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
