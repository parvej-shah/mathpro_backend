module.exports = {
    get: {
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: ["Course Routine Management"],
        description: "List all routines for a specific course",
        operationId: "adminRoutineListByCourse",
        parameters: [
            {
                in: "path",
                name: "courseId",
                required: true,
                schema: {
                    type: "integer",
                },
                description: "Course ID",
            },
        ],
        responses: {
            200: {
                description: "Course routines retrieved successfully",
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
                description: "Failed to retrieve course routines",
            },
        },
    },
};
