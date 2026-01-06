/**
 * ============================================================================
 * ITEM ROUTES - PAGE RENDERING
 * ============================================================================
 * 
 * This module handles all page rendering routes for both touchscreen and
 * dashboard UIs. Routes are prefixed by UI type (/touch or /dashboard).
 * 
 * Route structure:
 * - /touch/*     - Touchscreen-optimized views for Raspberry Pi
 * - /dashboard/* - Full-featured views for phone/desktop
 * 
 * Both UIs share the same database operations but render different templates
 * optimized for their respective use cases.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../db/database');

// ============================================================================
// TOUCHSCREEN UI ROUTES
// ============================================================================
// Designed for 3.5"-5" Raspberry Pi touchscreens
// Features: Large buttons, minimal text, finger-friendly, high contrast

/**
 * Touchscreen Home
 * Shows quick access to all storage locations with item counts and alerts
 */
router.get('/touch', (req, res) => {
    try {
        const stats = db.getStats();
        const expiredItems = db.getExpiredItems();
        const expiringSoon = db.getExpiringSoonItems();
        const locations = db.getLocations(true); // visible only
        
        res.render('touch/home', {
            layout: false,
            title: 'Stock Keeper',
            stats,
            locations,
            expiredItems,
            expiringSoon,
            alertCount: expiredItems.length + expiringSoon.length
        });
    } catch (error) {
        console.error('Touch home error:', error);
        res.status(500).render('touch/error', {
            layout: false,
            title: 'Error',
            message: 'Failed to load inventory data.',
            statusCode: 500
        });
    }
});

/**
 * Touchscreen Location View
 * Shows all items in a specific location with large thumbnails
 */
router.get('/touch/location/:locationId', (req, res) => {
    const { locationId } = req.params;
    
    try {
        // Try to parse as number (new system) or use as string (legacy)
        const isNumeric = /^\d+$/.test(locationId);
        let location;
        let items;
        
        if (isNumeric) {
            location = db.getLocationById(parseInt(locationId));
            if (!location) {
                return res.status(404).render('touch/error', {
                    layout: false,
                    title: 'Not Found',
                    message: 'Storage location not found.',
                    statusCode: 404
                });
            }
            items = db.getItems({ locationId: parseInt(locationId) });
        } else {
            // Legacy: filter by location type (deprecated - use numeric IDs)
            const legacyLabels = { fridge: '🧊 Fridge', freezer: '❄️ Freezer', cupboard: '🗄️ Cupboard', spice: '🌶️ Spice Rack' };
            const validLocations = ['fridge', 'freezer', 'cupboard', 'spice'];
            if (!validLocations.includes(locationId)) {
                return res.status(404).render('touch/error', {
                    layout: false,
                    title: 'Not Found',
                    message: 'Invalid storage location.',
                    statusCode: 404
                });
            }
            location = { 
                id: locationId, 
                name: legacyLabels[locationId],
                type: locationId,
                icon: locationId === 'fridge' ? '🧊' : locationId === 'freezer' ? '❄️' : locationId === 'cupboard' ? '🗄️' : '🌶️'
            };
            items = db.getItems({ location: locationId });
        }
        
        const categories = db.getCategories();
        const locations = db.getLocations(true);
        
        res.render('touch/location', {
            layout: false,
            title: location.name,
            location,
            locationId: location.id,
            items,
            categories,
            locations
        });
    } catch (error) {
        console.error('Touch location error:', error);
        res.status(500).render('touch/error', {
            layout: false,
            title: 'Error',
            message: 'Failed to load items.',
            statusCode: 500
        });
    }
});

/**
 * Touchscreen Add Item Form
 * Simplified form with large inputs for touchscreen use
 */
router.get('/touch/add', (req, res) => {
    const locationId = req.query.location || req.query.locationId || 1;
    const categories = db.getCategories();
    const locations = db.getLocations(true);
    
    res.render('touch/add', {
        layout: false,
        title: 'Add Item',
        locationId,
        locations,
        categories,
        item: null
    });
});

