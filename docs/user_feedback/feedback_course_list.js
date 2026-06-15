module.exports = {
    get: {
        security: [], // Public endpoint
        tags: ["User Feedback"], // operation's tag
        description: "Get course feedbacks with pagination (Public endpoint)", // short desc
        operationId: "getCourseFeedbacks", // unique operation id
        parameters: [
            {
                in: 'path',
                name: 'courseId',
                required: true,
                description: 'Course ID',
                schema: {
                    type: 'string',
                }
            },
            {
                in: 'query',
                name: 'page',
                required: false,
                description: 'Page number (default: 1)',
                schema: {
                    type: 'integer',
                    default: 1,
                    minimum: 1
                }
            },
            {
                in: 'query',
                name: 'limit',
                required: false,
                description: 'Number of results per page (default: 10)',
                schema: {
                    type: 'integer',
                    default: 10,
                    minimum: 1,
                    maximum: 100
                }
            }
        ],
        "responses": {
            "200": {
                "description": "Course feedbacks retrieved successfully",
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
                                        "feedbacks": {
                                            "type": "array",
                                            "items": {
                                                "$ref": "#/components/schemas/feedback_response"
                                            }
                                        },
                                        "pagination": {
                                            "type": "object",
                                            "properties": {
                                                "currentPage": {
                                                    "type": "integer",
                                                    "example": 1
                                                },
                                                "totalPages": {
                                                    "type": "integer",
                                                    "example": 3
                                                },
                                                "totalFeedbacks": {
                                                    "type": "integer",
                                                    "example": 25
                                                },
                                                "limit": {
                                                    "type": "integer",
                                                    "example": 10
                                                }
                                            }
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
