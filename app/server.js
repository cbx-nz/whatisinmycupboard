/**
 * ============================================================================
 * STOCK KEEPER - MAIN SERVER
 * ============================================================================
 * 
 * Home inventory / food stock management system designed for:
 * - Raspberry Pi touchscreen (3.5"-5") as primary kiosk display
 * - Phone and desktop clients on the same LAN
 * 
 * This is appliance software, not a website. It runs offline without
 * any cloud dependencies or external APIs.
 * 
 * Architecture:
 * - Express.js for HTTP routing
 * - EJS for server-side templating (no SPA/React)
 * - SQLite for local persistent storage
 * - Multer + Sharp for image upload and processing
 * - Device detection middleware for adaptive UI
 */
require('dotenv').config();

const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');

// Import routes
const itemRoutes = require('./routes/items');
const apiRoutes = require('./routes/api');

// Import database
const db = require('./db/database');
const { config } = require('process');

// ============================================================================
// EXPRESS APP SETUP
// ============================================================================

const app = express();
const PORT = process.env.PORT || 3000;

// Get local IP address for LAN access display
function getLocalIP() {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip internal and non-IPv4 addresses
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return 'localhost';
}

// ============================================================================
// VIEW ENGINE SETUP
// ============================================================================

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Use express-ejs-layouts
app.use(expressLayouts);
app.set('layout', false); // No default layout - routes must specify layout explicitly
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (CSS, JS, uploaded images)
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================================
// DEVICE DETECTION MIDDLEWARE
// ============================================================================
/**
 * Detects device type based on User-Agent and query parameters.
 * 
 * Detection priority:
 * 1. Query parameter ?ui=touch or ?ui=dashboard (allows override)
 * 2. User-Agent analysis for Raspberry Pi / ARM devices
 * 3. User-Agent analysis for mobile vs desktop
 * 
 * The detected device type is stored in res.locals for use in templates
 * and routing decisions.
 */
app.use((req, res, next) => {
    const userAgent = req.get('User-Agent') || '';
    const uiOverride = req.query.ui;
    
    // Allow manual override via query parameter (useful for testing)
    if (uiOverride === 'touch') {
        res.locals.deviceType = 'touch';
        res.locals.uiMode = 'touch';
    } else if (uiOverride === 'dashboard') {
        res.locals.deviceType = 'desktop';
        res.locals.uiMode = 'dashboard';
    } else {
        // Auto-detect based on User-Agent
        const isRaspberryPi = /Raspbian|Linux armv|Linux aarch64/i.test(userAgent);
        const isMobile = /Mobile|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
        const isChromiumKiosk = /Chromium.*armv/i.test(userAgent);
        
        // Raspberry Pi or ARM device in kiosk mode gets touchscreen UI
        if (isRaspberryPi || isChromiumKiosk) {
            res.locals.deviceType = 'raspi';
            res.locals.uiMode = 'touch';
        } else if (isMobile) {
            res.locals.deviceType = 'mobile';
            res.locals.uiMode = 'dashboard'; // Mobile phones get full dashboard
        } else {
            res.locals.deviceType = 'desktop';
            res.locals.uiMode = 'dashboard';
        }
    }
    
    // Make current path available to templates for navigation highlighting
    res.locals.currentPath = req.path;
    
    // Load dynamic locations from database for all templates
    try {
        res.locals.sidebarLocations = db.getLocations(true); // visible only
    } catch (err) {
        res.locals.sidebarLocations = [];
    }
    
    // Make unit labels available globally
    res.locals.unitLabels = {
        pcs: 'pieces',
        g: 'grams',
        kg: 'kilograms',
        ml: 'millilitres',
        L: 'litres'
    };
    
    next();
});

// ============================================================================
// IMAGE UPLOAD CONFIGURATION
// ============================================================================

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename with timestamp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `item-${uniqueSuffix}${ext}`);
    }
});

// File filter - only allow images
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'), false);
    }
};

