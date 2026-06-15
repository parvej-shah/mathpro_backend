module.exports = {
  get: {
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: ["Coupon Management"],
    description: "List all coupons with pagination and filtering",
    operationId: "adminCouponList",
    parameters: [
      {
        in: "query",
        name: "page",
        schema: { type: "integer", default: 1 },
        description: "Page number",
        example: 1,
      },
      {
        in: "query",
        name: "limit",
        schema: { type: "integer", default: 10 },
        description: "Items per page",
        example: 10,
      },
      {
        in: "query",
        name: "status",
        schema: { type: "string", enum: ["active", "inactive", "expired"] },
        description: "Filter by status",
        example: "active",
      },
      {
        in: "query",
        name: "discountType",
        schema: { type: "string", enum: ["fixed", "percentage"] },
        description: "Filter by discount type",
        example: "percentage",
      },
      {
        in: "query",
        name: "search",
        schema: { type: "string" },
        description: "Search by name or code",
        example: "SUMMER",
      },
      {
        in: "query",
        name: "startDate",
        schema: { type: "integer" },
        description: "Filter by start date (Unix timestamp)",
        example: 1640995200,
      },
      {
        in: "query",
        name: "endDate",
        schema: { type: "integer" },
        description: "Filter by end date (Unix timestamp)",
        example: 1735689600,
      },
    ],
    responses: {
      200: {
        description: "Coupon list retrieved successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                data: {
                  type: "array",
                  items: { $ref: "#/components/schemas/coupon" },
                },
                pagination: {
                  type: "object",
                  properties: {
                    page: { type: "integer", example: 1 },
                    limit: { type: "integer", example: 10 },
                    total: { type: "integer", example: 25 },
                    totalPages: { type: "integer", example: 3 },
                  },
                },
              },
            },
          },
        },
      },
      400: {
        description: "Failed to retrieve coupons",
      },
    },
  },
};
