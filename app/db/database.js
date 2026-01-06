/**
 * ============================================================================
 * DATABASE CONNECTION & INITIALIZATION
 * ============================================================================
 * 
 * This module provides the SQLite database connection using sql.js.
 * sql.js is a pure JavaScript SQLite implementation that:
 * - Requires no native compilation
 * - Works on any platform without build tools
 * - Loads the database into memory and persists to disk
 * 
 * The database file is stored locally in /db/stock-keeper.db
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

// Database file path - stored in the db directory
const DB_PATH = path.join(__dirname, 'stock-keeper.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Database instance (will be initialized async)
let db = null;
let SQL = null;

// Save interval for periodic persistence (every 5 seconds if changes)
let saveTimer = null;
let isDirty = false;

/**
 * Save database to disk
 */
function saveDatabase() {
    if (db && isDirty) {
        try {
            const data = db.export();
            const buffer = Buffer.from(data);
            fs.writeFileSync(DB_PATH, buffer);
            isDirty = false;
        } catch (error) {
            console.error('Failed to save database:', error.message);
        }
    }
}

/**
 * Mark database as dirty (needs saving)
 */
function markDirty() {
    isDirty = true;
}

/**
 * Initialize the database
 * @returns {Promise} Resolves when database is ready
 */
async function initializeDatabase() {
    try {
        // Initialize SQL.js
        SQL = await initSqlJs();
        
        // Check if database file exists
        if (fs.existsSync(DB_PATH)) {
            // Load existing database
            const fileBuffer = fs.readFileSync(DB_PATH);
            db = new SQL.Database(fileBuffer);
            console.log('✓ Database loaded from disk');
        } else {
            // Create new database
            db = new SQL.Database();
            console.log('✓ New database created');
        }
        
        // Run schema (uses IF NOT EXISTS, safe to run multiple times)
        const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
        db.run(schema);
        
        // Enable foreign keys
        db.run('PRAGMA foreign_keys = ON');
        
        // Save to disk
        saveDatabase();
        
        // Set up periodic save (every 5 seconds)
        saveTimer = setInterval(saveDatabase, 5000);
        
        console.log('✓ Database initialized successfully');
        return db;
    } catch (error) {
        console.error('✗ Database initialization failed:', error.message);
        throw error;
    }
}

/**
 * Helper to run a query and return all results
 */
function all(sql, params = []) {
    if (!db) throw new Error('Database not initialized');
    
    const stmt = db.prepare(sql);
    stmt.bind(params);
    
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}

/**
 * Helper to run a query and return first result
 */
function get(sql, params = []) {
    const results = all(sql, params);
    return results[0] || undefined;
}

/**
 * Helper to run an INSERT/UPDATE/DELETE query
 */
function run(sql, params = []) {
    if (!db) throw new Error('Database not initialized');
    
    db.run(sql, params);
    markDirty();
    
    return {
        lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] || 0,
        changes: db.getRowsModified()
    };
}

// ============================================================================
// ITEM OPERATIONS
// ============================================================================

/**
 * Get all items with optional filtering
 * @param {Object} filters - Optional filters { location, locationId, category, search, expiryStatus }
 * @returns {Array} Array of item objects
 */
