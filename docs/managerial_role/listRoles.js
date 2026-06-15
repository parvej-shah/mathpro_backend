module.exports = {
  "/admin/roles": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Managerial Role Management"],
      summary: "List all roles",
      description: "Get a list of all roles in the system with their permissions. Requires admin authentication.",
      operationId: "listRoles",
      responses: {
        200: {
          description: "Roles retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: {
                    type: "boolean",
                    example: true
                  },
                  data: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "integer", example: 1 },
                        name: { type: "string", example: "admin" },
                        display_name: { type: "string", example: "Administrator" },
                        description: { type: "string", example: "Full system access" },
                        permissions: {
                          type: "array",
                          items: { type: "string" },
                          example: ["user.read.all", "course.create.all", "role.manage.all"]
                        },
                        created_at: { type: "string", format: "date-time" },
                        updated_at: { type: "string", format: "date-time" }
                      }
                    }
                  },
                  count: {
                    type: "integer",
                    example: 5
                  }
                }
              }
            }
          }
        },
        401: {
          description: "Unauthorized - Invalid or missing token"
        },
        403: {
          description: "Forbidden - Insufficient permissions"
        },
        500: {
          description: "Internal server error"
        }
      }
    }
  }
};

