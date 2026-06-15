module.exports = {
    get: {
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: ["Admin Feedback"], // operation's tag
        description: "Export feedbacks as CSV or JSON (Admin only)", // short desc
        operationId: "exportFeedbacks", // unique operation id
        parameters: [
            {
                in: 'query',
                name: 'format',
                required: false,
                description: 'Export format (default: json)',
                schema: {
                    type: 'string',
                    enum: ['csv', 'json'],
                    default: 'json'
                }
            },
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
            }
        ],
        "responses": {
            "200": {
                "description": "Feedbacks exported successfully",
                "content": {
                    "text/csv": {
                        "schema": {
                            "type": "string",
                            "example": "id,course_id,user_id,rating,comment,category,created_at\nfeedback-1,course-123,user-456,5,Great course!,content,2024-01-15"
                        }
                    },
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "properties": {
                                "success": {
                                    "type": "boolean",
                                    "example": true
                                },
                                "data": {
                                    "type": "array",
                                    "items": {
                                        "$ref": "#/components/schemas/feedback_response"
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
