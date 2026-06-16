const Service = require("../base").Service;

const VALID_CATEGORIES = new Set([
  "courses",
  "enrollment",
  "payment",
  "support",
]);

class FAQService extends Service {
  table = "public_faq";

  normalizePayload = (payload = {}, { partial = false } = {}) => {
    const normalized = {};

    if (!partial || Object.prototype.hasOwnProperty.call(payload, "question")) {
      normalized.question = typeof payload.question === "string" ? payload.question.trim() : "";
    }

    if (!partial || Object.prototype.hasOwnProperty.call(payload, "answer")) {
      normalized.answer = typeof payload.answer === "string" ? payload.answer.trim() : "";
    }

    if (!partial || Object.prototype.hasOwnProperty.call(payload, "category")) {
      const category = payload.category == null || payload.category === "" ? null : String(payload.category).trim().toLowerCase();
      normalized.category = category;
    }

    if (!partial || Object.prototype.hasOwnProperty.call(payload, "sort_order")) {
      const parsed = Number(payload.sort_order);
      normalized.sort_order = Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
    }

    if (!partial || Object.prototype.hasOwnProperty.call(payload, "is_active")) {
      normalized.is_active = Boolean(payload.is_active);
    }

    return normalized;
  };

  validatePayload = (payload, { partial = false } = {}) => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, "question")) {
      if (!payload.question) {
        return "Question is required";
      }
    }

    if (!partial || Object.prototype.hasOwnProperty.call(payload, "answer")) {
      if (!payload.answer) {
        return "Answer is required";
      }
    }

    if (payload.category && !VALID_CATEGORIES.has(payload.category)) {
      return "Invalid category";
    }

    return null;
  };

  listPublic = async () => {
    return this.query(
      `SELECT id, question, answer, category, sort_order
       FROM ${this.table}
       WHERE is_active = TRUE
       ORDER BY sort_order ASC, id ASC`,
      []
    );
  };

  listAdmin = async () => {
    return this.query(
      `SELECT id, question, answer, category, sort_order, is_active, created_at, updated_at
       FROM ${this.table}
       ORDER BY sort_order ASC, id ASC`,
      []
    );
  };

  getById = async (id) => {
    return this.query(
      `SELECT id, question, answer, category, sort_order, is_active, created_at, updated_at
       FROM ${this.table}
       WHERE id = $1`,
      [id]
    );
  };

  create = async (payload) => {
    const normalized = this.normalizePayload(payload);
    const validationError = this.validatePayload(normalized);
    if (validationError) {
      return { success: false, error: validationError };
    }

    const timestamp = Math.trunc(Date.now() / 1000);
    return this.query(
      `INSERT INTO ${this.table} (question, answer, category, sort_order, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING id, question, answer, category, sort_order, is_active, created_at, updated_at`,
      [
        normalized.question,
        normalized.answer,
        normalized.category,
        normalized.sort_order,
        normalized.is_active,
        timestamp,
      ]
    );
  };

  update = async (id, payload) => {
    const existing = await this.getById(id);
    if (!existing.success) return existing;
    if (existing.data.length === 0) {
      return { success: false, error: "FAQ not found" };
    }

    const normalized = this.normalizePayload(payload, { partial: true });
    const merged = {
      ...existing.data[0],
      ...normalized,
    };
    const validationError = this.validatePayload(merged, { partial: false });
    if (validationError) {
      return { success: false, error: validationError };
    }

    return this.query(
      `UPDATE ${this.table}
       SET question = $1,
           answer = $2,
           category = $3,
           sort_order = $4,
           is_active = $5,
           updated_at = $6
       WHERE id = $7
       RETURNING id, question, answer, category, sort_order, is_active, created_at, updated_at`,
      [
        merged.question,
        merged.answer,
        merged.category,
        merged.sort_order,
        merged.is_active,
        Math.trunc(Date.now() / 1000),
        id,
      ]
    );
  };

  deleteEntry = async (id) => {
    return this.query(`DELETE FROM ${this.table} WHERE id = $1 RETURNING id`, [id]);
  };
}

module.exports = {
  FAQService,
  VALID_CATEGORIES: Array.from(VALID_CATEGORIES),
};
