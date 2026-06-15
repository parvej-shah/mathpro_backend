module.exports = {
    delete: {
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: ["User Management"],
        description: "Delete a user (soft or hard delete)",
        operationId: "adminUserDelete",
        parameters: [
            {
                in: "path",
                name: "id",
                required: true,
                schema: { type: "integer" },
                description: "User ID"
            },
            {
                in: "query",
                name: "hardDelete",
                schema: { type: "boolean", default: false },
                description: "If true, permanently deletes the user"
            }
        ],
        responses: {
            "200": {
                description: "User deleted successfully",
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            properties: {
                                success: { type: "boolean", example: true },
                                message: { type: "string", example: "User deactivated successfully" }
                            }
                        }
                    }
                }
            },
            "404": { description: "User not found" }
        }
    },
};
