module.exports = {
    put: {
        tags: ["Managerial Authentication"],
        description: "Update the authenticated user's profile in the managerial_auth table",
        operationId: "managerialSetProfile",
        parameters: [
            {
                in: "header",
                name: "Authorization",
                schema: {
                    type: "string",
                    example: "Bearer eyJhbGciOiJIUzI1NiIs..."
                },
                required: true,
                description: "JWT token for authentication"
            }
        ],
        requestBody: {
            required: true,
            content: {
                "application/json": {
                    schema: {
                        type: "object",
                        required: ["name", "cf_handle", "profile"],
                        properties: {
                            "name": {
                                "type": "string",
                                "example": "John Doe",
                                "description": "Full name of the user (required)"
                            },
                            "cf_handle": {
                                "type": "string",
                                "example": "john_cf",
                                "description": "Codeforces handle (required)"
                            },
                            "profile": {
                                "type": "object",
                                "example": {
                                    "bio": "Senior Software Engineer",
                                    "avatar": "https://example.com/avatar.jpg",
                                    "location": "Bangladesh",
                                    "experience": "5 years"
                                },
                                "description": "Custom JSON object for flexible profile data. Can contain any properties needed by your application (required)"
                            }
                        }
                    }
                }
            }
        },
        "responses": {
            "200": {
                "description": "Profile updated successfully",
                "content": {
                    "application/json": {
                        schema: {
                            type: "object",
                            properties: {
                                "success": {
                                    "type": "boolean",
                                    "example": true
                                },
                                "message": {
                                    "type": "string",
                                    "example": "Profile updated successfully"
                                },
                                "rowCount": {
                                    "type": "integer",
                                    "example": 1,
                                    "description": "Number of rows affected"
                                }
                            }
                        }
                    }
                }
            },
            "400": {
                "description": "Validation error or database error",
                "content": {
                    "application/json": {
                        schema: {
                            type: "object",
                            properties: {
                                "success": {
                                    "type": "boolean",
                                    "example": false
                                },
                                "error": {
                                    "type": "string",
                                    "example": "Missing required field: name"
                                }
                            }
                        }
                    }
                }
            },
            "401": {
                "description": "Unauthorized - Missing or invalid authentication token",
                "content": {
                    "application/json": {
                        schema: {
                            type: "object",
                            properties: {
                                "success": {
                                    "type": "boolean",
                                    "example": false
                                },
                                "error": {
                                    "type": "string",
                                    "example": "Token is required"
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};
