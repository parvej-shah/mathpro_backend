module.exports = {
  "/admin/roles/users/{userId}/roles": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Managerial Role Management"],
      summary: "Get user's roles",
      description: "Retrieve all roles assigned to a specific user, including assignment audit information. Requires admin authentication.",
      operationId: "getUserRoles",
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
          description: "User roles retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "integer", example: 1 },
                        name: { type: "string", example: "admin" },
                        display_name: { type: "string", example: "Administrator" },
                        description: { type: "string" },
                        permissions: {
                          type: "array",
                          items: { type: "string" }
                        },
                        assigned_at: { 
                          type: "string", 
                          format: "date-time",
                          description: "When the role was assigned"
                        },
                        updated_by: { 
                          type: "integer",
                          description: "ID of admin who assigned/modified the role"
                        },
                        updated_at: { 
                          type: "string", 
                          format: "date-time",
                          description: "Last modification time"
                        }
                      }
                    }
                  },
                  count: { type: "integer", example: 2 }
                }
              }
            }
          }
        },
        400: {
          description: "Invalid user ID or error fetching roles",
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

