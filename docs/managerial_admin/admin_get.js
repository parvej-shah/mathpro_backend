module.exports = {
    get: {
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: ["Admin Management"],
        description: "Get single admin by ID",
        operationId: "adminGet",
        parameters: [
            {
                in: "path",
                name: "id",
                required: true,
                schema: {
                    type: "integer"
                },
                description: "Admin ID"
            }
        ],
        responses: {
            "200": {
                description: "Admin retrieved successfully",
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
                                    $ref: "#/components/schemas/admin"
                                }
                            }
                        }
                    }
                }
            },
            "400": {
                description: "Invalid admin ID"
            },
            "404": {
                description: "Admin not found"
            },
            "403": {
                description: "Forbidden - Only admins can access"
            }
        }
    },
};

