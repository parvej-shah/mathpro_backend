module.exports = {
    delete: {
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: ["Admin Management"],
        description: "Delete an admin account. Cannot delete the last super admin (user with super_admin role). Cannot delete the last admin or moderator in the system. The deletion operation is atomic and thread-safe, preventing race conditions when multiple concurrent delete requests are made.",
        operationId: "adminDelete",
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
        responses: {
            "200": {
                description: "Admin deleted successfully",
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            properties: {
                                success: {
                                    type: "boolean",
                                    example: true
                                },
                                message: {
                                    type: "string",
                                    example: "Admin deleted successfully"
                                }
                            }
                        }
                    }
                }
            },
            "400": {
                description: "Cannot delete the last super admin, the last admin or moderator, or deletion failed",
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
                                    example: "Cannot delete the last super admin. At least one user must have the super admin role."
                                }
                            }
                        }
                    }
                }
            },
            "403": {
                description: "Forbidden - Only admins can delete admins"
            },
            "404": {
                description: "Admin not found"
            }
        }
    },
};

