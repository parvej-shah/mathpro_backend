module.exports = {
    put: {
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: ["User Management"],
        description: "Update user details",
        operationId: "adminUserUpdate",
        parameters: [
            {
                in: "path",
                name: "id",
                required: true,
                schema: { type: "integer" },
                description: "User ID"
            }
        ],
        requestBody: {
            required: true,
            content: {
                "application/json": {
                    schema: {
                        type: "object",
                        properties: {
                            name: { type: "string" },
                            email: { type: "string", format: "email" },
                            phone: { type: "string" }
                        }
                    }
                }
            }
        },
        responses: {
            "200": {
                description: "User updated successfully",
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
                                        name: { type: "string" },
                                        email: { type: "string" }
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
