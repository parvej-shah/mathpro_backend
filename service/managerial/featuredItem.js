const Service = require("../base").Service;

class FeaturedItemService extends Service {
  listPublic = async () => {
    // Explicit, aligned column list — course (22 cols) and bundle (12 cols) have
    // different schemas, so `c.*`/`b.*` in a UNION breaks. Emit the same shape from
    // both branches (bundle lacks x_price/slug/tags → NULL) plus an item_type flag.
    return this.query(
      `SELECT
         'course' AS item_type, pfi.sort_order,
         c.id, c.title, c.short_description, c.chips, c.price, c.x_price,
         c.url, c.slug, c.tags, c.is_live
       FROM public_featured_item pfi
       INNER JOIN course c ON c.id = pfi.item_id AND pfi.item_type = 'course'
       WHERE pfi.is_active = TRUE AND c.is_live = TRUE
       UNION ALL
       SELECT
         'bundle' AS item_type, pfi.sort_order,
         b.id, b.title, b.short_description, b.chips, b.price, NULL::integer AS x_price,
         b.url, NULL::varchar AS slug, NULL::json AS tags, b.is_live
       FROM public_featured_item pfi
       INNER JOIN bundle b ON b.id = pfi.item_id AND pfi.item_type = 'bundle'
       WHERE pfi.is_active = TRUE AND b.is_live = TRUE
       ORDER BY sort_order ASC, item_type ASC, id ASC`,
      []
    );
  };

  listAdmin = async () => {
    return this.query(
      `SELECT
         pfi.item_type,
         pfi.item_id,
         pfi.sort_order,
         pfi.is_active,
         pfi.created_at,
         pfi.updated_at,
         CASE WHEN pfi.item_type = 'course' THEN c.title ELSE b.title END AS title,
         CASE WHEN pfi.item_type = 'course' THEN c.is_live ELSE b.is_live END AS is_live
       FROM public_featured_item pfi
       LEFT JOIN course c ON c.id = pfi.item_id AND pfi.item_type = 'course'
       LEFT JOIN bundle b ON b.id = pfi.item_id AND pfi.item_type = 'bundle'
       ORDER BY pfi.sort_order ASC, pfi.item_type ASC, pfi.item_id ASC`,
      []
    );
  };

  getItem = async (itemType, itemId) => {
    if (itemType === "course") {
      return this.query(`SELECT id, title, is_live FROM course WHERE id = $1`, [
        itemId,
      ]);
    }
    if (itemType === "bundle") {
      return this.query(`SELECT id, title, is_live FROM bundle WHERE id = $1`, [
        itemId,
      ]);
    }
    return { success: true, data: [] };
  };

  create = async (payload) => {
    const itemType = payload.item_type;
    if (itemType !== "course" && itemType !== "bundle") {
      return { success: false, error: "item_type must be 'course' or 'bundle'" };
    }

    const itemId = Number.parseInt(String(payload.item_id), 10);
    if (Number.isNaN(itemId)) {
      return { success: false, error: "item_id is required" };
    }

    const sortOrder = Number.isFinite(Number(payload.sort_order))
      ? Math.trunc(Number(payload.sort_order))
      : 0;
    const isActive =
      payload.is_active === undefined ? true : Boolean(payload.is_active);

    const item = await this.getItem(itemType, itemId);
    if (!item.success) return item;
    if (item.data.length === 0) {
      return { success: false, error: `${itemType} not found` };
    }

    return this.query(
      `INSERT INTO public_featured_item (item_type, item_id, sort_order, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5)
       RETURNING item_type, item_id, sort_order, is_active, created_at, updated_at`,
      [itemType, itemId, sortOrder, isActive, Math.trunc(Date.now() / 1000)]
    );
  };

  update = async (itemType, itemId, payload) => {
    const normalizedItemId = Number.parseInt(String(itemId), 10);
    if (Number.isNaN(normalizedItemId)) {
      return { success: false, error: "item_id is required" };
    }

    const current = await this.query(
      `SELECT item_type, item_id, sort_order, is_active
       FROM public_featured_item
       WHERE item_type = $1 AND item_id = $2`,
      [itemType, normalizedItemId]
    );
    if (!current.success) return current;
    if (current.data.length === 0) {
      return { success: false, error: "Featured item not found" };
    }

    const nextSortOrder =
      payload.sort_order === undefined
        ? current.data[0].sort_order
        : Math.trunc(Number(payload.sort_order) || 0);
    const nextIsActive =
      payload.is_active === undefined
        ? current.data[0].is_active
        : Boolean(payload.is_active);

    return this.query(
      `UPDATE public_featured_item
       SET sort_order = $1,
           is_active = $2,
           updated_at = $3
       WHERE item_type = $4 AND item_id = $5
       RETURNING item_type, item_id, sort_order, is_active, created_at, updated_at`,
      [nextSortOrder, nextIsActive, Math.trunc(Date.now() / 1000), itemType, normalizedItemId]
    );
  };

  reorder = async (items) => {
    if (!Array.isArray(items) || items.length === 0) {
      return { success: false, error: "items array is required" };
    }

    const client = await this.getClient();
    try {
      await client.query("BEGIN");

      for (const entry of items) {
        const itemType = entry.item_type;
        const itemId = Number.parseInt(String(entry.item_id), 10);
        const sortOrder = Math.trunc(Number(entry.sort_order) || 0);

        if (itemType !== "course" && itemType !== "bundle" || Number.isNaN(itemId)) {
          await client.query("ROLLBACK");
          return { success: false, error: "Invalid item in reorder payload" };
        }

        await client.query(
          `UPDATE public_featured_item
           SET sort_order = $1, updated_at = $2
           WHERE item_type = $3 AND item_id = $4`,
          [sortOrder, Math.trunc(Date.now() / 1000), itemType, itemId]
        );
      }

      await client.query("COMMIT");
      return { success: true, data: items };
    } catch (error) {
      await client.query("ROLLBACK");
      return { success: false, error };
    } finally {
      client.release();
    }
  };

  deleteEntry = async (itemType, itemId) => {
    const normalizedItemId = Number.parseInt(String(itemId), 10);
    if (Number.isNaN(normalizedItemId)) {
      return { success: false, error: "item_id is required" };
    }

    return this.query(
      `DELETE FROM public_featured_item
       WHERE item_type = $1 AND item_id = $2
       RETURNING item_type, item_id`,
      [itemType, normalizedItemId]
    );
  };
}

module.exports = { FeaturedItemService };
