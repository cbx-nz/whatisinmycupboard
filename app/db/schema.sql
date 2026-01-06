-- ============================================================================
-- STOCK KEEPER DATABASE SCHEMA
-- SQLite database schema for home inventory / food stock management
-- Designed for offline Raspberry Pi operation with LAN access
-- ============================================================================

-- Enable foreign key constraints for referential integrity
PRAGMA foreign_keys = ON;

-- ============================================================================
-- STORAGE LOCATIONS TABLE
-- Custom storage locations (e.g., "Kitchen Fridge", "Garage Freezer")
-- ============================================================================
CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Display name (e.g., "Kitchen Fridge", "Garage Freezer")
    name TEXT NOT NULL,
    
    -- Location type for grouping/filtering
    type TEXT NOT NULL DEFAULT 'other' CHECK(type IN ('fridge', 'freezer', 'cupboard', 'spice', 'pantry', 'other')),
    
    -- Emoji icon for visual identification
    icon TEXT DEFAULT '📦',
    
    -- CSS color class or hex color
    color TEXT DEFAULT '#666666',
    
    -- Sort order for display
    sort_order INTEGER DEFAULT 0,
    
    -- Whether this location is visible on home screen
    is_visible INTEGER DEFAULT 1 CHECK(is_visible IN (0, 1)),
    
    -- Audit timestamps
    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
    updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
);

-- Insert default locations
INSERT OR IGNORE INTO locations (id, name, type, icon, color, sort_order) VALUES
    (1, 'Freezer', 'freezer', '❄️', '#81d4fa', 1);

-- ============================================================================
-- INVENTORY ITEMS TABLE
-- Core table storing all stock items across all locations
-- ============================================================================
CREATE TABLE IF NOT EXISTS items (
    -- Primary identifier, auto-incrementing
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Human-readable name of the item (e.g., "Chicken Breast", "Milk")
    title TEXT NOT NULL,
    
    -- Optional notes/description (e.g., "Organic, free-range")
    description TEXT DEFAULT '',
    
    -- Category for filtering (e.g., "Dairy", "Meat", "Vegetables", "Condiments")
    category TEXT NOT NULL DEFAULT 'Uncategorized',
    
    -- Storage location - can be legacy string or new location_id
    location TEXT DEFAULT NULL,
    
    -- Reference to locations table (new system)
    location_id INTEGER DEFAULT NULL,
    
    -- Brand name if store-bought, NULL if homemade
    brand TEXT DEFAULT NULL,
    
    -- Flag indicating if item is homemade (1) or store-bought (0)
    -- If homemade=1, brand should be NULL
    is_homemade INTEGER DEFAULT 0 CHECK(is_homemade IN (0, 1)),
    
    -- Quantity on hand (supports decimals for partial items)
    quantity REAL NOT NULL DEFAULT 1 CHECK(quantity >= 0),
    
    -- Unit of measurement
    unit TEXT NOT NULL DEFAULT 'pcs' CHECK(unit IN ('pcs', 'g', 'kg', 'ml', 'L')),
    
    -- Date the item was added to stock (user-specified, may differ from created_at)
    date_added DATE NOT NULL DEFAULT (date('now')),
    
    -- Expiration date (NULL means no expiry, e.g., salt, spices)
    expiry_date DATE DEFAULT NULL,
    
    -- Relative path to uploaded image (stored in /public/uploads/)
    image_path TEXT DEFAULT NULL,
    
    -- Audit timestamps (auto-managed)
    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
    updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
    
    -- Foreign key to locations table
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
);

-- ============================================================================
-- CONSUMPTION HISTORY TABLE
-- Tracks usage of items over time for analytics and patterns
-- ============================================================================
CREATE TABLE IF NOT EXISTS consumption_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Reference to the item that was consumed
    item_id INTEGER NOT NULL,
    
    -- Snapshot of item title at time of consumption (in case item is deleted)
    item_title TEXT NOT NULL,
    
    -- Amount consumed
    quantity_used REAL NOT NULL CHECK(quantity_used > 0),
    
    -- Unit at time of consumption
    unit TEXT NOT NULL,
    
    -- Type of consumption event
    action TEXT NOT NULL DEFAULT 'used' CHECK(action IN ('used', 'discarded', 'expired')),
    
    -- Optional notes about the consumption
    notes TEXT DEFAULT '',
    
    -- When the consumption occurred
    consumed_at DATETIME DEFAULT (datetime('now', 'localtime')),
    
    -- Foreign key to items table (SET NULL if item deleted to preserve history)
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL
);

-- ============================================================================
-- CATEGORIES TABLE
-- Predefined categories for consistent organization
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    icon TEXT DEFAULT '📦',
    sort_order INTEGER DEFAULT 0
);

