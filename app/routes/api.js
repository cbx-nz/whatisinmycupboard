/**
 * ============================================================================
 * API ROUTES
 * ============================================================================
 * 
 * JSON API endpoints for AJAX operations and CSV export.
 * These routes are used by client-side JavaScript for dynamic updates
 * without page reloads.
 * 
 * All API routes are prefixed with /api
 */

const express = require('express');
const router = express.Router();
const db = require('../db/database');

// ============================================================================
// ITEM OPERATIONS
// ============================================================================

/**
 * GET /api/items
 * Get all items with optional filtering
 */
router.get('/items', (req, res) => {
    try {
        const { location, category, search, expiry } = req.query;
        
        const filters = {};
        if (location) filters.location = location;
        if (category) filters.category = category;
        if (search) filters.search = search;
        if (expiry) filters.expiryStatus = expiry;
        
        const items = db.getItems(filters);
        res.json({ success: true, items });
    } catch (error) {
        console.error('API get items error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch items' });
    }
});

/**
 * GET /api/items/:id
 * Get single item by ID
 */
router.get('/items/:id', (req, res) => {
    try {
        const item = db.getItemById(req.params.id);
        
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }
        
        res.json({ success: true, item });
    } catch (error) {
        console.error('API get item error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch item' });
    }
});

/**
 * PUT /api/items/:id/quantity
 * Update item quantity (for quick +/- operations)
 */
router.put('/items/:id/quantity', (req, res) => {
    try {
        const item = db.getItemById(req.params.id);
        
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }
        
        const { quantity, delta, action } = req.body;
        let newQuantity;
        
        if (typeof quantity === 'number') {
            // Absolute quantity
            newQuantity = Math.max(0, quantity);
        } else if (typeof delta === 'number') {
            // Relative change
            newQuantity = Math.max(0, item.quantity + delta);
            
            // Log consumption if reducing
            if (delta < 0) {
                db.logConsumption(item.id, Math.abs(delta), action || 'used', '');
            }
        } else {
            return res.status(400).json({ success: false, message: 'quantity or delta required' });
        }
        
        db.updateItemQuantity(item.id, newQuantity);
        
        res.json({ 
            success: true, 
            item: {
                ...item,
                quantity: newQuantity
            }
        });
    } catch (error) {
        console.error('API update quantity error:', error);
        res.status(500).json({ success: false, message: 'Failed to update quantity' });
    }
});

/**
 * DELETE /api/items/:id
 * Delete an item
 */
router.delete('/items/:id', (req, res) => {
    try {
        const item = db.getItemById(req.params.id);
        
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }
        
        db.deleteItem(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('API delete item error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete item' });
    }
});

// ============================================================================
// STATISTICS & DASHBOARD DATA
// ============================================================================

/**
 * GET /api/stats
 * Get dashboard statistics
 */
router.get('/stats', (req, res) => {
    try {
        const stats = db.getStats();
        res.json({ success: true, stats });
    } catch (error) {
        console.error('API stats error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
    }
});

/**
 * GET /api/alerts
 * Get all items needing attention (expired, expiring soon, low stock)
 */
router.get('/alerts', (req, res) => {
    try {
        const expired = db.getExpiredItems();
        const expiringSoon = db.getExpiringSoonItems();
        const lowStock = db.getLowStockItems();
        
        res.json({
            success: true,
            alerts: {
                expired,
                expiringSoon,
                lowStock,
                totalCount: expired.length + expiringSoon.length + lowStock.length
            }
        });
    } catch (error) {
        console.error('API alerts error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch alerts' });
    }
});

/**
 * GET /api/categories
 * Get all categories
 */
router.get('/categories', (req, res) => {
    try {
        const categories = db.getCategories();
        res.json({ success: true, categories });
    } catch (error) {
        console.error('API categories error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch categories' });
    }
});

// ============================================================================
// CONSUMPTION HISTORY
// ============================================================================

/**
 * GET /api/history
 * Get consumption history
 */
