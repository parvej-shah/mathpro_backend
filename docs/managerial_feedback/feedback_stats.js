module.exports = {
    get: {
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: ["Admin Feedback"], // operation's tag
        description: "Get feedback statistics (Admin only)", // short desc
        operationId: "getFeedbackStats", // unique operation id
        parameters: [],
        "responses": {
            "200": {
                "description": "Feedback statistics retrieved successfully",
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "properties": {
                                "success": {
                                    "type": "boolean",
                                    "example": true
                                },
                                "data": {
                                    "type": "object",
                                    "properties": {
                                        "totalFeedbacks": {
                                            "type": "integer",
                                            "example": 250
                                        },
                                        "averageRating": {
                                            "type": "number",
                                            "format": "float",
                                            "example": 4.3
                                        },
                                        "ratingDistribution": {
                                            "type": "object",
                                            "properties": {
                                                "1": {
                                                    "type": "integer",
                                                    "example": 5
                                                },
                                                "2": {
                                                    "type": "integer",
                                                    "example": 10
                                                },
                                                "3": {
                                                    "type": "integer",
                                                    "example": 30
                                                },
                                                "4": {
                                                    "type": "integer",
                                                    "example": 85
                                                },
                                                "5": {
                                                    "type": "integer",
                                                    "example": 120
                                                }
                                            }
                                        },
                                        "categoryBreakdown": {
                                            "type": "object",
                                            "properties": {
                                                "content": {
                                                    "type": "integer",
                                                    "example": 80
                                                },
                                                "instructor": {
                                                    "type": "integer",
                                                    "example": 70
                                                },
                                                "platform": {
                                                    "type": "integer",
                                                    "example": 40
                                                },
                                                "course": {
                                                    "type": "integer",
                                                    "example": 50
                                                },
                                                "other": {
                                                    "type": "integer",
                                                    "example": 10
                                                }
                                            }
                                        },
                                        "topRatedCourses": {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "courseId": {
                                                        "type": "string",
                                                        "example": "course-123"
                                                    },
                                                    "averageRating": {
                                                        "type": "number",
                                                        "format": "float",
                                                        "example": 4.9
                                                    },
                                                    "feedbackCount": {
                                                        "type": "integer",
                                                        "example": 45
                                                    }
                                                }
                                            }
                                        },
                                        "lowRatedCourses": {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "courseId": {
                                                        "type": "string",
                                                        "example": "course-456"
                                                    },
                                                    "averageRating": {
                                                        "type": "number",
                                                        "format": "float",
                                                        "example": 2.5
                                                    },
                                                    "feedbackCount": {
                                                        "type": "integer",
                                                        "example": 12
                                                    }
                                                }
                                            }
                                        }
                                    }
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
            "500": {
                "description": "Internal server error"
            }
        }
    },
}
