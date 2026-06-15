module.exports = {
  "/admin/analytics/metadata": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Analytics"],
      summary: "Get metadata and help text for all data points",
      description: "Returns labels, help text, units, and categories for every analytics data point. Use for frontend tooltips.",
      operationId: "analyticsGetAllMetadata",
      parameters: [],
      responses: {
        200: {
          description: "All metadata retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: { type: "object", description: "Nested metadata keyed by category and data point" },
                },
              },
            },
          },
        },
        401: { description: "Unauthorized" },
        500: { description: "Internal server error" },
      },
    },
  },

  "/admin/analytics/metadata/{category}": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Analytics"],
      summary: "Get metadata for a specific category",
      operationId: "analyticsGetCategoryMetadata",
      parameters: [
        {
          in: "path", name: "category", required: true,
          schema: { type: "string", enum: ["dashboard", "revenue", "users", "courses", "bundles", "learning", "engagement", "coupons", "payments"] },
          description: "Category name",
          example: "revenue",
        },
      ],
      responses: {
        200: { description: "Category metadata retrieved" },
        404: { description: "Category not found" },
        401: { description: "Unauthorized" },
        500: { description: "Internal server error" },
      },
    },
  },

  "/admin/analytics/metadata/{category}/{key}": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Analytics"],
      summary: "Get metadata for a specific data point",
      operationId: "analyticsGetDataPointMetadata",
      parameters: [
        { in: "path", name: "category", required: true, schema: { type: "string" }, description: "Category name", example: "revenue" },
        { in: "path", name: "key", required: true, schema: { type: "string" }, description: "Data point key", example: "total_revenue" },
      ],
      responses: {
        200: {
          description: "Data point metadata retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      label: { type: "string", example: "Total Revenue" },
                      helpText: { type: "string", example: "Total revenue generated from all course enrollments" },
                      unit: { type: "string", example: "currency" },
                      category: { type: "string", example: "revenue" },
                    },
                  },
                },
              },
            },
          },
        },
        404: { description: "Data point not found" },
        401: { description: "Unauthorized" },
        500: { description: "Internal server error" },
      },
    },
  },
};
