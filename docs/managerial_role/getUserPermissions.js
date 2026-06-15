module.exports = {
  "/admin/roles/users/{userId}/permissions": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Managerial Role Management"],
      summary: "Get user's permissions",
      description: "Retrieve all aggregated permissions for a user from all their assigned roles. Duplicates are automatically removed. Requires admin authentication.",
      operationId: "getUserPermissions",
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
      responses: {
        200: {
          description: "User permissions retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "array",
                    items: { type: "string" },
                    example: [
                      "user.read.all",
                      "course.create.all",
                      "module.create.all",
                      "role.manage.all"
                    ]
                  },
                  count: { type: "integer", example: 23 }
                }
              }
            }
          }
        },
        400: {
          description: "Invalid user ID or error fetching permissions",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "Invalid user ID" },
                  error: { type: "string", example: "INVALID_USER_ID" }
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

