module.exports = {
    get: {
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: ["Admin Feedback"], // operation's tag
        description: "Get all feedbacks with filtering and pagination (Admin only)", // short desc
        operationId: "getAllFeedbacks", // unique operation id
        parameters: [
            {
                in: 'query',
                name: 'courseId',
                required: false,
                description: 'Filter by course ID',
                schema: {
                    type: 'string',
                }
            },
            {
                in: 'query',
                name: 'rating',
                required: false,
                description: 'Filter by rating (1-5)',
                schema: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 5
                }
            },
            {
                in: 'query',
                name: 'category',
                required: false,
                description: 'Filter by category',
                schema: {
                    type: 'string',
                    enum: ['content', 'instructor', 'platform', 'course', 'other']
                }
            },
            {
                in: 'query',
                name: 'startDate',
                required: false,
                description: 'Filter by start date (YYYY-MM-DD)',
                schema: {
                    type: 'string',
                    format: 'date'
                }
            },
            {
                in: 'query',
                name: 'endDate',
                required: false,
                description: 'Filter by end date (YYYY-MM-DD)',
                schema: {
                    type: 'string',
                    format: 'date'
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
                description: 'Number of results per page (default: 50)',
                schema: {
                    type: 'integer',
                    default: 50,
                    minimum: 1,
                    maximum: 100
                }
            }
        ],
        "responses": {
            "200": {
                "description": "Feedbacks retrieved successfully",
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
                                                    "example": 5
                                                },
                                                "totalFeedbacks": {
                                                    "type": "integer",
                                                    "example": 250
                                                },
                                                "limit": {
                                                    "type": "integer",
                                                    "example": 50
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
            "401": {
                "description": "Unauthorized - Missing or invalid authentication token"
            },
            "403": {
                "description": "Forbidden - Admin access required"
            },
            "500": {
                "description": "Internal server error"
            }
        }
    },
}
