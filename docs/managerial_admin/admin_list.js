module.exports = {
    get: {
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: ["Admin Management"],
        description: "List all admins and moderators",
        operationId: "adminList",
        parameters: [],
        responses: {
            "200": {
                description: "List of admins retrieved successfully",
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
                                    type: "array",
                                    items: {
                                        $ref: "#/components/schemas/admin"
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "400": {
                description: "Failed to fetch admins"
            },
            "403": {
                description: "Forbidden - Only admins can access"
            }
        }
    },
};

