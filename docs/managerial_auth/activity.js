module.exports = {
    get: {
        tags: ["User Activity"], // operation's tag
        description: "Get User Activity", // short desc
        operationId: "getUserActivity", // unique operation id
        parameters: [
            {
                name: "start_date",
                in: "query",
                description: "Start date for activity range (YYYY-MM-DD)",
                required: false,
                schema: {
                    type: "string",
                    format: "date"
                }
            },
            {
                name: "end_date",
                in: "query",
                description: "End date for activity range (YYYY-MM-DD)",
                required: false,
                schema: {
                    type: "string",
                    format: "date"
                }
            }
        ],
        security: [
            {
                bearerAuth: []
            }
        ],
        responses: {
            "200": {
                description: "Activity fetched successfully",
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            properties: {
                                success: {
                                    type: "boolean"
                                },
                                data: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            // Define properties of activity items here
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "400": {
                description: "Activity fetch failed",
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            properties: {
                                success: {
                                    type: "boolean"
                                },
                                message: {
                                    type: "string"
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    post: {         
        tags: ["User Activity"], // operation's tag
        description: "Create Activity", // short desc
        operationId: "managerialCreateActivity", // unique operation id
        parameters: [], // expected params
        requestBody: {
            // expected request body
            content: {
                // content-type
                "application/json": {
                    schema: {
                        type: "object",
                        properties: {
                            url: {
                                type: "string",
                                example: "/profile"
                            }
                        },
                        required: ["url"]
                    }
                },
            },
        },
        responses: {
            "200": {
                description: "Activity created successfully",
                content: {
                    "application/json": {
                        schema: {
                            type: "object"
                        }
                    }
                }
            },
            "400": {
                description: "Activity creation failed",
                content: {
                    "application/json": {
                        schema: {
                            type: "object"
                        }
                    }
                }
            }
        }
    }
};