router.get('/history', (req, res) => {
    try {
        const { itemId, days, action, limit } = req.query;
        
        const filters = {};
        if (itemId) filters.itemId = parseInt(itemId);
        if (days) filters.days = parseInt(days);
        if (action) filters.action = action;
        if (limit) filters.limit = parseInt(limit);
        
        const history = db.getConsumptionHistory(filters);
        res.json({ success: true, history });
    } catch (error) {
        console.error('API history error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch history' });
    }
});

// ============================================================================
// CSV EXPORT
// ============================================================================

/**
 * GET /api/export/csv
 * Export all inventory items as CSV
 */
router.get('/export/csv', (req, res) => {
    try {
        const items = db.getItemsForExport();
        
        // Build CSV content
        const headers = [
            'ID',
            'Title',
            'Description',
            'Category',
            'Location',
            'Brand',
            'Homemade',
            'Quantity',
            'Unit',
            'Date Added',
            'Expiry Date',
            'Image Path',
            'Created At',
            'Updated At'
        ];
        
        const rows = items.map(item => [
            item.id,
            `"${(item.title || '').replace(/"/g, '""')}"`,
            `"${(item.description || '').replace(/"/g, '""')}"`,
            `"${(item.category || '').replace(/"/g, '""')}"`,
            item.location,
            `"${(item.brand || '').replace(/"/g, '""')}"`,
            item.is_homemade ? 'Yes' : 'No',
            item.quantity,
            item.unit,
            item.date_added || '',
            item.expiry_date || '',
            item.image_path || '',
            item.created_at,
            item.updated_at
        ]);
        
        const csv = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');
        
        // Set headers for file download
        const filename = `stock-keeper-export-${new Date().toISOString().split('T')[0]}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
    } catch (error) {
        console.error('API export error:', error);
        res.status(500).json({ success: false, message: 'Failed to export data' });
    }
});

/**
 * GET /api/export/history/csv
 * Export consumption history as CSV
 */
router.get('/export/history/csv', (req, res) => {
    try {
        const days = parseInt(req.query.days) || 365;
        const history = db.getConsumptionHistory({ days });
        
        const headers = [
            'ID',
            'Item ID',
            'Item Title',
            'Quantity Used',
            'Unit',
            'Action',
            'Notes',
            'Consumed At'
        ];
        
        const rows = history.map(record => [
            record.id,
            record.item_id || '',
            `"${(record.item_title || '').replace(/"/g, '""')}"`,
            record.quantity_used,
            record.unit,
            record.action,
            `"${(record.notes || '').replace(/"/g, '""')}"`,
            record.consumed_at
        ]);
        
        const csv = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');
        
        const filename = `consumption-history-${new Date().toISOString().split('T')[0]}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
    } catch (error) {
        console.error('API export history error:', error);
        res.status(500).json({ success: false, message: 'Failed to export history' });
    }
});

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * POST /api/items/bulk-delete
 * Delete multiple items at once
 */
router.post('/items/bulk-delete', (req, res) => {
    try {
        const { ids } = req.body;
        
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: 'ids array required' });
        }
        
        let deletedCount = 0;
        ids.forEach(id => {
            const result = db.deleteItem(id);
            if (result.changes > 0) deletedCount++;
        });
        
        res.json({ success: true, deletedCount });
    } catch (error) {
        console.error('API bulk delete error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete items' });
    }
});

/**
 * POST /api/items/bulk-update
 * Update multiple items (e.g., move to different location)
 */
router.post('/items/bulk-update', (req, res) => {
    try {
        const { ids, updates } = req.body;
        
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: 'ids array required' });
        }
        
        if (!updates || typeof updates !== 'object') {
            return res.status(400).json({ success: false, message: 'updates object required' });
        }
        
        let updatedCount = 0;
        ids.forEach(id => {
            const item = db.getItemById(id);
            if (item) {
                const updatedItem = { ...item, ...updates };
                const result = db.updateItem(id, updatedItem);
                if (result.changes > 0) updatedCount++;
            }
        });
        
        res.json({ success: true, updatedCount });
    } catch (error) {
        console.error('API bulk update error:', error);
        res.status(500).json({ success: false, message: 'Failed to update items' });
    }
});

module.exports = router;
