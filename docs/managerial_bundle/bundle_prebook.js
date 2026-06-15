module.exports = {
  post: {
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: ["Bundle Management"],
    description:
      "Prebook a bundle - Express interest in a bundle before it's available. Optionally include utm parameter to track campaign source. Authentication is optional - if provided, the user_id will be associated with the prebooking.",
    operationId: "usersPrebooksABundle",
    parameters: [
      {
        in: "path",
        name: "id",
        required: true,
        description: "Bundle ID",
        schema: {
          type: "integer",
        },
      },
    ],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            description: "Prebook bundle data",
            properties: {
              name: {
                type: "string",
                description: "User's full name",
                example: "John Doe",
              },
              email: {
                type: "string",
                description: "User's email address",
                example: "john@example.com",
              },
              phone: {
                type: "string",
                description: "User's phone number",
                example: "+8801234567890",
              },
              utm: {
                type: "string",
                description:
                  "UTM parameter to track campaign source (e.g., courseDemo, bootcampClass). Optional field.",
                example: "bootcampClass",
              },
            },
            required: ["name", "email", "phone"],
          },
        },
      },
    },
    responses: {
      200: {
        description: "Bundle prebooked successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: {
                  type: "boolean",
                  example: true,
                },
                data: {
                  type: "object",
                  properties: {
                    id: {
                      type: "integer",
                      example: 1,
                    },
                    bundle_id: {
                      type: "integer",
                      example: 3,
                    },
                    name: {
                      type: "string",
                      example: "John Doe",
                    },
                    email: {
                      type: "string",
                      example: "john@example.com",
                    },
                    phone: {
                      type: "string",
                      example: "+8801234567890",
                    },
                    utm: {
                      type: "string",
                      description: "UTM parameter value",
                      example: "bootcampClass",
                    },
                    timestamp: {
                      type: "integer",
                      example: 1732464000,
                    },
                    user_id: {
                      type: "integer",
                      example: null,
                    },
                  },
                },
              },
            },
          },
        },
      },
      400: {
        description: "Validation error or failed to prebook bundle",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: {
                  type: "boolean",
                  example: false,
                },
                error: {
                  type: "string",
                  description: "Error message. For validation errors, indicates which required fields are missing.",
                  example: "Missing required fields: email, name, phone. Name, email, and phone are required for prebooking.",
                },
              },
            },
            examples: {
              validationError: {
                summary: "Validation Error - Missing Required Fields",
                value: {
                  success: false,
                  error: "Missing required fields: email, name, phone. Name, email, and phone are required for prebooking.",
                },
              },
              partialValidationError: {
                summary: "Validation Error - Partial Missing Fields",
                value: {
                  success: false,
                  error: "Missing required fields: name, phone. Name, email, and phone are required for prebooking.",
                },
              },
              serverError: {
                summary: "Server Error",
                value: {
                  success: false,
                  error: "Failed to create prebooking",
                },
              },
            },
          },
        },
      },
    },
  },
};
