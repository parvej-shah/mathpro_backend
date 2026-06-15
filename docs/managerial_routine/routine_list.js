module.exports = {
    get: {
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: ["Course Routine Management"],
        description: "List all course routines (filtered by user permissions)",
        operationId: "adminRoutineList",
        parameters: [],
        responses: {
            200: {
                description: "Routines retrieved successfully",
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
                description: "Failed to retrieve routines",
            },
        },
    },
};
