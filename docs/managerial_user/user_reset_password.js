module.exports = {
    post: {
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: ["User Management"],
        description: "Reset user password",
        operationId: "adminUserResetPassword",
        parameters: [
            {
                in: "path",
                name: "id",
                required: true,
                schema: { type: "integer" },
                description: "User ID"
            }
        ],
        responses: {
            "200": {
                description: "Password reset successfully",
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            properties: {
                                success: { type: "boolean", example: true },
                                data: {
                                    type: "object",
                                    properties: {
                                        id: { type: "integer" },
                                        email: { type: "string" },
                                        login: { type: "string" }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "404": { description: "User not found" }
        }
    },
};
