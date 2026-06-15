module.exports = {
  "/admin/roles/{id}": {
    put: {
      security: [{ bearerAuth: [] }],
      tags: ["Managerial Role Management"],
      summary: "Update a role",
      description: "Update an existing role's display name, description, or permissions. System roles (admin, moderator, student, teacher) cannot be modified. Requires admin authentication.",
      operationId: "updateRole",
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
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Role name (cannot be changed for system roles)",
                  example: "content_creator"
                },
                display_name: {
                  type: "string",
                  description: "Human-readable role name",
                  example: "Senior Content Creator"
                },
                description: {
                  type: "string",
                  description: "Role description",
                  example: "Can create, manage, and publish course content"
                },
                permissions: {
                  type: "array",
                  items: { type: "string" },
                  description: "Array of permission strings",
                  example: ["course.create.all", "module.create.all", "content.publish.all"]
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: "Role updated successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "Role updated successfully" },
                  data: {
                    type: "object",
                    properties: {
                      id: { type: "integer" },
                      name: { type: "string" },
                      display_name: { type: "string" },
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
          description: "Validation error, system role protection, or role not found",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { 
                    type: "string", 
                    example: "Cannot modify system roles"
                  },
                  error: { type: "string", example: "UPDATE_FAILED" }
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
