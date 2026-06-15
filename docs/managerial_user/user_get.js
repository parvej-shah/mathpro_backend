module.exports = {
    get: {
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: ["User Management"],
        description: "Get user details by ID",
        operationId: "adminUserGet",
        parameters: [
            {
                in: "path",
                name: "id",
                required: true,
                schema: {
                    type: "integer"
                },
                description: "User ID"
            }
        ],
        responses: {
            "200": {
                description: "User details retrieved successfully",
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
                                        phone: { type: "string" },
                                        type: { type: "integer", example: 3 },
                                        profile: { type: "object" },
                                        enrollment: {
                                            type: "object",
                                            properties: {
                                                courses: { type: "integer" },
                                                bundles: { type: "integer" }
                                            }
                                        },
                                        activity: {
                                            type: "object",
                                            properties: {
                                                submissions: { type: "integer" }
                                            }
                                        },
                                        created_at: { type: "string", format: "date-time" }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "404": {
                description: "User not found"
            }
        }
    },
};
