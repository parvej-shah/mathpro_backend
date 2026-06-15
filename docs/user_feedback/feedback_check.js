module.exports = {
    get: {
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: ["User Feedback"], // operation's tag
        description: "Check if user has submitted feedback for a course", // short desc
        operationId: "checkFeedbackStatus", // unique operation id
        parameters: [
            {
                in: 'path',
                name: 'userId',
                required: true,
                description: 'User ID',
                schema: {
                    type: 'string',
                }
            },
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
                "description": "Feedback status retrieved successfully",
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
                                        "hasFeedback": {
                                            "type": "boolean",
                                            "example": true
                                        },
                                        "feedback": {
                                            "$ref": "#/components/schemas/feedback_response"
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
            "500": {
                "description": "Internal server error"
            }
        }
    },
}
