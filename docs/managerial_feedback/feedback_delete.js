module.exports = {
    delete: {
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: ["Admin Feedback"], // operation's tag
        description: "Delete any feedback (Admin only)", // short desc
        operationId: "deleteAnyFeedback", // unique operation id
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
                "description": "Forbidden - Admin access required"
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
