module.exports = {
    put: {
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: ["Course Routine Management"],
        description: "Update an existing course routine",
        operationId: "adminRoutineUpdate",
        parameters: [
            {
                in: "path",
                name: "id",
                required: true,
                schema: {
                    type: "integer",
                },
                description: "Routine ID to update",
            },
        ],
        requestBody: {
            content: {
                "application/json": {
                    schema: {
                        type: "object",
                        required: ["week_number", "routine_image_url", "week_start_date", "week_end_date"],
                        properties: {
                            week_number: {
                                type: "integer",
                                description: "Week number (must be positive)",
                                example: 2,
                            },
                            routine_image_url: {
                                type: "string",
                                description: "S3 URL of the routine banner image",
                                example: "https://Math Promedia.s3.ap-south-1.amazonaws.com/routines/course-15-week-2.jpg",
                            },
                            week_start_date: {
                                type: "string",
                                format: "date",
                                description: "Start date of the week (YYYY-MM-DD)",
                                example: "2025-12-02",
                            },
                            week_end_date: {
                                type: "string",
                                format: "date",
                                description: "End date of the week (YYYY-MM-DD)",
                                example: "2025-12-08",
                            },
                            is_active: {
                                type: "boolean",
                                description: "Whether routine is active",
                                example: true,
                            },
                        },
                    },
                },
            },
        },
        responses: {
            200: {
                description: "Routine updated successfully",
            },
            400: {
                description: "Failed to update routine",
            },
        },
    },
};