/**
 * Touchscreen Edit Item Form
 */
router.get('/touch/edit/:id', (req, res) => {
    try {
        const item = db.getItemById(req.params.id);
        
        if (!item) {
            return res.status(404).render('touch/error', {
                layout: false,
                title: 'Not Found',
                message: 'Item not found.',
                statusCode: 404
            });
        }
        
        const categories = db.getCategories();
        const locations = db.getLocations(true);
        
        res.render('touch/edit', {
            layout: false,
            title: 'Edit Item',
            item,
            categories,
            locations,
            locationId: item.location_id
        });
    } catch (error) {
        console.error('Touch edit error:', error);
        res.status(500).render('touch/error', {
            layout: false,
            title: 'Error',
            message: 'Failed to load item.',
            statusCode: 500
        });
    }
});

/**
 * Touchscreen Item Detail
 * Shows item with large image and quick action buttons
 */
router.get('/touch/item/:id', (req, res) => {
    try {
        const item = db.getItemById(req.params.id);
        
        if (!item) {
            return res.status(404).render('touch/error', {
                layout: false,
                title: 'Not Found',
                message: 'Item not found.',
                statusCode: 404
            });
        }
        
        res.render('touch/item', {
            layout: false,
            title: item.title,
            item
        });
    } catch (error) {
        console.error('Touch item error:', error);
        res.status(500).render('touch/error', {
            layout: false,
            title: 'Error',
            message: 'Failed to load item.',
            statusCode: 500
        });
    }
});

/**
 * Touchscreen Alerts View
 * Shows expired and expiring soon items prominently
 */
router.get('/touch/alerts', (req, res) => {
    try {
        const expiredItems = db.getExpiredItems();
        const expiringSoon = db.getExpiringSoonItems();
        
        res.render('touch/alerts', {
            layout: false,
            title: 'Alerts',
            expiredItems,
            expiringSoon
        });
    } catch (error) {
        console.error('Touch alerts error:', error);
        res.status(500).render('touch/error', {
            layout: false,
            title: 'Error',
            message: 'Failed to load alerts.',
            statusCode: 500
        });
    }
});

// ============================================================================
// DASHBOARD UI ROUTES
// ============================================================================
// Full-featured interface for phone and desktop
// Features: Table/grid views, filters, search, bulk edit, stats

/**
 * Dashboard Home
 * Overview with statistics, charts, and quick access to all features
 */
router.get('/dashboard', (req, res) => {
    try {
        const stats = db.getStats();
        const expiredItems = db.getExpiredItems();
        const expiringSoon = db.getExpiringSoonItems();
        const lowStock = db.getLowStockItems();
        const recentItems = db.getItems({}).slice(0, 10);
        const locations = db.getLocations(true); // visible only
        
        res.render('dashboard/home', {
            layout: 'dashboard/layout',
            title: 'Dashboard',
            stats,
            locations,
            expiredItems,
            expiringSoon,
            lowStock,
            recentItems
        });
    } catch (error) {
        console.error('Dashboard home error:', error);
        res.status(500).render('dashboard/error', {
            layout: 'dashboard/layout',
            title: 'Error',
            message: 'Failed to load dashboard data.',
            statusCode: 500
        });
    }
});

/**
 * Dashboard Inventory List
 * Full inventory with filtering, search, and view options
 */
