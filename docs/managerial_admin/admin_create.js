module.exports = {
    post: {
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: ["Admin Management"],
        description: "Create a new admin or moderator. Password is auto-generated and sent via email.",
        operationId: "adminCreate",
        parameters: [],
        requestBody: {
            content: {
                "application/json": {
                    schema: {
                        type: "object",
                        required: ["name", "type", "email"],
                        properties: {
                            name: {
                                type: "string",
                                description: "Admin's full name",
                                example: "Jane Smith"
                            },
                            type: {
                                type: "integer",
                                enum: [1, 2],
                                description: "1 for Admin, 2 for Moderator",
                                example: 1
                            },
                            email: {
                                type: "string",
                                format: "email",
                                description: "Valid email address (will be used as login)",
                                example: "jane@example.com"
                            },
                            phone: {
                                type: "string",
                                description: "11-digit phone number starting with 01 (optional)",
                                example: "01712345678"
                            },
                            profile: {
                                type: "object",
                                description: "Additional profile data (JSON object)",
                                example: {
                                    bio: "Software Developer",
                                    location: "Dhaka"
                                }
                            }
                        }
                    }
                }
            }
        },
        responses: {
            "201": {
                description: "Admin created successfully",
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            properties: {
                                success: {
                                    type: "boolean",
                                    example: true
                                },
                                data: {
                                    $ref: "#/components/schemas/admin"
                                },
                                message: {
                                    type: "string",
                                    example: "Admin created successfully. Credentials have been sent to email."
                                }
                            }
                        }
                    }
                }
            },
            "400": {
                description: "Validation error (missing fields, invalid email/phone, duplicate email) or database error",
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            properties: {
                                success: {
                                    type: "boolean",
                                    example: false
                                },
                                error: {
                                    type: "string",
                                    example: "Failed to create admin in database"
                                },
                                message: {
                                    type: "string",
                                    example: "Database error occurred"
                                }
                            }
                        }
                    }
                }
            },
            "403": {
                description: "Forbidden - Only admins can create admins"
            }
        }
    },
};

