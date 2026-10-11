const { Service } = require('../base');

// Base for single-table services that declare `table`, `cols` (the writable columns, in
// parameter order), optionally `fk` (a parent-id column written last on INSERT) and `pk`
// (default 'id'). Only the operations that are identical across those services live here;
// per-service normalising, validation and query shapes stay in the subclass.
//
// These are prototype methods, not arrow fields, so a subclass can override them with
// either a method or a field (a base-class field would shadow a subclass method).
class CrudService extends Service {
  pk = 'id';
  // Columns a DELETE returns ('' for none). Subclasses keep their current response shape.
  deleteReturning = '';

  insertColumnList() {
    return this.fk ? [...this.cols, this.fk] : [...this.cols];
  }

  // "(col1,col2,…[,fk])" for INSERT INTO table … VALUES …
  getColumns() {
    return `(${this.insertColumnList().join(',')})`;
  }

  // "($1,$2,…)" matching getColumns().
  getWildCards() {
    return `(${this.insertColumnList().map((_, i) => `$${i + 1}`).join(',')})`;
  }

  // "col1 = $1, col2 = $2, …" over `cols` (fk excluded); the caller binds the key after them.
  getUpdatePairs() {
    return this.cols.map((col, i) => `${col} = $${i + 1}`).join(', ');
  }

  // The row with this primary key ({ success, data: [row] or [] }).
  get(id) {
    return this.query(`select * from ${this.table} where ${this.pk}=$1`, [id]);
  }

  deleteEntry(id) {
    const returning = this.deleteReturning ? ` RETURNING ${this.deleteReturning}` : '';
    return this.query(`DELETE FROM ${this.table} WHERE ${this.pk} = $1${returning}`, [id]);
  }
}

module.exports = { CrudService };
