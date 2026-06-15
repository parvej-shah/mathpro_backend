const streakPaths = {
  // User Streak Endpoints
  "/user/streak/complete-lesson": {
    post: {
      security: [{ bearerAuth: [] }],
      tags: ["User Streaks"],
      summary: "Record lesson completion and update streak",
      description: "Updates user's learning streak when they complete a lesson or activity",
      operationId: "userStreakCompleteLesson",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["courseId"],
              properties: {
                courseId: {
                  type: "string",
                  format: "uuid",
                  description: "Course UUID",
                  example: "123e4567-e89b-12d3-a456-426614174000"
                },
                timezone: {
                  type: "string",
                  default: "UTC",
                  description: "User's timezone (e.g., 'America/New_York')",
                  example: "America/New_York"
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: "Streak updated successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "Streak updated successfully" },
                  data: {
                    type: "object",
                    properties: {
                      currentStreak: { type: "integer", example: 5 },
                      longestStreak: { type: "integer", example: 12 },
                      lastActivityDate: { type: "string", format: "date", example: "2024-01-15" },
                      isNewRecord: { type: "boolean", example: false }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: "Bad request - missing courseId" },
        401: { description: "Unauthorized" },
        500: { description: "Internal server error" }
      }
    }
  },

  "/user/streak/course/{courseId}": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["User Streaks"],
      summary: "Get user's streak for a specific course",
      description: "Retrieves the current and longest streak for a user in a specific course",
      operationId: "userStreakGetCourse",
      parameters: [
        {
          in: "path",
          name: "courseId",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "Course UUID",
          example: "123e4567-e89b-12d3-a456-426614174000"
        }
      ],
      responses: {
        200: {
          description: "Course streak data retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      currentStreak: { type: "integer", example: 5 },
                      longestStreak: { type: "integer", example: 12 },
                      lastActivityDate: { type: "string", format: "date", example: "2024-01-15" },
                      createdAt: { type: "string", format: "date-time", example: "2024-01-01T00:00:00Z" }
                    }
                  }
                }
              }
            }
          }
        },
        401: { description: "Unauthorized" },
        500: { description: "Internal server error" }
      }
    }
  },

  "/user/streak/dashboard": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["User Streaks"],
      summary: "Get all user's streaks for dashboard",
      description: "Retrieves all streak data for the user across all courses",
      operationId: "userStreakGetDashboard",
      responses: {
        200: {
          description: "Dashboard streak data retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      streaks: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            courseId: { type: "string", format: "uuid" },
                            courseTitle: { type: "string", example: "JavaScript Basics" },
                            courseThumbnail: { type: "string", example: "https://example.com/thumb.jpg" },
                            currentStreak: { type: "integer", example: 5 },
                            longestStreak: { type: "integer", example: 12 },
                            lastActivityDate: { type: "string", format: "date" },
                            isActive: { type: "boolean", example: true }
                          }
                        }
                      },
                      totalCourses: { type: "integer", example: 3 },
                      activeStreaks: { type: "integer", example: 2 },
                      totalCurrentStreak: { type: "integer", example: 15 },
                      longestOverallStreak: { type: "integer", example: 25 }
                    }
                  }
                }
              }
            }
          }
        },
        401: { description: "Unauthorized" },
        500: { description: "Internal server error" }
      }
    }
  },

  "/user/streak/leaderboard/{courseId}": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["User Streaks"],
      summary: "Get course leaderboard",
      description: "Retrieves the leaderboard showing top streaks for a specific course",
      operationId: "userStreakGetLeaderboard",
      parameters: [
        {
          in: "path",
          name: "courseId",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "Course UUID"
        },
        {
          in: "query",
          name: "limit",
          schema: { type: "integer", default: 10, maximum: 50 },
          description: "Number of top entries to return"
        }
      ],
      responses: {
        200: {
          description: "Course leaderboard retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        rank: { type: "integer", example: 1 },
                        userId: { type: "string", format: "uuid" },
                        userName: { type: "string", example: "John Doe" },
                        userAvatar: { type: "string", example: "https://example.com/avatar.jpg" },
                        currentStreak: { type: "integer", example: 25 },
                        longestStreak: { type: "integer", example: 30 },
                        lastActivityDate: { type: "string", format: "date" },
                        isActive: { type: "boolean", example: true }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        401: { description: "Unauthorized" },
        500: { description: "Internal server error" }
      }
    }
  },

  // Admin Streak Endpoints
  "/admin/streak/analytics": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Admin Streaks"],
      summary: "Get streak analytics for admin dashboard",
      description: "Retrieves comprehensive streak analytics and engagement metrics",
      operationId: "adminStreakGetAnalytics",
      parameters: [
        {
          in: "query",
          name: "courseId",
          schema: { type: "string", format: "uuid" },
          description: "Optional course ID to filter analytics"
        }
      ],
      responses: {
        200: {
          description: "Streak analytics retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      totalUsers: { type: "integer", example: 1250 },
                      averageCurrentStreak: { type: "string", example: "3.45" },
                      averageLongestStreak: { type: "string", example: "8.92" },
                      maxStreak: { type: "integer", example: 45 },
                      activeStreaks: { type: "integer", example: 890 },
                      weekPlusStreaks: { type: "integer", example: 320 },
                      monthPlusStreaks: { type: "integer", example: 85 },
                      engagementRate: { type: "string", example: "71.20" }
                    }
                  }
                }
              }
            }
          }
        },
        401: { description: "Unauthorized" },
        500: { description: "Internal server error" }
      }
    }
  },

  "/admin/streak/user/{userId}": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Admin Streaks"],
      summary: "Get detailed streak data for a specific user",
      description: "Retrieves all streak information for a specific user across all courses",
      operationId: "adminStreakGetUserDetails",
      parameters: [
        {
          in: "path",
          name: "userId",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "User UUID"
        }
      ],
      responses: {
        200: {
          description: "User streak details retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        courseId: { type: "string", format: "uuid" },
                        courseTitle: { type: "string" },
                        currentStreak: { type: "integer" },
                        longestStreak: { type: "integer" },
                        lastActivityDate: { type: "string", format: "date" }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        401: { description: "Unauthorized" },
        404: { description: "User not found" },
        500: { description: "Internal server error" }
      }
    }
  },

  "/admin/streak/manual-update": {
    post: {
      security: [{ bearerAuth: [] }],
      tags: ["Admin Streaks"],
      summary: "Manually update a user's streak",
      description: "Allows admin to manually correct or update a user's streak data",
      operationId: "adminStreakManualUpdate",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["userId", "courseId", "activityDate"],
              properties: {
                userId: {
                  type: "string",
                  format: "uuid",
                  description: "User UUID"
                },
                courseId: {
                  type: "string",
                  format: "uuid",
                  description: "Course UUID"
                },
                activityDate: {
                  type: "string",
                  format: "date",
                  description: "Activity date in YYYY-MM-DD format",
                  example: "2024-01-15"
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: "Streak updated successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "Streak updated successfully" },
                  data: {
                    type: "object",
                    properties: {
                      currentStreak: { type: "integer" },
                      longestStreak: { type: "integer" },
                      lastActivityDate: { type: "string", format: "date" }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: "Bad request - invalid parameters" },
        401: { description: "Unauthorized" },
        500: { description: "Internal server error" }
      }
    }
  },

  "/admin/streak/trends": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Admin Streaks"],
      summary: "Get streak trends over time",
      description: "Retrieves streak activity trends and patterns over a specified time period",
      operationId: "adminStreakGetTrends",
      parameters: [
        {
          in: "query",
          name: "courseId",
          schema: { type: "string", format: "uuid" },
          description: "Optional course ID to filter trends"
        },
        {
          in: "query",
          name: "days",
          schema: { type: "integer", default: 30, maximum: 365 },
          description: "Number of days to analyze"
        }
      ],
      responses: {
        200: {
          description: "Streak trends retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        date: { type: "string", format: "date" },
                        totalUpdates: { type: "integer" },
                        activeStreaks: { type: "integer" },
                        avgStreak: { type: "number" }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        401: { description: "Unauthorized" },
        500: { description: "Internal server error" }
      }
    }
  }
};

module.exports = {
  paths: streakPaths
};