-- Insert default categories
INSERT OR IGNORE INTO categories (name, icon, sort_order) VALUES
    ('Dairy', '🥛', 1),
    ('Meat', '🥩', 2),
    ('Poultry', '🍗', 3),
    ('Seafood', '🐟', 4),
    ('Vegetables', '🥬', 5),
    ('Fruits', '🍎', 6),
    ('Bread & Bakery', '🍞', 7),
    ('Grains & Pasta', '🌾', 8),
    ('Canned Goods', '🥫', 9),
    ('Condiments', '🧂', 10),
    ('Sauces', '🍝', 11),
    ('Snacks', '🍿', 12),
    ('Beverages', '🥤', 13),
    ('Frozen Foods', '🧊', 14),
    ('Leftovers', '🍱', 15),
    ('Spices', '🌶️', 16),
    ('Herbs', '🌿', 17),
    ('Oils & Vinegars', '🫒', 18),
    ('Baking', '🧁', 19),
    ('Ready Meals', '🍲', 20),
    ('Uncategorized', '📦', 99);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- Optimize common query patterns
-- ============================================================================

-- Location ID filtering (new system)
CREATE INDEX IF NOT EXISTS idx_items_location_id ON items(location_id);

-- Legacy location filtering
CREATE INDEX IF NOT EXISTS idx_items_location ON items(location);

-- Category filtering
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);

-- Expiry date sorting (critical for expiry warnings)
CREATE INDEX IF NOT EXISTS idx_items_expiry ON items(expiry_date);

-- Combined location_id + expiry for dashboard views
CREATE INDEX IF NOT EXISTS idx_items_location_id_expiry ON items(location_id, expiry_date);

-- Consumption history by date for analytics
CREATE INDEX IF NOT EXISTS idx_consumption_date ON consumption_history(consumed_at);

-- Consumption history by item for item-specific reports
CREATE INDEX IF NOT EXISTS idx_consumption_item ON consumption_history(item_id);

-- ============================================================================
-- TRIGGERS
-- Automatically update timestamps on modification
-- ============================================================================

-- Update the updated_at timestamp whenever an item is modified
CREATE TRIGGER IF NOT EXISTS update_item_timestamp 
    AFTER UPDATE ON items
    FOR EACH ROW
BEGIN
    UPDATE items SET updated_at = datetime('now', 'localtime') WHERE id = OLD.id;
END;

-- Update the updated_at timestamp whenever a location is modified
CREATE TRIGGER IF NOT EXISTS update_location_timestamp 
    AFTER UPDATE ON locations
    FOR EACH ROW
BEGIN
    UPDATE locations SET updated_at = datetime('now', 'localtime') WHERE id = OLD.id;
END;

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- Pre-built queries for dashboard statistics
-- ============================================================================

-- View: Items expiring within 3 days (for warnings)
CREATE VIEW IF NOT EXISTS v_expiring_soon AS
SELECT 
    i.*,
    l.name as location_name,
    l.icon as location_icon,
    julianday(i.expiry_date) - julianday('now', 'localtime') AS days_until_expiry
FROM items i
LEFT JOIN locations l ON i.location_id = l.id
WHERE i.expiry_date IS NOT NULL
  AND date(i.expiry_date) >= date('now', 'localtime')
  AND date(i.expiry_date) <= date('now', 'localtime', '+3 days')
ORDER BY i.expiry_date ASC;

-- View: Expired items (need attention)
CREATE VIEW IF NOT EXISTS v_expired AS
SELECT 
    i.*,
    l.name as location_name,
    l.icon as location_icon,
    julianday('now', 'localtime') - julianday(i.expiry_date) AS days_expired
FROM items i
LEFT JOIN locations l ON i.location_id = l.id
WHERE i.expiry_date IS NOT NULL
  AND date(i.expiry_date) < date('now', 'localtime')
ORDER BY i.expiry_date ASC;

-- View: Low stock items (quantity <= 1)
CREATE VIEW IF NOT EXISTS v_low_stock AS
SELECT i.*, l.name as location_name, l.icon as location_icon
FROM items i
LEFT JOIN locations l ON i.location_id = l.id
WHERE i.quantity <= 1 AND i.quantity > 0
ORDER BY i.quantity ASC, i.title ASC;

-- View: Inventory summary by location (using location_id)
CREATE VIEW IF NOT EXISTS v_location_summary AS
SELECT 
    l.id as location_id,
    l.name as location_name,
    l.icon,
    l.type,
    l.color,
    COUNT(i.id) as total_items,
    SUM(CASE WHEN i.expiry_date IS NOT NULL AND date(i.expiry_date) < date('now', 'localtime') THEN 1 ELSE 0 END) as expired_count,
    SUM(CASE WHEN i.expiry_date IS NOT NULL AND date(i.expiry_date) >= date('now', 'localtime') AND date(i.expiry_date) <= date('now', 'localtime', '+3 days') THEN 1 ELSE 0 END) as expiring_soon_count
FROM locations l
LEFT JOIN items i ON i.location_id = l.id
WHERE l.is_visible = 1
GROUP BY l.id
ORDER BY l.sort_order ASC;

-- View: Consumption statistics for the last 30 days
CREATE VIEW IF NOT EXISTS v_recent_consumption AS
SELECT 
    item_title,
    SUM(quantity_used) as total_consumed,
    unit,
    COUNT(*) as consumption_events,
    MAX(consumed_at) as last_consumed
FROM consumption_history
WHERE consumed_at >= datetime('now', 'localtime', '-30 days')
GROUP BY item_title, unit
ORDER BY total_consumed DESC;
