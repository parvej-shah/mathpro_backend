module.exports = {
    post: {
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: ["Admin Management"],
        description: "Generate a new password for an admin and send it via email. Requires current password of the admin making the request.",
        operationId: "adminSetPassword",
        parameters: [
            {
                in: "path",
                name: "id",
                required: true,
                schema: {
                    type: "integer"
                },
                description: "Admin ID"
            }
        ],
        requestBody: {
            required: true,
            content: {
                "application/json": {
                    schema: {
                        type: "object",
                        required: ["currentPassword"],
                        properties: {
                            currentPassword: {
                                type: "string",
                                description: "Current password of the admin making the request",
                                example: "currentPassword123"
                            }
                        }
                    }
                }
            }
        },
        responses: {
            "200": {
                description: "Password reset successfully",
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
                                    type: "object",
                                    properties: {
                                        id: {
                                            type: "integer",
                                            example: 5
                                        },
                                        name: {
                                            type: "string",
                                            example: "Jane Smith"
                                        },
                                        email: {
                                            type: "string",
                                            example: "jane@example.com"
                                        },
                                        login: {
                                            type: "string",
                                            example: "jane@example.com"
                                        }
                                    }
                                },
                                message: {
                                    type: "string",
                                    example: "Password has been reset and sent to admin email"
                                }
                            }
                        }
                    }
                }
            },
            "400": {
                description: "Missing or incorrect current password, or database error",
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
                                    example: "Failed to update password in database"
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
                description: "Forbidden - Only admins can set passwords"
            },
            "404": {
                description: "Admin not found"
            }
        }
    },
};

