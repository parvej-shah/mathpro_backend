module.exports = {
    patch: {
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: ["Course Routine Management"],
        description: "Toggle active status of a course routine",
        operationId: "adminRoutineToggleActive",
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
        requestBody: {
            content: {
                "application/json": {
                    schema: {
                        type: "object",
                        required: ["is_active"],
                        properties: {
                            is_active: {
                                type: "boolean",
                                description: "New active status",
                                example: false,
                            },
                        },
                    },
                },
            },
        },
        responses: {
            200: {
                description: "Active status updated successfully",
            },
            400: {
                description: "Failed to update active status",
            },
        },
    },
};
