module.exports = {
  "/admin/roles/permissions": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Managerial Role Management"],
      summary: "Get list of permissions",
      description:
        "Returns the list of assignable permissions (resource.manage.all only). Use this when building the Create role or Edit role form. Response includes a flat list (data.all) and a grouped-by-resource list (data.by_resource). Requires admin authentication (and role.manage.all when permission-based auth is enforced).",
      operationId: "getPermissionsList",
      responses: {
        200: {
          description: "Permissions list retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      all: {
                        type: "array",
                        items: { type: "string" },
                        description: "Flat array of all permission strings. Use for a single list of checkboxes or searchable list.",
                        example: [
                          "user.manage.all",
                          "course.manage.all",
                          "role.manage.all"
                        ]
                      },
                      by_resource: {
                        type: "object",
                        additionalProperties: {
                          type: "array",
                          items: { type: "string" }
                        },
                        description: "Permissions grouped by resource (e.g. USER, COURSE, ROLE). Use to show permissions in sections in the UI.",
                        example: {
                          USER: ["user.create.all", "user.read.all", "user.manage.all"],
                          COURSE: ["course.create.all", "course.manage.all"],
                          ROLE: ["role.manage.all"]
                        }
                      }
                    }
                  },
                  count: {
                    type: "integer",
                    description: "Total number of permissions (equals data.all.length). Only resource.manage.all permissions are returned.",
                    example: 25
                  }
                }
              }
            }
          }
        },
        401: {
          description: "Unauthorized - Missing or invalid token"
        },
        403: {
          description: "Forbidden - Not admin or missing role.manage.all"
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string" },
                  error: { type: "string", example: "SERVER_ERROR" }
                }
              }
            }
          }
        }
      }
    }
  }
};
