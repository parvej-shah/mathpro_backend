module.exports = {
  "/admin/analytics/payments/overview": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Analytics"],
      summary: "Get payment statistics and transaction success rates",
      operationId: "analyticsGetPaymentOverview",
      parameters: [
        { in: "query", name: "start_date", schema: { type: "integer" }, description: "Start date (Unix timestamp seconds)", example: 1704067200 },
        { in: "query", name: "end_date", schema: { type: "integer" }, description: "End date (Unix timestamp seconds)", example: 1706659200 },
      ],
      responses: {
        200: {
          description: "Payment overview retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      total_payments: { type: "integer", example: 2000 },
                      successful_payments: { type: "integer", example: 1900 },
                      failed_payments: { type: "integer", example: 100 },
                      success_rate: { type: "number", example: 95.0 },
                      total_amount: { type: "number", example: 5000000 },
                      average_transaction_value: { type: "number", example: 2631.58 },
                      trends: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            period: { type: "string", example: "2025-01" },
                            successful: { type: "integer", example: 100 },
                            failed: { type: "integer", example: 5 },
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
};
