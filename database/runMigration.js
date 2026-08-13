const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config(); // Load environment variables
const { Service } = require('../service/base');

const MIGRATIONS_TABLE = 'schema_migrations';

class MigrationRunner {
    constructor() {
        this.service = new Service();
        this.migrationsDir = path.join(__dirname, 'migrations');
    }

    getMigrationFiles() {
        return fs.readdirSync(this.migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();
    }

    getMigrationPath(migrationFile) {
        return path.join(this.migrationsDir, migrationFile);
    }

    readMigration(migrationFile) {
        const migrationPath = this.getMigrationPath(migrationFile);
        return fs.readFileSync(migrationPath, 'utf8');
    }

    getChecksum(sql) {
        return crypto.createHash('sha256').update(sql).digest('hex');
    }

    async ensureMigrationTable() {
        const result = await this.service.query(`
            CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
                filename TEXT PRIMARY KEY,
                checksum TEXT NOT NULL,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        if (!result.success) {
            throw result.error;
        }
    }

    async getAppliedMigrations() {
        await this.ensureMigrationTable();

        const result = await this.service.query(`
            SELECT filename, checksum
            FROM ${MIGRATIONS_TABLE}
            ORDER BY filename;
        `);

        if (!result.success) {
            throw result.error;
        }

        return new Map(result.data.map(row => [row.filename, row.checksum]));
    }

    async hasExistingSchema() {
        const result = await this.service.query(`
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name IN ('course', 'managerial_auth', 'bundle')
            ) AS has_schema;
        `);

        if (!result.success) {
            throw result.error;
        }

        return Boolean(result.data[0]?.has_schema);
    }

    async assertSafeToRunAll(appliedMigrations) {
        if (appliedMigrations.size > 0) {
            return;
        }

        const hasExistingSchema = await this.hasExistingSchema();
        if (!hasExistingSchema) {
            return;
        }

        throw new Error(
            'schema_migrations is empty, but core application tables already exist. ' +
            'Refusing to replay baseline migrations on an existing database. ' +
            'Run `node database/runMigration.js --baseline-through <latest_existing_migration.sql>` once, then rerun migrations.'
        );
    }

    async runMigration(migrationFile) {
        await this.ensureMigrationTable();

        try {
            const sql = this.readMigration(migrationFile);
            const checksum = this.getChecksum(sql);
            const appliedMigrations = await this.getAppliedMigrations();
            const existingChecksum = appliedMigrations.get(migrationFile);

            if (existingChecksum) {
                if (existingChecksum !== checksum) {
                    console.error(
                        `❌ Migration ${migrationFile} was already applied with a different checksum. ` +
                        'Never edit an applied migration; create a new numbered migration instead.'
                    );
                    return false;
                }

                console.log(`Skipping already applied migration: ${migrationFile}`);
                return true;
            }
            
            console.log(`Running migration: ${migrationFile}`);
            
            const client = await this.service.getClient();
            
            try {
                await client.query('BEGIN');
                await client.query(sql);
                await client.query(
                    `INSERT INTO ${MIGRATIONS_TABLE} (filename, checksum)
                     VALUES ($1, $2)`,
                    [migrationFile, checksum]
                );
                await client.query('COMMIT');
                console.log(`✅ Migration ${migrationFile} completed successfully`);
                return true;
            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`❌ Migration ${migrationFile} failed:`, error);
                return false;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error(`❌ Error running migration ${migrationFile}:`, error);
            return false;
        }
    }

    async runAllMigrations() {
        const files = this.getMigrationFiles();
        const appliedMigrations = await this.getAppliedMigrations();

        await this.assertSafeToRunAll(appliedMigrations);

        console.log(`Found ${files.length} migration files`);
        console.log(`Already applied: ${appliedMigrations.size}`);

        for (const file of files) {
            const success = await this.runMigration(file);
            if (!success) {
                console.error(`Stopping migration process due to failure in ${file}`);
                process.exit(1);
            }
        }

        console.log('🎉 All migrations completed successfully!');
    }

    async baselineThrough(targetFile) {
        if (!targetFile) {
            throw new Error('Missing target migration. Usage: node database/runMigration.js --baseline-through <migration.sql>');
        }

        const files = this.getMigrationFiles();
        if (!files.includes(targetFile)) {
            throw new Error(`Migration file not found: ${targetFile}`);
        }

        const appliedMigrations = await this.getAppliedMigrations();
        const targetIndex = files.indexOf(targetFile);
        const filesToBaseline = files.slice(0, targetIndex + 1);

        for (const file of filesToBaseline) {
            const sql = this.readMigration(file);
            const checksum = this.getChecksum(sql);
            const existingChecksum = appliedMigrations.get(file);

            if (existingChecksum && existingChecksum !== checksum) {
                throw new Error(
                    `Cannot baseline ${file}: it is already recorded with a different checksum.`
                );
            }

            if (existingChecksum) {
                console.log(`Already recorded: ${file}`);
                continue;
            }

            const result = await this.service.query(
                `INSERT INTO ${MIGRATIONS_TABLE} (filename, checksum)
                 VALUES ($1, $2)`,
                [file, checksum]
            );

            if (!result.success) {
                throw result.error;
            }

            console.log(`Baselined migration: ${file}`);
        }

        console.log(`✅ Baselined migrations through ${targetFile}`);
    }
}

// Run if called directly
if (require.main === module) {
    const runner = new MigrationRunner();
    
    const command = process.argv[2];
    const migrationFile = process.argv[3];

    (async () => {
        if (command === '--baseline-through') {
            await runner.baselineThrough(migrationFile);
        } else if (command) {
            await runner.runMigration(command);
        } else {
            await runner.runAllMigrations();
        }
    })()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('❌ Migration command failed:', error);
            process.exit(1);
        });
}

module.exports = MigrationRunner;
