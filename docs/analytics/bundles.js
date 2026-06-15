const dateParams = [
  { in: "query", name: "start_date", schema: { type: "integer" }, description: "Start date (Unix timestamp seconds)", example: 1704067200 },
  { in: "query", name: "end_date", schema: { type: "integer" }, description: "End date (Unix timestamp seconds)", example: 1706659200 },
];

module.exports = {
  "/admin/analytics/bundles/overview": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Analytics"],
      summary: "Get bundle overview statistics",
      operationId: "analyticsGetBundleOverview",
      parameters: dateParams,
      responses: {
        200: {
          description: "Bundle overview retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      total_bundles: { type: "integer", example: 10 },
                      live_bundles: { type: "integer", example: 8 },
                      total_purchases: { type: "integer", example: 500 },
                      total_revenue: { type: "number", example: 5000000 },
                      average_revenue_per_bundle: { type: "number", example: 500000 },
                      top_bundles: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            bundle_id: { type: "integer", example: 1 },
                            title: { type: "string", example: "Bundle Name" },
                            purchases: { type: "integer", example: 50 },
                            revenue: { type: "number", example: 500000 },
                          },
                        },
                      },
                    },
                  },
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

  "/admin/analytics/bundles/{bundleId}/detailed": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Analytics"],
      summary: "Get detailed analytics for a specific bundle",
      operationId: "analyticsGetBundleDetailed",
      parameters: [
        { in: "path", name: "bundleId", required: true, schema: { type: "integer" }, description: "Bundle ID", example: 1 },
        ...dateParams,
      ],
      responses: {
        200: {
          description: "Bundle detailed analytics retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      bundle: {
                        type: "object",
                        properties: {
                          id: { type: "integer", example: 1 },
                          title: { type: "string", example: "Bundle Name" },
                          price: { type: "number", example: 50000 },
                        },
                      },
                      purchases: {
                        type: "object",
                        properties: {
                          total: { type: "integer", example: 50 },
                          this_month: { type: "integer", example: 5 },
                          last_month: { type: "integer", example: 4 },
                          growth_percentage: { type: "string", example: "25.00" },
                        },
                      },
                      revenue: {
                        type: "object",
                        properties: {
                          total: { type: "number", example: 2500000 },
                          this_month: { type: "number", example: 250000 },
                          last_month: { type: "number", example: 200000 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        400: { description: "Invalid bundle ID" },
        401: { description: "Unauthorized" },
        500: { description: "Internal server error" },
      },
    },
  },
};