router.get('/dashboard/inventory', (req, res) => {
    try {
        const { location, category, search, expiry, view } = req.query;
        
        const filters = {};
        // Handle location filter - could be numeric ID or legacy string
        if (location) {
            const isNumeric = /^\d+$/.test(location);
            if (isNumeric) {
                filters.locationId = parseInt(location);
            } else {
                filters.location = location;
            }
        }
        if (category) filters.category = category;
        if (search) filters.search = search;
        if (expiry) filters.expiryStatus = expiry;
        
        const items = db.getItems(filters);
        const categories = db.getCategories();
        const locations = db.getLocations(true);
        
        res.render('dashboard/inventory', {
            layout: 'dashboard/layout',
            title: 'Inventory',
            items,
            categories,
            locations,
            filters: { location, category, search, expiry },
            viewMode: view || 'table'
        });
    } catch (error) {
        console.error('Dashboard inventory error:', error);
        res.status(500).render('dashboard/error', {
            layout: 'dashboard/layout',
            title: 'Error',
            message: 'Failed to load inventory.',
            statusCode: 500
        });
    }
});

/**
 * Dashboard Location View
 * Items filtered by location with full dashboard features
 */
router.get('/dashboard/location/:locationId', (req, res) => {
    const { locationId } = req.params;
    
    try {
        const { category, search, expiry, view } = req.query;
        
        // Try to parse as number (new system) or use as string (legacy)
        const isNumeric = /^\d+$/.test(locationId);
        let location;
        let items;
        
        if (isNumeric) {
            location = db.getLocationById(parseInt(locationId));
            if (!location) {
                return res.status(404).render('dashboard/error', {
                    layout: 'dashboard/layout',
                    title: 'Not Found',
                    message: 'Storage location not found.',
                    statusCode: 404
                });
            }
            
            const filters = { locationId: parseInt(locationId) };
            if (category) filters.category = category;
            if (search) filters.search = search;
            if (expiry) filters.expiryStatus = expiry;
            
            items = db.getItems(filters);
        } else {
            // Legacy: filter by location type (deprecated - use numeric IDs)
            const legacyLabels = { fridge: '🧊 Fridge', freezer: '❄️ Freezer', cupboard: '🗄️ Cupboard', spice: '🌶️ Spice Rack' };
            const validLocations = ['fridge', 'freezer', 'cupboard', 'spice'];
            if (!validLocations.includes(locationId)) {
                return res.status(404).render('dashboard/error', {
                    layout: 'dashboard/layout',
                    title: 'Not Found',
                    message: 'Invalid storage location.',
                    statusCode: 404
                });
            }
            
            location = { 
                id: locationId, 
                name: legacyLabels[locationId],
                type: locationId,
                icon: locationId === 'fridge' ? '🧊' : locationId === 'freezer' ? '❄️' : locationId === 'cupboard' ? '🗄️' : '🌶️'
            };
            
            const filters = { location: locationId };
            if (category) filters.category = category;
            if (search) filters.search = search;
            if (expiry) filters.expiryStatus = expiry;
            
            items = db.getItems(filters);
        }
        
        const categories = db.getCategories();
        const locations = db.getLocations(true);
        
        res.render('dashboard/location', {
            layout: 'dashboard/layout',
            title: location.name,
            location,
            locationId: location.id,
            items,
            categories,
            locations,
            filters: { category, search, expiry },
            viewMode: view || 'grid'
        });
    } catch (error) {
        console.error('Dashboard location error:', error);
        res.status(500).render('dashboard/error', {
            layout: 'dashboard/layout',
            title: 'Error',
            message: 'Failed to load items.',
            statusCode: 500
        });
    }
});

/**
 * Dashboard Add Item Form
 * Full-featured form with all fields and image upload
 */
router.get('/dashboard/add', (req, res) => {
    const locationId = req.query.location || req.query.locationId || 1;
    const categories = db.getCategories();
    const locations = db.getLocations(true);
    
    res.render('dashboard/form', {
        layout: 'dashboard/layout',
        title: 'Add Item',
        mode: 'add',
        locationId,
        locations,
        categories,
        item: null
    });
});

/**
 * Dashboard Edit Item Form
 */
