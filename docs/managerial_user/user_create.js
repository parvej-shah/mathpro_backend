module.exports = {
    post: {
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: ["User Management"],
        description: "Create a new user",
        operationId: "adminUserCreate",
        requestBody: {
            required: true,
            content: {
                "application/json": {
                    schema: {
                        type: "object",
                        required: ["name"],
                        properties: {
                            name: {
                                type: "string",
                                example: "New User"
                            },
                            email: {
                                type: "string",
                                format: "email",
                                example: "user@example.com"
                            },
                            phone: {
                                type: "string",
                                example: "01712345678"
                            }
                        }
                    }
                }
            }
        },
        responses: {
            "201": {
                description: "User created successfully",
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
                                        email: { type: "string" },
                                        login: { type: "string" }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "400": {
                description: "Invalid input or duplicate email/phone"
            }
        }
    },
};
