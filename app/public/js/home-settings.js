/**
 * ============================================================================
 * HOME SETTINGS - LocalStorage-based Display Customization
 * ============================================================================
 * 
 * Allows users to:
 * - Choose which storage locations to display on home screen
 * - Auto-redirect to a single location if only one is selected
 * - Persist preferences in browser localStorage
 * 
 * Now uses dynamic location IDs from the database
 */

(function() {
    'use strict';

    // ========================================================================
    // CONFIGURATION
    // ========================================================================
    
    const STORAGE_KEY = 'stockkeeper_home_settings';

    // Detect which UI we're on (touch or dashboard)
    const isTouchUI = document.body.classList.contains('touch-ui');
    const urlPrefix = isTouchUI ? '/touch' : '/dashboard';

    // Get all location IDs from the DOM (populated by server)
    function getAllLocationIds() {
        const cards = document.querySelectorAll('[data-location-id]');
        return Array.from(cards).map(card => card.dataset.locationId);
    }

    // ========================================================================
    // STORAGE FUNCTIONS
    // ========================================================================
    
    function getSettings() {
        const allLocationIds = getAllLocationIds();
        
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Validate and filter to existing location IDs
                const validLocations = Array.isArray(parsed.visibleLocations) 
                    ? parsed.visibleLocations.filter(id => allLocationIds.includes(String(id)))
                    : allLocationIds;
                    
                return {
                    visibleLocations: validLocations.length > 0 ? validLocations : allLocationIds,
                    autoRedirect: typeof parsed.autoRedirect === 'boolean' 
                        ? parsed.autoRedirect 
                        : false
                };
            }
        } catch (e) {
            console.warn('Failed to load settings from localStorage:', e);
        }
        
        // Default: show all locations
        return { visibleLocations: allLocationIds, autoRedirect: false };
    }

    function saveSettings(settings) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
            return true;
        } catch (e) {
            console.error('Failed to save settings to localStorage:', e);
            return false;
        }
    }

    function resetSettings() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            return true;
        } catch (e) {
            console.error('Failed to reset settings:', e);
            return false;
        }
    }

    // ========================================================================
    // UI FUNCTIONS
    // ========================================================================

    function applySettings(settings) {
        const locationGrid = document.getElementById('locationGrid');
        if (!locationGrid) return;

        const locationCards = locationGrid.querySelectorAll('[data-location-id]');
        let visibleCount = 0;
        
        locationCards.forEach(card => {
            const locationId = card.dataset.locationId;
            if (settings.visibleLocations.includes(locationId)) {
                card.style.display = '';
                card.classList.remove('hidden');
                visibleCount++;
            } else {
                card.style.display = 'none';
                card.classList.add('hidden');
            }
        });

        // Adjust grid layout based on visible count
        locationGrid.classList.remove('grid-1', 'grid-2', 'grid-3', 'grid-4');
        locationGrid.classList.add(`grid-${Math.min(visibleCount, 4)}`);
    }
    }

    function checkAutoRedirect(settings) {
        // Only redirect if autoRedirect is enabled and exactly one location is visible
        if (settings.autoRedirect && settings.visibleLocations.length === 1) {
            const targetLocation = settings.visibleLocations[0];
            const currentPath = window.location.pathname;
            const targetPath = `${urlPrefix}/location/${targetLocation}`;
            
            // Don't redirect if we're already on the target page or coming back from it
            if (currentPath !== targetPath && !sessionStorage.getItem('stockkeeper_redirected')) {
                sessionStorage.setItem('stockkeeper_redirected', 'true');
                window.location.href = targetPath;
                return true;
            }
        }
        
        // Clear redirect flag when on home page
        if (window.location.pathname === urlPrefix || window.location.pathname === urlPrefix + '/') {
            sessionStorage.removeItem('stockkeeper_redirected');
        }
        
        return false;
    }

    function updateModalFromSettings(settings) {
        // Update location checkboxes
        const checkboxes = document.querySelectorAll('.location-toggle input[data-location-id]');
        checkboxes.forEach(checkbox => {
            const locationId = checkbox.dataset.locationId;
            checkbox.checked = settings.visibleLocations.includes(locationId);
        });

        // Update auto-redirect checkbox
        const autoRedirectCheckbox = document.getElementById('autoRedirect');
        if (autoRedirectCheckbox) {
            autoRedirectCheckbox.checked = settings.autoRedirect;
        }
    }

    function getSettingsFromModal() {
        const visibleLocations = [];
        
        const checkboxes = document.querySelectorAll('.location-toggle input[data-location-id]');
        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                visibleLocations.push(checkbox.dataset.locationId);
            }
        });

        const autoRedirectCheckbox = document.getElementById('autoRedirect');
        const autoRedirect = autoRedirectCheckbox ? autoRedirectCheckbox.checked : false;

        return { visibleLocations, autoRedirect };
    }

    function showWarning(show) {
        const warning = document.getElementById('settingsWarning');
        if (warning) {
            warning.style.display = show ? 'block' : 'none';
        }
    }

    function validateSettings() {
        const settings = getSettingsFromModal();
        const isValid = settings.visibleLocations.length > 0;
        showWarning(!isValid);
        return isValid;
    }

    // ========================================================================
    // MODAL FUNCTIONS
    // ========================================================================

    function openModal() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            
            // Load current settings into modal
            const settings = getSettings();
            updateModalFromSettings(settings);
            showWarning(false);
        }
    }

    function closeModal() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    function handleSave() {
        if (!validateSettings()) {
            return;
        }

        const settings = getSettingsFromModal();
        
        if (saveSettings(settings)) {
            applySettings(settings);
            closeModal();
            
            // Check if we should auto-redirect now
            if (settings.autoRedirect && settings.visibleLocations.length === 1) {
                sessionStorage.removeItem('stockkeeper_redirected');
                checkAutoRedirect(settings);
            }
        }
    }

    function handleReset() {
        resetSettings();
        const defaultSettings = { visibleLocations: getAllLocationIds(), autoRedirect: false };
        updateModalFromSettings(defaultSettings);
        applySettings(defaultSettings);
        showWarning(false);
    }

    // ========================================================================
    // EVENT LISTENERS
    // ========================================================================

    function initEventListeners() {
        // Open settings button
        const openBtn = document.getElementById('openSettingsBtn');
        if (openBtn) {
            openBtn.addEventListener('click', openModal);
        }

        // Close button
        const closeBtn = document.getElementById('closeSettingsBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }

        // Overlay click to close
        const overlay = document.getElementById('settingsOverlay');
        if (overlay) {
            overlay.addEventListener('click', closeModal);
        }

        // Save button
        const saveBtn = document.getElementById('saveSettingsBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', handleSave);
        }

        // Reset button
        const resetBtn = document.getElementById('resetSettingsBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', handleReset);
        }

        // Location toggle checkboxes - validate on change
        const locationCheckboxes = document.querySelectorAll('.location-toggle input[type="checkbox"]');
        locationCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', validateSettings);
        });

        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModal();
            }
        });
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    function init() {
        const settings = getSettings();
        
        // Check for auto-redirect first (before rendering)
        if (checkAutoRedirect(settings)) {
            return; // Redirecting, don't continue initialization
        }

        // Apply saved settings to the page
        applySettings(settings);

        // Set up event listeners
        initEventListeners();
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
