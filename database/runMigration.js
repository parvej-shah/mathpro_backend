const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Load environment variables
const { Service } = require('../service/base');

class MigrationRunner {
    constructor() {
        this.service = new Service();
    }

    async runMigration(migrationFile) {
        try {
            const migrationPath = path.join(__dirname, 'migrations', migrationFile);
            const sql = fs.readFileSync(migrationPath, 'utf8');
            
            console.log(`Running migration: ${migrationFile}`);
            
            const result = await this.service.query(sql);
            
            if (result.success) {
                console.log(`✅ Migration ${migrationFile} completed successfully`);
                return true;
            } else {
                console.error(`❌ Migration ${migrationFile} failed:`, result.error);
                return false;
            }
        } catch (error) {
            console.error(`❌ Error running migration ${migrationFile}:`, error);
            return false;
        }
    }

    async runAllMigrations() {
        const migrationsDir = path.join(__dirname, 'migrations');
        const files = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();

        console.log(`Found ${files.length} migration files`);

        for (const file of files) {
            const success = await this.runMigration(file);
            if (!success) {
                console.error(`Stopping migration process due to failure in ${file}`);
                process.exit(1);
            }
        }

        console.log('🎉 All migrations completed successfully!');
    }
}

// Run if called directly
if (require.main === module) {
    const runner = new MigrationRunner();
    
    const migrationFile = process.argv[2];
    
    if (migrationFile) {
        runner.runMigration(migrationFile);
    } else {
        runner.runAllMigrations();
    }
}

module.exports = MigrationRunner;