const { Service } = require('../base');

// Base for single-table services that declare `table` (and optionally `pk`, default 'id').
// Only the operations that are identical across those services live here; per-service
// normalising, validation and column lists stay in the subclass.
class CrudService extends Service {
  pk = 'id';
  // Columns a DELETE returns ('' for none). Subclasses keep their current response shape.
  deleteReturning = '';

  deleteEntry = async (id) => {
    const returning = this.deleteReturning ? ` RETURNING ${this.deleteReturning}` : '';
    return this.query(`DELETE FROM ${this.table} WHERE ${this.pk} = $1${returning}`, [id]);
  };
}

module.exports = { CrudService };