router.get('/dashboard/edit/:id', (req, res) => {
    try {
        const item = db.getItemById(req.params.id);
        
        if (!item) {
            return res.status(404).render('dashboard/error', {
                layout: 'dashboard/layout',
                title: 'Not Found',
                message: 'Item not found.',
                statusCode: 404
            });
        }
        
        const categories = db.getCategories();
        const locations = db.getLocations(true);
        
        res.render('dashboard/form', {
            layout: 'dashboard/layout',
            title: 'Edit Item',
            mode: 'edit',
            item,
            categories,
            locations,
            locationId: item.location_id
        });
    } catch (error) {
        console.error('Dashboard edit error:', error);
        res.status(500).render('dashboard/error', {
            layout: 'dashboard/layout',
            title: 'Error',
            message: 'Failed to load item.',
            statusCode: 500
        });
    }
});

/**
 * Dashboard Item Detail
 * Full item view with history and all details
 */
router.get('/dashboard/item/:id', (req, res) => {
    try {
        const item = db.getItemById(req.params.id);
        
        if (!item) {
            return res.status(404).render('dashboard/error', {
                layout: 'dashboard/layout',
                title: 'Not Found',
                message: 'Item not found.',
                statusCode: 404
            });
        }
        
        const history = db.getConsumptionHistory({ itemId: item.id, limit: 20 });
        
        res.render('dashboard/item', {
            layout: 'dashboard/layout',
            title: item.title,
            item,
            history
        });
    } catch (error) {
        console.error('Dashboard item error:', error);
        res.status(500).render('dashboard/error', {
            layout: 'dashboard/layout',
            title: 'Error',
            message: 'Failed to load item.',
            statusCode: 500
        });
    }
});

/**
 * Dashboard Alerts/Expiry View
 */
router.get('/dashboard/alerts', (req, res) => {
    try {
        const expiredItems = db.getExpiredItems();
        const expiringSoon = db.getExpiringSoonItems();
        const lowStock = db.getLowStockItems();
        
        res.render('dashboard/alerts', {
            layout: 'dashboard/layout',
            title: 'Alerts',
            expiredItems,
            expiringSoon,
            lowStock
        });
    } catch (error) {
        console.error('Dashboard alerts error:', error);
        res.status(500).render('dashboard/error', {
            layout: 'dashboard/layout',
            title: 'Error',
            message: 'Failed to load alerts.',
            statusCode: 500
        });
    }
});

/**
 * Dashboard History View
 */
router.get('/dashboard/history', (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const history = db.getConsumptionHistory({ days, limit: 100 });
        
        res.render('dashboard/history', {
            layout: 'dashboard/layout',
            title: 'Consumption History',
            history,
            days
        });
    } catch (error) {
        console.error('Dashboard history error:', error);
        res.status(500).render('dashboard/error', {
            layout: 'dashboard/layout',
            title: 'Error',
            message: 'Failed to load history.',
            statusCode: 500
        });
    }
});

// ============================================================================
// FORM SUBMISSION ROUTES (shared between UIs)
// ============================================================================

/**
 * Create new item
 * Handles form submission from both touch and dashboard UIs
 */
