// Runs once before the test suite: starts the throwaway cluster and recreates a
// freshly migrated `mathpro_test` database.
const { resetTestDatabase } = require('./helpers/testDb');

resetTestDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err.message);
        process.exit(1);
    });