// Multer upload configuration
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max
    }
});

// Make upload middleware available to routes
app.locals.upload = upload;

/**
 * Image processing middleware
 * Resizes and compresses uploaded images for optimal performance
 * Creates two versions:
 * - Thumbnail (200x200) for list views
 * - Full size (800x800 max) for detail views
 */
async function processUploadedImage(filePath) {
    try {
        const dir = path.dirname(filePath);
        const ext = path.extname(filePath);
        const base = path.basename(filePath, ext);
        
        // Create thumbnail
        const thumbPath = path.join(dir, `${base}-thumb${ext}`);
        await sharp(filePath)
            .resize(200, 200, {
                fit: 'cover',
                position: 'center'
            })
            .jpeg({ quality: 80 })
            .toFile(thumbPath);
        
        // Resize original if too large
        const metadata = await sharp(filePath).metadata();
        if (metadata.width > 800 || metadata.height > 800) {
            const tempPath = path.join(dir, `${base}-temp${ext}`);
            await sharp(filePath)
                .resize(800, 800, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .jpeg({ quality: 85 })
                .toFile(tempPath);
            
            // Replace original with resized version
            fs.unlinkSync(filePath);
            fs.renameSync(tempPath, filePath);
        }
        
        return {
            original: `/uploads/${path.basename(filePath)}`,
            thumbnail: `/uploads/${base}-thumb${ext}`
        };
    } catch (error) {
        console.error('Image processing error:', error);
        return {
            original: `/uploads/${path.basename(filePath)}`,
            thumbnail: `/uploads/${path.basename(filePath)}`
        };
    }
}

app.locals.processUploadedImage = processUploadedImage;

// ============================================================================
// ROUTES
// ============================================================================

// Home route - redirects based on device type
app.get('/', (req, res) => {
    if (res.locals.uiMode === 'touch') {
        res.redirect('/touch');
    } else {
        res.redirect('/dashboard');
    }
});

// Mount route modules
app.use('/', itemRoutes);
app.use('/api', apiRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((req, res) => {
    res.status(404).render(
        res.locals.uiMode === 'touch' ? 'touch/error' : 'dashboard/error',
        {
            title: 'Not Found',
            message: 'The page you requested could not be found.',
            statusCode: 404
        }
    );
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    
    // Handle multer errors
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            err.message = 'File too large. Maximum size is 10MB.';
        }
    }
    
    res.status(err.status || 500).render(
        res.locals.uiMode === 'touch' ? 'touch/error' : 'dashboard/error',
        {
            title: 'Error',
            message: err.message || 'An unexpected error occurred.',
            statusCode: err.status || 500
        }
    );
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Stock Keeper...');
    db.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down Stock Keeper...');
    db.close();
    process.exit(0);
});

// ============================================================================
// START SERVER
// ============================================================================

// Initialize database and start server
async function startServer() {
    try {
        // Initialize the database first
        await db.initializeDatabase();
        
        app.listen(PORT, '0.0.0.0', () => {
            const localIP = getLocalIP();
            
            console.log('');
            console.log('╔════════════════════════════════════════════════════════════╗');
            console.log('║                     STOCK KEEPER                           ║');
            console.log('║            Home Inventory Management System                ║');
            console.log('╠════════════════════════════════════════════════════════════╣');
            console.log(`║  Local:      http://localhost:${PORT}                        ║`);
            console.log(`║  Network:    http://${localIP}:${PORT}                      ║`);
            console.log('╠════════════════════════════════════════════════════════════╣');
            console.log('║  Touchscreen UI:  http://[address]:3000/touch              ║');
            console.log('║  Dashboard UI:    http://[address]:3000/dashboard          ║');
            console.log('╠════════════════════════════════════════════════════════════╣');
            console.log('║  Press Ctrl+C to stop the server                           ║');
            console.log('╚════════════════════════════════════════════════════════════╝');
            console.log('');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

module.exports = app;