router.post('/items/create', (req, res) => {
    const upload = req.app.locals.upload;
    
    upload.single('image')(req, res, async (err) => {
        if (err) {
            console.error('Upload error:', err);
            const locationParam = req.body.location_id || req.body.location || 1;
            const redirectUrl = res.locals.uiMode === 'touch' 
                ? `/touch/add?location=${locationParam}&error=upload`
                : `/dashboard/add?location=${locationParam}&error=upload`;
            return res.redirect(redirectUrl);
        }
        
        try {
            const locationId = req.body.location_id ? parseInt(req.body.location_id) : null;
            
            const itemData = {
                title: req.body.title,
                description: req.body.description || '',
                category: req.body.category || 'Uncategorized',
                location: req.body.location || null, // Legacy field
                location_id: locationId, // New field
                brand: req.body.brand || null,
                is_homemade: req.body.is_homemade === 'on' || req.body.is_homemade === '1',
                quantity: parseFloat(req.body.quantity) || 1,
                unit: req.body.unit || 'pcs',
                date_added: req.body.date_added || new Date().toISOString().split('T')[0],
                expiry_date: req.body.expiry_date || null
            };
            
            // Process uploaded image if present
            if (req.file) {
                const processImage = req.app.locals.processUploadedImage;
                const imagePaths = await processImage(req.file.path);
                itemData.image_path = imagePaths.original;
            }
            
            const result = db.createItem(itemData);
            
            // Redirect based on UI mode - use location_id for new system
            const redirectLocation = locationId || itemData.location || 1;
            if (res.locals.uiMode === 'touch') {
                res.redirect(`/touch/location/${redirectLocation}`);
            } else {
                res.redirect(`/dashboard/item/${result.lastInsertRowid}`);
            }
        } catch (error) {
            console.error('Create item error:', error);
            const locationParam = req.body.location_id || req.body.location || 1;
            const redirectUrl = res.locals.uiMode === 'touch' 
                ? `/touch/add?location=${locationParam}&error=save`
                : `/dashboard/add?location=${locationParam}&error=save`;
            res.redirect(redirectUrl);
        }
    });
});

/**
 * Update existing item
 */
router.post('/items/update/:id', (req, res) => {
    const upload = req.app.locals.upload;
    const itemId = req.params.id;
    
    upload.single('image')(req, res, async (err) => {
        if (err) {
            console.error('Upload error:', err);
            return res.redirect(`/${res.locals.uiMode === 'touch' ? 'touch' : 'dashboard'}/edit/${itemId}?error=upload`);
        }
        
        try {
            const existingItem = db.getItemById(itemId);
            if (!existingItem) {
                return res.status(404).redirect(res.locals.uiMode === 'touch' ? '/touch' : '/dashboard');
            }
            
            const locationId = req.body.location_id ? parseInt(req.body.location_id) : null;
            
            const itemData = {
                title: req.body.title,
                description: req.body.description || '',
                category: req.body.category || 'Uncategorized',
                location: req.body.location || null, // Legacy field
                location_id: locationId, // New field
                brand: req.body.brand || null,
                is_homemade: req.body.is_homemade === 'on' || req.body.is_homemade === '1',
                quantity: parseFloat(req.body.quantity) || 1,
                unit: req.body.unit || 'pcs',
                date_added: req.body.date_added || existingItem.date_added,
                expiry_date: req.body.expiry_date || null
            };
            
            // Process uploaded image if present
            if (req.file) {
                const processImage = req.app.locals.processUploadedImage;
                const imagePaths = await processImage(req.file.path);
                itemData.image_path = imagePaths.original;
                
                // Delete old image if exists
                if (existingItem.image_path) {
                    const oldImagePath = path.join(__dirname, '..', 'public', existingItem.image_path);
                    if (fs.existsSync(oldImagePath)) {
                        fs.unlinkSync(oldImagePath);
                    }
                    // Also delete thumbnail
                    const oldThumbPath = oldImagePath.replace(/(\.[^.]+)$/, '-thumb$1');
                    if (fs.existsSync(oldThumbPath)) {
                        fs.unlinkSync(oldThumbPath);
                    }
                }
            }
            
            db.updateItem(itemId, itemData);
            
            // Redirect based on UI mode
            if (res.locals.uiMode === 'touch') {
                res.redirect(`/touch/item/${itemId}`);
            } else {
                res.redirect(`/dashboard/item/${itemId}`);
            }
        } catch (error) {
            console.error('Update item error:', error);
            res.redirect(`/${res.locals.uiMode === 'touch' ? 'touch' : 'dashboard'}/edit/${itemId}?error=save`);
        }
    });
});

/**
 * Delete item
 */
