module.exports = {
    post: {
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: ["User Feedback"], // operation's tag
        description: "Submit course feedback (User only)", // short desc
        operationId: "submitFeedback", // unique operation id
        parameters: [], // expected params
        requestBody: {
            // expected request body
            content: {
                // content-type
                "application/json": {
                    schema: {
                        $ref: "#/components/schemas/feedback_submission", // input data model
                    },
                },
            },
        },
        "responses": {
            "201": {
                "description": "Feedback submitted successfully",
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
                                    "example": "Feedback submitted successfully"
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
                "description": "Validation failed or duplicate feedback",
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "properties": {
                                "success": {
                                    "type": "boolean",
                                    "example": false
                                },
                                "error": {
                                    "type": "string",
                                    "example": "You have already submitted feedback for this course"
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
