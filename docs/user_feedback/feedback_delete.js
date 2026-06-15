module.exports = {
    delete: {
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: ["User Feedback"], // operation's tag
        description: "Delete own feedback (User only)", // short desc
        operationId: "deleteFeedback", // unique operation id
        parameters: [
            {
                in: 'path',
                name: 'feedbackId',
                required: true,
                description: 'Feedback ID',
                schema: {
                    type: 'string',
                }
            }
        ],
        "responses": {
            "200": {
                "description": "Feedback deleted successfully",
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "properties": {
                                "success": {
                                    "type": "boolean",
                                    "example": true
                                },
                                "message": {
                                    "type": "string",
                                    "example": "Feedback deleted successfully"
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
                "description": "Forbidden - User can only delete their own feedback"
            },
            "404": {
                "description": "Feedback not found"
            },
            "500": {
                "description": "Internal server error"
            }
        }
    },
}