router.post('/items/delete/:id', (req, res) => {
    try {
        const item = db.getItemById(req.params.id);
        
        if (item) {
            // Delete associated images
            if (item.image_path) {
                const imagePath = path.join(__dirname, '..', 'public', item.image_path);
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
                const thumbPath = imagePath.replace(/(\.[^.]+)$/, '-thumb$1');
                if (fs.existsSync(thumbPath)) {
                    fs.unlinkSync(thumbPath);
                }
            }
            
            db.deleteItem(req.params.id);
        }
        
        // Redirect based on UI mode and referrer - use location_id if available
        const locationRef = item ? (item.location_id || item.location || 1) : 1;
        if (res.locals.uiMode === 'touch') {
            res.redirect(`/touch/location/${locationRef}`);
        } else {
            res.redirect(`/dashboard/location/${locationRef}`);
        }
    } catch (error) {
        console.error('Delete item error:', error);
        res.redirect(res.locals.uiMode === 'touch' ? '/touch' : '/dashboard');
    }
});

/**
 * Quick use item (reduce quantity)
 * Used by both touch and dashboard UIs for quick actions
 */
router.post('/items/use/:id', (req, res) => {
    try {
        const item = db.getItemById(req.params.id);
        
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }
        
        const amount = parseFloat(req.body.amount) || 1;
        const newQuantity = Math.max(0, item.quantity - amount);
        
        // Log consumption
        db.logConsumption(item.id, amount, 'used', req.body.notes || '');
        
        // Update quantity
        db.updateItemQuantity(item.id, newQuantity);
        
        // Handle response based on request type
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.json({ 
                success: true, 
                newQuantity,
                depleted: newQuantity === 0
            });
        }
        
        // Redirect for form submissions
        const returnUrl = req.body.returnUrl || (res.locals.uiMode === 'touch' 
            ? `/touch/location/${item.location}`
            : `/dashboard/item/${item.id}`);
        res.redirect(returnUrl);
    } catch (error) {
        console.error('Use item error:', error);
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(500).json({ success: false, message: 'Failed to update item' });
        }
        res.redirect(res.locals.uiMode === 'touch' ? '/touch' : '/dashboard');
    }
});

/**
 * Quick add quantity
 */
router.post('/items/add-quantity/:id', (req, res) => {
    try {
        const item = db.getItemById(req.params.id);
        
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }
        
        const amount = parseFloat(req.body.amount) || 1;
        const newQuantity = item.quantity + amount;
        
        db.updateItemQuantity(item.id, newQuantity);
        
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.json({ success: true, newQuantity });
        }
        
        const returnUrl = req.body.returnUrl || (res.locals.uiMode === 'touch' 
            ? `/touch/location/${item.location}`
            : `/dashboard/item/${item.id}`);
        res.redirect(returnUrl);
    } catch (error) {
        console.error('Add quantity error:', error);
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(500).json({ success: false, message: 'Failed to update item' });
        }
        res.redirect(res.locals.uiMode === 'touch' ? '/touch' : '/dashboard');
    }
});

/**
 * Mark item as discarded/expired
 */
router.post('/items/discard/:id', (req, res) => {
    try {
        const item = db.getItemById(req.params.id);
        
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }
        
        const action = req.body.action || 'discarded';
        
        // Log the discard/expiry
        db.logConsumption(item.id, item.quantity, action, req.body.notes || '');
        
        // Set quantity to 0
        db.updateItemQuantity(item.id, 0);
        
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.json({ success: true });
        }
        
        const returnUrl = req.body.returnUrl || (res.locals.uiMode === 'touch' 
            ? `/touch/location/${item.location_id || item.location}`
            : `/dashboard/alerts`);
        res.redirect(returnUrl);
    } catch (error) {
        console.error('Discard item error:', error);
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(500).json({ success: false, message: 'Failed to discard item' });
        }
        res.redirect(res.locals.uiMode === 'touch' ? '/touch' : '/dashboard');
    }
});

// ============================================================================
// LOCATION MANAGEMENT ROUTES
// ============================================================================

