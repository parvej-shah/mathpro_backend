// WHERE conditions for an optional date range on one column: `column >= $n` when `from` is
// set and `column <= $n` when `to` is set (a falsy bound is no bound). Placeholders start at
// startIndex; `transform` is applied to each bound (e.g. (v) => parseInt(v) for query strings).
// Returns { conditions, params, nextIndex } for the caller to append to its own lists:
//   const range = dateRangeFilter('cu.used_at', startDate, endDate, { startIndex: paramIndex });
//   whereConditions.push(...range.conditions); params.push(...range.params); paramIndex = range.nextIndex;
function dateRangeFilter(column, from, to, { startIndex = 1, transform } = {}) {
  const conditions = [];
  const params = [];
  let index = startIndex;
  for (const [op, bound] of [['>=', from], ['<=', to]]) {
    if (!bound) continue;
    conditions.push(`${column} ${op} $${index++}`);
    params.push(transform ? transform(bound) : bound);
  }
  return { conditions, params, nextIndex: index };
}

module.exports = { dateRangeFilter };
