module.exports = {
    put: {
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: ["User Feedback"], // operation's tag
        description: "Update own feedback (User only)", // short desc
        operationId: "updateFeedback", // unique operation id
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
        requestBody: {
            content: {
                "application/json": {
                    schema: {
                        $ref: "#/components/schemas/feedback_update",
                    },
                },
            },
        },
        "responses": {
            "200": {
                "description": "Feedback updated successfully",
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
                                    "example": "Feedback updated successfully"
                                },
                                "data": {
                                    "$ref": "#/components/schemas/feedback_response"
                                }
                            }
                        }
                    }
                }
            },
            "400": {
                "description": "Validation failed"
            },
            "401": {
                "description": "Unauthorized - Missing or invalid authentication token"
            },
            "403": {
                "description": "Forbidden - User can only update their own feedback"
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
