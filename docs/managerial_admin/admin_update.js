module.exports = {
    put: {
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: ["Admin Management"],
        description: "Update admin information. Requires current password if updating email or password.",
        operationId: "adminUpdate",
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
            content: {
                "application/json": {
                    schema: {
                        type: "object",
                        properties: {
                            name: {
                                type: "string",
                                description: "Updated name",
                                example: "Jane Smith Updated"
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
                                description: "New email address (requires currentPassword)",
                                example: "jane.new@example.com"
                            },
                            phone: {
                                type: "string",
                                description: "New phone number (set to null to remove)",
                                example: "01712345678"
                            },
                            profile: {
                                type: "object",
                                description: "Updated profile JSON object",
                                example: {
                                    bio: "Senior Software Developer",
                                    location: "Dhaka",
                                    department: "Engineering"
                                }
                            },
                            password: {
                                type: "string",
                                description: "New password (requires currentPassword)",
                                example: "newPassword123"
                            },
                            currentPassword: {
                                type: "string",
                                description: "Current password of the admin making the update (required if updating email or password)",
                                example: "currentPassword123"
                            }
                        }
                    }
                }
            }
        },
        responses: {
            "200": {
                description: "Admin updated successfully",
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
                                    example: "Admin updated successfully"
                                }
                            }
                        }
                    }
                }
            },
            "400": {
                description: "Validation error, missing current password, or database error",
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
                                    example: "Failed to update admin in database"
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
                description: "Forbidden - Only admins can update admins"
            },
            "404": {
                description: "Admin not found"
            }
        }
    },
};

