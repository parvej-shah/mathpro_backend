module.exports = {
  "/admin/roles": {
    post: {
      security: [{ bearerAuth: [] }],
      tags: ["Managerial Role Management"],
      summary: "Create a new role",
      description: "Create a new custom role with specified permissions. System roles (admin, student, teacher) are pre-created. Requires admin authentication with role.manage.all permission.",
      operationId: "createRole",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["name", "display_name"],
              properties: {
                name: {
                  type: "string",
                  description: "Unique role identifier (lowercase, no spaces)",
                  example: "content_creator"
                },
                display_name: {
                  type: "string",
                  description: "Human-readable role name",
                  example: "Content Creator"
                },
                description: {
                  type: "string",
                  description: "Role description",
                  example: "Can create and manage course content"
                },
                permissions: {
                  type: "array",
                  items: { type: "string" },
                  description: "Array of permission strings",
                  example: ["course.create.all", "module.create.all", "content.create.all"]
                }
              }
            }
          }
        }
      },
      responses: {
        201: {
          description: "Role created successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "Role created successfully" },
                  data: {
                    type: "object",
                    properties: {
                      id: { type: "integer", example: 6 },
                      name: { type: "string", example: "content_creator" },
                      display_name: { type: "string", example: "Content Creator" },
                      description: { type: "string" },
                      permissions: { type: "array", items: { type: "string" } },
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
          description: "Validation error or duplicate role",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { 
                    type: "string", 
                    example: "Role name already exists"
                  },
                  error: { type: "string", example: "CREATE_FAILED" }
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

