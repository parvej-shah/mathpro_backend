module.exports = {
    delete: {
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: ["Course Routine Management"],
        description: "Delete a course routine",
        operationId: "adminRoutineDelete",
        parameters: [
            {
                in: "path",
                name: "id",
                required: true,
                schema: {
                    type: "integer",
                },
                description: "Routine ID to delete",
            },
        ],
        responses: {
            200: {
                description: "Routine deleted successfully",
            },
            400: {
                description: "Failed to delete routine",
            },
        },
    },
};
