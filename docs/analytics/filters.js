module.exports = {
  "/admin/analytics/filters/options": {
    get: {
      security: [{ bearerAuth: [] }],
      tags: ["Analytics"],
      summary: "Get filter options for dropdowns",
      description: "Returns id/name/value lists for populating filter dropdowns. Scoped to courses accessible by the requesting user.",
      operationId: "analyticsGetFilterOptions",
      parameters: [
        {
          in: "query", name: "type", required: true,
          schema: { type: "string", enum: ["courses", "bundles", "coupons", "users", "teachers"] },
          description: "Filter type — required",
          example: "courses",
        },
      ],
      responses: {
        200: {
          description: "Filter options retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      options: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { oneOf: [{ type: "integer" }, { type: "string" }], example: 1 },
                            name: { type: "string", example: "Course Name" },
                            value: { oneOf: [{ type: "integer" }, { type: "string" }], example: 1 },
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
        400: { description: "Missing or invalid type parameter" },
        401: { description: "Unauthorized" },
        500: { description: "Internal server error" },
      },
    },
  },
};
