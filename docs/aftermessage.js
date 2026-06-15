module.exports = {
  paths: {
    "/user/aftermessage/{itemType}/{itemId}": {
      get: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["After-Purchase Message"],
        description:
          "Get after-purchase messages for a specific course or bundle",
        operationId: "userGetAfterMessages",
        parameters: [
          {
            in: "path",
            name: "itemType",
            required: true,
            description: "Type of item: 'course' or 'bundle'",
            schema: {
              type: "string",
              enum: ["course", "bundle"],
            },
            example: "bundle",
          },
          {
            in: "path",
            name: "itemId",
            required: true,
            description: "ID of the course or bundle",
            schema: {
              type: "integer",
            },
            example: 5,
          },
        ],
        responses: {
          200: {
            description: "Messages fetched successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },
                    data: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/afterMessage",
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "Invalid itemType or itemId",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      example: false,
                    },
                    error: {
                      type: "string",
                      example: "Invalid itemType. Must be 'course' or 'bundle'",
                    },
                  },
                },
              },
            },
          },
          401: {
            description: "Unauthorized - Missing or invalid auth token",
          },
          500: {
            description: "Internal server error",
          },
        },
      },
    },
    "/admin/aftermessage": {
      get: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["After-Purchase Message"],
        description: "Get all after-purchase messages (Admin only)",
        operationId: "adminGetAllAfterMessages",
        parameters: [],
        responses: {
          200: {
            description: "All messages fetched successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },
                    data: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/afterMessage",
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: "Unauthorized - Admin authentication required",
          },
          500: {
            description: "Internal server error",
          },
        },
      },
      post: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["After-Purchase Message"],
        description: "Create a new after-purchase message (Admin only)",
        operationId: "adminCreateAfterMessage",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/createAfterMessage",
              },
            },
          },
        },
        responses: {
          201: {
            description: "Message created successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },
                    data: {
                      $ref: "#/components/schemas/afterMessage",
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "Invalid input data",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      example: false,
                    },
                    error: {
                      type: "string",
                      example:
                        "At least one of course_ids or bundle_ids must be provided",
                    },
                  },
                },
              },
            },
          },
          401: {
            description: "Unauthorized - Admin authentication required",
          },
          500: {
            description: "Internal server error",
          },
        },
      },
    },
    "/admin/aftermessage/{id}": {
      put: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["After-Purchase Message"],
        description: "Update an after-purchase message (Admin only)",
        operationId: "adminUpdateAfterMessage",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            description: "ID of the message to update",
            schema: {
              type: "integer",
            },
            example: 1,
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/updateAfterMessage",
              },
            },
          },
        },
        responses: {
          200: {
            description: "Message updated successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },
                    data: {
                      $ref: "#/components/schemas/afterMessage",
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "Invalid input or message not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      example: false,
                    },
                    error: {
                      type: "string",
                      example: "Message not found",
                    },
                  },
                },
              },
            },
          },
          401: {
            description: "Unauthorized - Admin authentication required",
          },
          500: {
            description: "Internal server error",
          },
        },
      },
      delete: {
        security: [
          {
            bearerAuth: [],
          },
        ],
        tags: ["After-Purchase Message"],
        description: "Delete an after-purchase message (Admin only)",
        operationId: "adminDeleteAfterMessage",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            description: "ID of the message to delete",
            schema: {
              type: "integer",
            },
            example: 1,
          },
        ],
        responses: {
          200: {
            description: "Message deleted successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      example: true,
                    },
                    message: {
                      type: "string",
                      example: "Message deleted successfully",
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "Message not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: {
                      type: "boolean",
                      example: false,
                    },
                    error: {
                      type: "string",
                      example: "Message not found",
                    },
                  },
                },
              },
            },
          },
          401: {
            description: "Unauthorized - Admin authentication required",
          },
          500: {
            description: "Internal server error",
          },
        },
      },
    },
  },
};