function getItems(filters = {}) {
    let sql = `
        SELECT 
            i.*,
            l.name as location_name,
            l.icon as location_icon,
            l.type as location_type,
            l.color as location_color,
            CASE 
                WHEN i.expiry_date IS NULL THEN 'none'
                WHEN date(i.expiry_date) < date('now', 'localtime') THEN 'expired'
                WHEN date(i.expiry_date) = date('now', 'localtime') THEN 'today'
                WHEN date(i.expiry_date) <= date('now', 'localtime', '+3 days') THEN 'soon'
                ELSE 'ok'
            END as expiry_status,
            CASE 
                WHEN i.expiry_date IS NULL THEN NULL
                ELSE CAST(julianday(i.expiry_date) - julianday('now', 'localtime') AS INTEGER)
            END as days_until_expiry
        FROM items i
        LEFT JOIN locations l ON i.location_id = l.id
        WHERE 1=1
    `;
    
    const params = [];
    
    // New: filter by location_id
    if (filters.locationId) {
        sql += ' AND i.location_id = ?';
        params.push(filters.locationId);
    }
    
    // Legacy: filter by location string (for backwards compatibility)
    if (filters.location) {
        sql += ' AND (i.location = ? OR l.type = ?)';
        params.push(filters.location, filters.location);
    }
    
    if (filters.category) {
        sql += ' AND i.category = ?';
        params.push(filters.category);
    }
    
    if (filters.search) {
        sql += ' AND (i.title LIKE ? OR i.description LIKE ? OR i.brand LIKE ?)';
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (filters.expiryStatus) {
        switch (filters.expiryStatus) {
            case 'expired':
                sql += ' AND i.expiry_date IS NOT NULL AND date(i.expiry_date) < date("now", "localtime")';
                break;
            case 'today':
                sql += ' AND date(i.expiry_date) = date("now", "localtime")';
                break;
            case 'soon':
                sql += ' AND i.expiry_date IS NOT NULL AND date(i.expiry_date) > date("now", "localtime") AND date(i.expiry_date) <= date("now", "localtime", "+3 days")';
                break;
            case 'ok':
                sql += ' AND (i.expiry_date IS NULL OR date(i.expiry_date) > date("now", "localtime", "+3 days"))';
                break;
        }
    }
    
    // Default sort: expired first, then by expiry date
    sql += ' ORDER BY CASE WHEN i.expiry_date IS NULL THEN 1 ELSE 0 END, i.expiry_date ASC, i.title ASC';
    
    return all(sql, params);
}

/**
 * Get a single item by ID
 * @param {number} id - Item ID
 * @returns {Object|undefined} Item object or undefined
 */
function getItemById(id) {
    const sql = `
        SELECT 
            i.*,
            l.name as location_name,
            l.icon as location_icon,
            l.type as location_type,
            l.color as location_color,
            CASE 
                WHEN i.expiry_date IS NULL THEN 'none'
                WHEN date(i.expiry_date) < date('now', 'localtime') THEN 'expired'
                WHEN date(i.expiry_date) = date('now', 'localtime') THEN 'today'
                WHEN date(i.expiry_date) <= date('now', 'localtime', '+3 days') THEN 'soon'
                ELSE 'ok'
            END as expiry_status,
            CASE 
                WHEN i.expiry_date IS NULL THEN NULL
                ELSE CAST(julianday(i.expiry_date) - julianday('now', 'localtime') AS INTEGER)
            END as days_until_expiry
        FROM items i
        LEFT JOIN locations l ON i.location_id = l.id
        WHERE i.id = ?
    `;
    return get(sql, [id]);
}

/**
 * Create a new item
 * @param {Object} item - Item data
 * @returns {Object} Result with lastInsertRowid
 */
function createItem(item) {
    const sql = `
        INSERT INTO items (
            title, description, category, location, location_id, brand, is_homemade,
            quantity, unit, date_added, expiry_date, image_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    return run(sql, [
        item.title,
        item.description || '',
        item.category || 'Uncategorized',
        item.location || null, // Legacy field
        item.location_id || null, // New field
        item.is_homemade ? null : (item.brand || null),
        item.is_homemade ? 1 : 0,
        item.quantity || 1,
        item.unit || 'pcs',
        item.date_added || new Date().toISOString().split('T')[0],
        item.expiry_date || null,
        item.image_path || null
    ]);
}

/**
 * Update an existing item
 * @param {number} id - Item ID
 * @param {Object} item - Updated item data
 * @returns {Object} Result with changes count
 */
function updateItem(id, item) {
    const sql = `
        UPDATE items SET
            title = ?,
            description = ?,
            category = ?,
            location = ?,
            location_id = ?,
            brand = ?,
            is_homemade = ?,
            quantity = ?,
            unit = ?,
            date_added = ?,
            expiry_date = ?,
            image_path = COALESCE(?, image_path),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;
    
    return run(sql, [
        item.title,
        item.description || '',
        item.category || 'Uncategorized',
        item.location || null,
        item.location_id || null,
        item.is_homemade ? null : (item.brand || null),
        item.is_homemade ? 1 : 0,
        item.quantity || 1,
        item.unit || 'pcs',
        item.date_added,
        item.expiry_date || null,
        item.image_path || null,
        id
    ]);
}

/**
 * Update item quantity (for quick use/add actions)
 * @param {number} id - Item ID
 * @param {number} quantity - New quantity
 * @returns {Object} Result
 */
function updateItemQuantity(id, quantity) {
    return run('UPDATE items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [quantity, id]);
}

/**
 * Delete an item
 * @param {number} id - Item ID
 * @returns {Object} Result
 */
function deleteItem(id) {
    return run('DELETE FROM items WHERE id = ?', [id]);
}

// ============================================================================
// CONSUMPTION TRACKING
// ============================================================================

/**
 * Log consumption of an item
 * @param {number} itemId - Item ID
 * @param {number} quantityUsed - Amount consumed
 * @param {string} action - 'used', 'discarded', or 'expired'
 * @param {string} notes - Optional notes
 */
function logConsumption(itemId, quantityUsed, action = 'used', notes = '') {
    const item = getItemById(itemId);
    if (!item) return null;
    
    const sql = `
        INSERT INTO consumption_history (item_id, item_title, quantity_used, unit, action, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    return run(sql, [itemId, item.title, quantityUsed, item.unit, action, notes]);
}

/**
 * Get consumption history
 * @param {Object} filters - Optional filters { itemId, days, action }
 * @returns {Array} Consumption records
 */
function getConsumptionHistory(filters = {}) {
    let sql = 'SELECT * FROM consumption_history WHERE 1=1';
    const params = [];
    
    if (filters.itemId) {
        sql += ' AND item_id = ?';
        params.push(filters.itemId);
    }
    
    if (filters.days) {
        sql += ` AND consumed_at >= datetime('now', 'localtime', '-${parseInt(filters.days)} days')`;
    }
    
    if (filters.action) {
        sql += ' AND action = ?';
        params.push(filters.action);
    }
    
    sql += ' ORDER BY consumed_at DESC';
    
    if (filters.limit) {
        sql += ` LIMIT ${parseInt(filters.limit)}`;
    }
    
    return all(sql, params);
}

// ============================================================================
// STATISTICS & DASHBOARD
// ============================================================================

/**
 * Get dashboard statistics
 * @returns {Object} Stats object
 */
function getStats() {
    const stats = {
        totalItems: get('SELECT COUNT(*) as count FROM items')?.count || 0,
        expiredCount: get('SELECT COUNT(*) as count FROM v_expired')?.count || 0,
        expiringSoonCount: get('SELECT COUNT(*) as count FROM v_expiring_soon')?.count || 0,
        lowStockCount: get('SELECT COUNT(*) as count FROM v_low_stock')?.count || 0,
        locationSummary: all('SELECT * FROM v_location_summary'),
        recentConsumption: all('SELECT * FROM v_recent_consumption LIMIT 10')
    };
    
    // Get all locations with item counts
    const locations = getLocations(true); // visible only
    const locationCounts = getLocationCounts();
    
    stats.locations = locations.map(loc => ({
        ...loc,
        count: locationCounts[loc.id] || 0
    }));
    
    // Legacy byLocation for backwards compatibility
    stats.byLocation = {};
    locations.forEach(loc => {
        // Use location type as key for backwards compat
        if (!stats.byLocation[loc.type]) {
            stats.byLocation[loc.type] = 0;
        }
        stats.byLocation[loc.type] += locationCounts[loc.id] || 0;
    });
    
    return stats;
}

/**
 * Get items that are expired
 * @returns {Array} Expired items
 */
function getExpiredItems() {
    return all('SELECT * FROM v_expired');
}

/**
 * Get items expiring soon (within 3 days)
 * @returns {Array} Expiring items
 */
function getExpiringSoonItems() {
    return all('SELECT * FROM v_expiring_soon');
}

/**
 * Get low stock items
 * @returns {Array} Low stock items
 */
function getLowStockItems() {
    return all('SELECT * FROM v_low_stock');
}

// ============================================================================
// LOCATIONS MANAGEMENT
// ============================================================================

/**
 * Get all locations
 * @param {boolean} visibleOnly - Only return visible locations
 * @returns {Array} Location objects
 */
function getLocations(visibleOnly = false) {
    let sql = 'SELECT * FROM locations';
    if (visibleOnly) {
        sql += ' WHERE is_visible = 1';
    }
    sql += ' ORDER BY sort_order ASC, name ASC';
    return all(sql, []);
}

/**
 * Get a single location by ID
 * @param {number} id - Location ID
 * @returns {Object|undefined} Location object
 */
function getLocationById(id) {
    return get('SELECT * FROM locations WHERE id = ?', [id]);
}

/**
 * Create a new location
 * @param {Object} location - Location data
 * @returns {Object} Result with lastInsertRowid
 */
function createLocation(location) {
    // Get max sort_order to add new location at end
    const maxOrder = get('SELECT MAX(sort_order) as max FROM locations')?.max || 0;
    
    const sql = `
        INSERT INTO locations (name, type, icon, color, sort_order, is_visible)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    return run(sql, [
        location.name,
        location.type || 'other',
        location.icon || '📦',
        location.color || '#666666',
        location.sort_order !== undefined ? location.sort_order : maxOrder + 1,
        location.is_visible !== undefined ? (location.is_visible ? 1 : 0) : 1
    ]);
}

/**
 * Update an existing location
 * @param {number} id - Location ID
 * @param {Object} location - Updated location data
 * @returns {Object} Result with changes count
 */
function updateLocation(id, location) {
    const sql = `
        UPDATE locations SET
            name = ?,
            type = ?,
            icon = ?,
            color = ?,
            sort_order = ?,
            is_visible = ?
        WHERE id = ?
    `;
    
    return run(sql, [
        location.name,
        location.type || 'other',
        location.icon || '📦',
        location.color || '#666666',
        location.sort_order || 0,
        location.is_visible !== undefined ? (location.is_visible ? 1 : 0) : 1,
        id
    ]);
}

/**
 * Delete a location
 * @param {number} id - Location ID
 * @returns {Object} Result
 */
function deleteLocation(id) {
    // First, update any items using this location to have NULL location_id
    run('UPDATE items SET location_id = NULL WHERE location_id = ?', [id]);
    return run('DELETE FROM locations WHERE id = ?', [id]);
}

/**
 * Reorder locations
 * @param {Array} orderedIds - Array of location IDs in desired order
 */
function reorderLocations(orderedIds) {
    orderedIds.forEach((id, index) => {
        run('UPDATE locations SET sort_order = ? WHERE id = ?', [index + 1, id]);
    });
}

/**
 * Get location counts (items per location)
 * @returns {Object} Object with location_id: count mappings
 */
function getLocationCounts() {
    const results = all(`
        SELECT location_id, COUNT(*) as count 
        FROM items 
        WHERE location_id IS NOT NULL 
        GROUP BY location_id
    `, []);
    
    const counts = {};
    results.forEach(row => {
        counts[row.location_id] = row.count;
    });
    return counts;
}

// ============================================================================
// CATEGORIES
// ============================================================================

/**
 * Get all categories
 * @returns {Array} Category objects
 */
function getCategories() {
    return all('SELECT * FROM categories ORDER BY sort_order ASC');
}

// ============================================================================
// CSV EXPORT
// ============================================================================

/**
 * Get all items formatted for CSV export
 * @returns {Array} Items with all fields
 */
function getItemsForExport() {
    return all(`
        SELECT 
            id, title, description, category, location, brand, is_homemade,
            quantity, unit, date_added, expiry_date, image_path, created_at, updated_at
        FROM items
        ORDER BY location, category, title
    `);
}

// ============================================================================
// CLEANUP & MAINTENANCE
// ============================================================================

/**
 * Close database connection (for graceful shutdown)
 */
function close() {
    if (saveTimer) {
        clearInterval(saveTimer);
    }
    saveDatabase(); // Final save
    if (db) {
        db.close();
        db = null;
    }
    console.log('✓ Database connection closed');
}

/**
 * Check if database is ready
 * @returns {boolean}
 */
function isReady() {
    return db !== null;
}

/**
 * Wait for database to be ready
 * @returns {Promise}
 */
async function waitForReady() {
    if (db) return Promise.resolve();
    
    // Wait for initialization
    return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
            if (db) {
                clearInterval(checkInterval);
                resolve();
            }
        }, 100);
        
        // Timeout after 10 seconds
        setTimeout(() => {
            clearInterval(checkInterval);
            reject(new Error('Database initialization timeout'));
        }, 10000);
    });
}

// Export all functions
module.exports = {
    initializeDatabase,
    isReady,
    waitForReady,
    // Items
    getItems,
    getItemById,
    createItem,
    updateItem,
    updateItemQuantity,
    deleteItem,
    // Locations
    getLocations,
    getLocationById,
    createLocation,
    updateLocation,
    deleteLocation,
    reorderLocations,
    getLocationCounts,
    // Consumption
    logConsumption,
    getConsumptionHistory,
    // Stats
    getStats,
    getExpiredItems,
    getExpiringSoonItems,
    getLowStockItems,
    // Categories
    getCategories,
    // Export
    getItemsForExport,
    // Cleanup
    close,
    saveDatabase
};
