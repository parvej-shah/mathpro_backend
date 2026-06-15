module.exports = {
    get: {
        security: [], // Public endpoint
        tags: ["User Feedback"], // operation's tag
        description: "Get course average rating (Public endpoint)", // short desc
        operationId: "getCourseAverage", // unique operation id
        parameters: [
            {
                in: 'path',
                name: 'courseId',
                required: true,
                description: 'Course ID',
                schema: {
                    type: 'string',
                }
            }
        ],
        "responses": {
            "200": {
                "description": "Course average rating retrieved successfully",
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "properties": {
                                "success": {
                                    "type": "boolean",
                                    "example": true
                                },
                                "data": {
                                    "type": "object",
                                    "properties": {
                                        "courseId": {
                                            "type": "string",
                                            "example": "course-123"
                                        },
                                        "averageRating": {
                                            "type": "number",
                                            "format": "float",
                                            "example": 4.5
                                        },
                                        "totalFeedbacks": {
                                            "type": "integer",
                                            "example": 25
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "500": {
                "description": "Internal server error"
            }
        }
    },
}