/**
 * Dashboard Locations Management Page
 */
router.get('/dashboard/locations', (req, res) => {
    try {
        const locations = db.getLocations(false); // all locations
        const locationCounts = db.getLocationCounts();
        
        res.render('dashboard/locations', {
            layout: 'dashboard/layout',
            title: 'Manage Locations',
            locations: locations.map(loc => ({
                ...loc,
                itemCount: locationCounts[loc.id] || 0
            }))
        });
    } catch (error) {
        console.error('Locations page error:', error);
        res.status(500).render('dashboard/error', {
            layout: 'dashboard/layout',
            title: 'Error',
            message: 'Failed to load locations.',
            statusCode: 500
        });
    }
});

/**
 * Create a new location
 */
router.post('/locations/create', (req, res) => {
    try {
        const { name, type, icon, color } = req.body;
        
        if (!name || !name.trim()) {
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(400).json({ success: false, message: 'Location name is required' });
            }
            return res.redirect('/dashboard/locations?error=name_required');
        }
        
        const result = db.createLocation({
            name: name.trim(),
            type: type || 'other',
            icon: icon || '📦',
            color: color || '#666666',
            is_visible: true
        });
        
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.json({ 
                success: true, 
                id: result.lastInsertRowid,
                message: 'Location created successfully'
            });
        }
        
        res.redirect('/dashboard/locations');
    } catch (error) {
        console.error('Create location error:', error);
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(500).json({ success: false, message: 'Failed to create location' });
        }
        res.redirect('/dashboard/locations?error=create_failed');
    }
});

/**
 * Update an existing location
 */
router.post('/locations/update/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { name, type, icon, color, is_visible, sort_order } = req.body;
        
        const existing = db.getLocationById(parseInt(id));
        if (!existing) {
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(404).json({ success: false, message: 'Location not found' });
            }
            return res.redirect('/dashboard/locations?error=not_found');
        }
        
        db.updateLocation(parseInt(id), {
            name: name?.trim() || existing.name,
            type: type || existing.type,
            icon: icon || existing.icon,
            color: color || existing.color,
            is_visible: is_visible !== undefined ? (is_visible === 'true' || is_visible === '1') : existing.is_visible,
            sort_order: sort_order !== undefined ? parseInt(sort_order) : existing.sort_order
        });
        
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.json({ success: true, message: 'Location updated successfully' });
        }
        
        res.redirect('/dashboard/locations');
    } catch (error) {
        console.error('Update location error:', error);
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(500).json({ success: false, message: 'Failed to update location' });
        }
        res.redirect('/dashboard/locations?error=update_failed');
    }
});

/**
 * Delete a location
 */
router.post('/locations/delete/:id', (req, res) => {
    try {
        const { id } = req.params;
        const existing = db.getLocationById(parseInt(id));
        
        if (!existing) {
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(404).json({ success: false, message: 'Location not found' });
            }
            return res.redirect('/dashboard/locations?error=not_found');
        }
        
        db.deleteLocation(parseInt(id));
        
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.json({ success: true, message: 'Location deleted successfully' });
        }
        
        res.redirect('/dashboard/locations');
    } catch (error) {
        console.error('Delete location error:', error);
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(500).json({ success: false, message: 'Failed to delete location' });
        }
        res.redirect('/dashboard/locations?error=delete_failed');
    }
});

/**
 * Get all locations (JSON API)
 */
router.get('/api/locations', (req, res) => {
    try {
        const visibleOnly = req.query.visible === 'true';
        const locations = db.getLocations(visibleOnly);
        const counts = db.getLocationCounts();
        
        res.json({
            success: true,
            locations: locations.map(loc => ({
                ...loc,
                itemCount: counts[loc.id] || 0
            }))
        });
    } catch (error) {
        console.error('Get locations API error:', error);
        res.status(500).json({ success: false, message: 'Failed to get locations' });
    }
});

module.exports = router;
