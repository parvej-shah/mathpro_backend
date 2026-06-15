module.exports = {
    get: {
        tags: ["Managerial Authentication"],
        description: "Get the authenticated user's profile from the managerial_auth table",
        operationId: "managerialGetProfile",
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
            content: {
                "application/json": {
                    schema: {
                        type: "object",
                        properties: {}
                    },
                    description: "No request body needed. User ID is extracted from the JWT token"
                }
            }
        },
        "responses": {
            "200": {
                "description": "Profile retrieved successfully",
                "content": {
                    "application/json": {
                        schema: {
                            type: "object",
                            properties: {
                                "success": {
                                    "type": "boolean",
                                    "example": true
                                },
                                "rows": {
                                    "type": "array",
                                    "items": {
                                        type: "object",
                                        properties: {
                                            "id": {
                                                "type": "integer",
                                                "example": 1,
                                                "description": "User ID in managerial_auth table"
                                            },
                                            "name": {
                                                "type": "string",
                                                "example": "John Doe",
                                                "description": "Full name of the user"
                                            },
                                            "profile": {
                                                "type": "object",
                                                "example": {
                                                    "facebookId": "john.fb",
                                                    "address": "Dhaka, Bangladesh",
                                                    "schoolCollege": "Dhaka College",
                                                    "group": "Science",
                                                    "guardianName": "Abdul Karim",
                                                    "guardianMobile": "01712345678",
                                                    "relationWithGuardian": "Father",
                                                    "gender": "Male",
                                                    "classLevel": "HSC",
                                                    "version": "Bangla"
                                                },
                                                "description": "JSON object storing structured profile data"
                                            },
                                            "phone": {
                                                "type": "string",
                                                "example": "+880123456789"
                                            },
                                            "email": {
                                                "type": "string",
                                                "example": "john@example.com"
                                            },
                                            "role": {
                                                "type": "string",
                                                "example": "admin"
                                            },
                                            "is_verified": {
                                                "type": "boolean",
                                                "example": true
                                            },
                                            "created_at": {
                                                "type": "string",
                                                "format": "date-time",
                                                "example": "2024-01-01T10:00:00Z"
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "400": {
                "description": "Query execution failed",
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
                                    "example": "Database error occurred"
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
