// Builds the SET list of a dynamic UPDATE from a patch, using only whitelisted columns.
// Column names are never taken from the patch itself, so a request body cannot inject SQL.
// `undefined` means "not supplied" and is skipped; `null` is a real value and is written.
// `transforms` maps a column to a function applied to its value (e.g. JSON.stringify).
// Returns { setSql, params, nextIndex }; setSql is '' when there is nothing to update.
function buildUpdate(allowedCols, patch, { transforms = {}, startIndex = 1 } = {}) {
  const sets = [];
  const params = [];
  let index = startIndex;
  for (const col of allowedCols) {
    if (!Object.prototype.hasOwnProperty.call(patch, col) || patch[col] === undefined) continue;
    const value = transforms[col] ? transforms[col](patch[col]) : patch[col];
    sets.push(`${col} = $${index++}`);
    params.push(value);
  }
  return { setSql: sets.join(', '), params, nextIndex: index };
}

module.exports = { buildUpdate };
