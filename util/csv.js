// A free-text CSV cell: wrapped in quotes, inner quotes doubled, missing value → "".
const csvText = (value) => `"${(value || '').replace(/"/g, '""')}"`;

module.exports = { csvText };
