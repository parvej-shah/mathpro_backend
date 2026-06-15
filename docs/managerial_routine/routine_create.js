module.exports = {
    post: {
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: ["Course Routine Management"],
        description: "Create a new course routine",
        operationId: "adminRoutineCreate",
        parameters: [
            {
                in: "path",
                name: "courseId",
                required: true,
                schema: {
                    type: "integer",
                },
                description: "Course ID for which to create routine",
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
                                example: 1,
                            },
                            routine_image_url: {
                                type: "string",
                                description: "S3 URL of the routine banner image",
                                example: "https://codervaimedia.s3.ap-south-1.amazonaws.com/routines/course-15-week-1.jpg",
                            },
                            week_start_date: {
                                type: "string",
                                format: "date",
                                description: "Start date of the week (YYYY-MM-DD)",
                                example: "2025-11-25",
                            },
                            week_end_date: {
                                type: "string",
                                format: "date",
                                description: "End date of the week (YYYY-MM-DD)",
                                example: "2025-12-01",
                            },
                            is_active: {
                                type: "boolean",
                                description: "Whether routine is active",
                                example: true,
                                default: true,
                            },
                        },
                    },
                },
            },
        },
        responses: {
            200: {
                description: "Routine created successfully",
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
                                        type: "object",
                                        properties: {
                                            id: {
                                                type: "integer",
                                                example: 1,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            400: {
                description: "Failed to create routine",
            },
        },
    },
};
