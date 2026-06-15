module.exports = {
    get: {
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: ["User Management"],
        description: "List all regular users with pagination and search",
        operationId: "adminUserList",
        parameters: [
            {
                in: "query",
                name: "page",
                schema: {
                    type: "integer",
                    default: 1
                },
                description: "Page number"
            },
            {
                in: "query",
                name: "limit",
                schema: {
                    type: "integer",
                    default: 10
                },
                description: "Items per page"
            },
            {
                in: "query",
                name: "search",
                schema: {
                    type: "string"
                },
                description: "Search by name, email, or phone"
            }
        ],
        responses: {
            "200": {
                description: "List of users retrieved successfully",
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            properties: {
                                success: {
                                    type: "boolean",
                                    example: true
                                },
                                data: {
                                    type: "object",
                                    properties: {
                                        users: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    id: { type: "integer" },
                                                    name: { type: "string" },
                                                    email: { type: "string" },
                                                    phone: { type: "string" },
                                                    type: { type: "integer", example: 3 },
                                                    created_at: { type: "string", format: "date-time" }
                                                }
                                            }
                                        },
                                        pagination: {
                                            type: "object",
                                            properties: {
                                                total: { type: "integer" },
                                                page: { type: "integer" },
                                                limit: { type: "integer" },
                                                pages: { type: "integer" }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "403": {
                description: "Forbidden - Only admins can access"
            }
        }
    },
};
