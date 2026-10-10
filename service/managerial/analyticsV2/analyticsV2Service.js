const Service = require("../../base").Service;
const { DashboardAnalyticsService } = require("./parts/dashboard");
const { RevenueAnalyticsService } = require("./parts/revenue");
const { UserAnalyticsService } = require("./parts/users");
const { CatalogAnalyticsService } = require("./parts/catalog");
const { CommerceAnalyticsService } = require("./parts/commerce");

// Facade over the analytics V2 services in ./parts/: every method of each part is exposed
// here under its own name, so callers keep using `new AnalyticsV2Service().anyMethod(...)`.
class AnalyticsV2Service extends Service {
  constructor() {
    super();
    const parts = [
      new DashboardAnalyticsService(),
      new RevenueAnalyticsService(),
      new UserAnalyticsService(),
      new CatalogAnalyticsService(),
      new CommerceAnalyticsService(),
    ];
    for (const part of parts) {
      for (const [name, method] of Object.entries(part)) {
        // The Service base methods (query, …) are the facade's own.
        if (typeof method === "function" && !(name in this)) this[name] = method;
      }
    }
  }
}

module.exports = { AnalyticsV2Service };
