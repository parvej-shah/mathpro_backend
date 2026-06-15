module.exports = {
  "/admin/roles/{id}": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Managerial Role Management"],
      summary: "Get a single role",
      description: "Retrieve details of a specific role by ID. Requires admin authentication.",
      operationId: "getRole",
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
          description: "Role retrieved successfully",
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
                }
              }
            }
          }
        },
        400: {
          description: "Invalid role ID",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Invalid role ID" },
                  error: { type: "string", example: "INVALID_ID" }
                }
              }
            }
          }
        },
        404: {
          description: "Role not found",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Role not found" },
                  error: { type: "string", example: "NOT_FOUND" }
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

