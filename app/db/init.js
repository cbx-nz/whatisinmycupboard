/**
 * Database Initialization Script
 * 
 * Run with: npm run init-db
 * 
 * This script initializes the SQLite database with the schema
 * defined in schema.sql
 */

const db = require('./database');

async function init() {
    console.log('Initializing Stock Keeper database...\n');
    
    try {
        await db.initializeDatabase();
        
        // Force save to disk
        db.saveDatabase();
        
        console.log('\n✓ Database initialization complete!');
        console.log('  You can now start the server with: npm start\n');
        
        db.close();
        process.exit(0);
    } catch (error) {
        console.error('\n✗ Database initialization failed:', error);
        process.exit(1);
    }
}

init();
