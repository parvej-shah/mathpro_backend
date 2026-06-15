module.exports = {
    get: {
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: ["Course Routine Management"],
        description: "Get a single course routine by ID",
        operationId: "adminRoutineGet",
        parameters: [
            {
                in: "path",
                name: "id",
                required: true,
                schema: {
                    type: "integer",
                },
                description: "Routine ID",
            },
        ],
        responses: {
            200: {
                description: "Routine retrieved successfully",
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
                                        $ref: "#/components/schemas/routine",
                                    },
                                },
                            },
                        },
                    },
                },
            },
            400: {
                description: "Failed to retrieve routine",
            },
        },
    },
};
