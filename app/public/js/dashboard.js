/**
 * ============================================================================
 * DASHBOARD UI JAVASCRIPT
 * ============================================================================
 * 
 * Full-featured JavaScript for phone and desktop browsers.
 * 
 * Features:
 * - Mobile menu toggle
 * - Theme toggle (dark/light mode)
 * - View switching (grid/table)
 * - AJAX quantity updates
 * - Search and filter
 * - Image upload with drag-drop
 * - Keyboard shortcuts
 */

(function() {
    'use strict';

    // =========================================================================
    // DOM Ready
    // =========================================================================
    document.addEventListener('DOMContentLoaded', function() {
        initMobileMenu();
        initThemeToggle();
        initViewToggle();
        initQuantityControls();
        initSearch();
        initFilters();
        initImageUpload();
        initFormValidation();
        initConfirmActions();
        initLocationSelect();
        initKeyboardShortcuts();
        initTooltips();
    });

    // =========================================================================
    // Mobile Menu
    // =========================================================================
    function initMobileMenu() {
        const menuToggle = document.querySelector('.menu-toggle');
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        const closeBtn = document.querySelector('.sidebar-close');
        
        function openMenu() {
            sidebar.classList.add('open');
            overlay.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
        
        function closeMenu() {
            sidebar.classList.remove('open');
            overlay.classList.remove('open');
            document.body.style.overflow = '';
        }
        
        if (menuToggle) {
            menuToggle.addEventListener('click', openMenu);
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', closeMenu);
        }
        
        if (overlay) {
            overlay.addEventListener('click', closeMenu);
        }
        
        // Close on escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && sidebar && sidebar.classList.contains('open')) {
                closeMenu();
            }
        });
    }

    // =========================================================================
    // Theme Toggle
    // =========================================================================
    function initThemeToggle() {
        const toggle = document.querySelector('.theme-toggle');
        const icon = toggle ? toggle.querySelector('.theme-icon') : null;
        const text = toggle ? toggle.querySelector('.theme-text') : null;
        
        // Get stored theme or system preference
        const storedTheme = localStorage.getItem('theme');
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const currentTheme = storedTheme || (systemDark ? 'dark' : 'light');
        
        // Apply current theme
        document.documentElement.setAttribute('data-theme', currentTheme);
        updateThemeUI(currentTheme);
        
        if (toggle) {
            toggle.addEventListener('click', function() {
                const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                const newTheme = isDark ? 'light' : 'dark';
                
                document.documentElement.setAttribute('data-theme', newTheme);
                localStorage.setItem('theme', newTheme);
                updateThemeUI(newTheme);
            });
        }
        
        function updateThemeUI(theme) {
            if (icon) {
                icon.textContent = theme === 'dark' ? '☀️' : '🌙';
            }
            if (text) {
                text.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
            }
        }
    }

    // =========================================================================
    // View Toggle (Grid/Table)
    // =========================================================================
    function initViewToggle() {
        const gridBtn = document.querySelector('.view-btn.grid');
        const tableBtn = document.querySelector('.view-btn.table');
        const gridView = document.querySelector('.items-grid');
        const tableView = document.querySelector('.items-table-container');
        
        if (!gridBtn || !tableBtn) return;
        
        // Get stored preference
        const storedView = localStorage.getItem('itemsView') || 'grid';
        setView(storedView);
        
        gridBtn.addEventListener('click', function() {
            setView('grid');
        });
        
        tableBtn.addEventListener('click', function() {
            setView('table');
        });
        
        function setView(view) {
            localStorage.setItem('itemsView', view);
            
            if (view === 'grid') {
                gridBtn.classList.add('active');
                tableBtn.classList.remove('active');
                if (gridView) gridView.classList.remove('hidden');
                if (tableView) tableView.classList.add('hidden');
            } else {
                tableBtn.classList.add('active');
                gridBtn.classList.remove('active');
                if (tableView) tableView.classList.remove('hidden');
                if (gridView) gridView.classList.add('hidden');
            }
        }
    }

    // =========================================================================
    // Quantity Controls
    // =========================================================================
    function initQuantityControls() {
        // AJAX quantity updates
        document.querySelectorAll('.use-btn-ajax').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const itemId = btn.dataset.id;
                updateQuantity(itemId, 'use', 1, btn);
            });
        });

        document.querySelectorAll('.add-btn-ajax').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const itemId = btn.dataset.id;
                updateQuantity(itemId, 'add', 1, btn);
            });
        });

        // Form-based updates
        document.querySelectorAll('.use-form, .add-form').forEach(function(form) {
            form.addEventListener('submit', function(e) {
                const qty = form.querySelector('input[name="quantity"]');
                if (qty && parseInt(qty.value) < 1) {
                    e.preventDefault();
                    showToast('Please enter a valid quantity', 'error');
                }
            });
        });
    }

    function updateQuantity(itemId, action, amount, btn) {
        const endpoint = action === 'use' ? '/items/use/' + itemId : '/items/add-quantity/' + itemId;
        
        btn.disabled = true;
        
        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: 'quantity=' + amount
        })
        .then(function(response) {
            if (response.ok) {
                return response.json();
            }
            throw new Error('Request failed');
        })
        .then(function(data) {
            if (data.success) {
                // Update displayed quantity
                const row = btn.closest('tr, .grid-item');
                if (row) {
                    const qtyCell = row.querySelector('.cell-qty, .grid-item-qty');
                    if (qtyCell) {
                        qtyCell.textContent = data.newQuantity;
                    }
                }
                
                if (data.newQuantity <= 0) {
                    // Item depleted - remove row or reload
                    if (row) {
                        row.style.opacity = '0.5';
                        setTimeout(function() {
                            row.remove();
                        }, 500);
                    }
                    showToast('Item removed from inventory', 'success');
                } else {
                    showToast(action === 'use' ? 'Used 1' : 'Added 1', 'success');
                }
            }
        })
        .catch(function(err) {
            showToast('Failed to update quantity', 'error');
            console.error(err);
        })
        .finally(function() {
            btn.disabled = false;
        });
    }

    // =========================================================================
    // Search
    // =========================================================================
    function initSearch() {
        const searchInput = document.querySelector('.search-input');
        const searchForm = document.querySelector('.filters-form');
        
        if (!searchInput) return;
        
        // Debounced search
        let debounceTimer;
        searchInput.addEventListener('input', function() {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(function() {
                // Client-side filtering for small lists
                const query = searchInput.value.toLowerCase().trim();
                filterItems(query);
            }, 300);
        });
        
        // Prevent form submit for client-side filtering
        if (searchForm) {
            searchForm.addEventListener('submit', function(e) {
                e.preventDefault();
                filterItems(searchInput.value.toLowerCase().trim());
            });
        }
    }

    function filterItems(query) {
        const items = document.querySelectorAll('.grid-item, .data-table tbody tr');
        let visibleCount = 0;
        
        items.forEach(function(item) {
            const title = item.querySelector('.grid-item-title, .cell-title a');
            const text = title ? title.textContent.toLowerCase() : '';
            const brand = item.querySelector('.item-brand');
            const brandText = brand ? brand.textContent.toLowerCase() : '';
            
            const matches = !query || text.includes(query) || brandText.includes(query);
            
            item.style.display = matches ? '' : 'none';
            if (matches) visibleCount++;
        });
        
        // Update results count
        const resultsCount = document.querySelector('.results-count');
        if (resultsCount) {
            resultsCount.textContent = visibleCount + ' item' + (visibleCount !== 1 ? 's' : '');
        }
    }

    // =========================================================================
    // Filters
    // =========================================================================
    function initFilters() {
        const categoryFilter = document.querySelector('#filter-category');
        const locationFilter = document.querySelector('#filter-location');
        const expiryFilter = document.querySelector('#filter-expiry');
        
        [categoryFilter, locationFilter, expiryFilter].forEach(function(filter) {
            if (filter) {
                filter.addEventListener('change', applyFilters);
            }
        });
        
        // Clear filters button
        const clearBtn = document.querySelector('.btn-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', function() {
                if (categoryFilter) categoryFilter.value = '';
                if (locationFilter) locationFilter.value = '';
                if (expiryFilter) expiryFilter.value = '';
                const searchInput = document.querySelector('.search-input');
                if (searchInput) searchInput.value = '';
                applyFilters();
            });
        }
    }

    function applyFilters() {
        const category = document.querySelector('#filter-category')?.value || '';
        const location = document.querySelector('#filter-location')?.value || '';
        const expiry = document.querySelector('#filter-expiry')?.value || '';
        const query = document.querySelector('.search-input')?.value.toLowerCase().trim() || '';
        
        const items = document.querySelectorAll('.grid-item, .data-table tbody tr');
        let visibleCount = 0;
        
        items.forEach(function(item) {
            let visible = true;
            
            // Category filter
            if (category && item.dataset.category !== category) {
                visible = false;
            }
            
            // Location filter
            if (location && item.dataset.location !== location) {
                visible = false;
            }
            
            // Expiry filter
            if (expiry) {
                const itemExpiry = item.dataset.expiry || '';
                if (expiry === 'expired' && !item.classList.contains('expiry-expired')) {
                    visible = false;
                } else if (expiry === 'soon' && !item.classList.contains('expiry-soon') && !item.classList.contains('expiry-today')) {
                    visible = false;
                } else if (expiry === 'ok' && (item.classList.contains('expiry-expired') || item.classList.contains('expiry-soon'))) {
                    visible = false;
                }
            }
            
            // Text search
            if (query) {
                const title = item.querySelector('.grid-item-title, .cell-title a');
                const text = title ? title.textContent.toLowerCase() : '';
                const brand = item.querySelector('.item-brand');
                const brandText = brand ? brand.textContent.toLowerCase() : '';
                
                if (!text.includes(query) && !brandText.includes(query)) {
                    visible = false;
                }
            }
            
            item.style.display = visible ? '' : 'none';
            if (visible) visibleCount++;
        });
        
        // Update results count
        const resultsCount = document.querySelector('.results-count');
        if (resultsCount) {
            resultsCount.textContent = visibleCount + ' item' + (visibleCount !== 1 ? 's' : '');
        }
    }

    // =========================================================================
    // Image Upload
    // =========================================================================
    function initImageUpload() {
        const uploadArea = document.querySelector('.image-upload-area');
        const imageInput = document.getElementById('image-input');
        const preview = document.getElementById('image-preview');
        const placeholder = document.querySelector('.upload-placeholder');
        
        if (!uploadArea || !imageInput) return;
        
        // Click to upload
        uploadArea.addEventListener('click', function() {
            imageInput.click();
        });
        
        // File input change
        imageInput.addEventListener('change', function(e) {
            handleFile(e.target.files[0]);
        });
        
        // Drag and drop
        uploadArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', function(e) {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', function(e) {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const file = e.dataTransfer.files[0];
            if (file) {
                handleFile(file);
                
                // Update file input
                const dt = new DataTransfer();
                dt.items.add(file);
                imageInput.files = dt.files;
            }
        });
        
        function handleFile(file) {
            if (!file) return;
            
            // Validate file type
            if (!file.type.startsWith('image/')) {
                showToast('Please select an image file', 'error');
                return;
            }
            
            // Validate file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                showToast('Image must be less than 10MB', 'error');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(ev) {
                if (preview) {
                    preview.src = ev.target.result;
                    preview.classList.remove('hidden');
                }
                if (placeholder) {
                    placeholder.classList.add('hidden');
                }
            };
            reader.readAsDataURL(file);
        }
    }

    // =========================================================================
    // Form Validation
    // =========================================================================
    function initFormValidation() {
        const forms = document.querySelectorAll('form.item-form');
        
        forms.forEach(function(form) {
            form.addEventListener('submit', function(e) {
                const title = form.querySelector('input[name="title"]');
                const location = form.querySelector('input[name="location"]:checked, select[name="location"]');
                
                let valid = true;
                
                // Clear previous errors
                form.querySelectorAll('.field-error').forEach(function(el) {
                    el.remove();
                });
                form.querySelectorAll('.input-error').forEach(function(el) {
                    el.classList.remove('input-error');
                });
                
                // Validate title
                if (!title || !title.value.trim()) {
                    showFieldError(title, 'Title is required');
                    valid = false;
                }
                
                // Validate location
                if (!location || !location.value) {
                    const locationGroup = form.querySelector('.location-select, .form-group:has(select[name="location"])');
                    if (locationGroup) {
                        showFieldError(locationGroup, 'Please select a location');
                    }
                    valid = false;
                }
                
                if (!valid) {
                    e.preventDefault();
                    showToast('Please fill in all required fields', 'error');
                }
            });
        });
    }

    function showFieldError(element, message) {
        if (!element) return;
        
        element.classList.add('input-error');
        
        const error = document.createElement('div');
        error.className = 'field-error';
        error.textContent = message;
        error.style.cssText = 'color: var(--color-danger); font-size: 12px; margin-top: 4px;';
        
        const parent = element.closest('.form-group') || element.parentElement;
        if (parent) {
            parent.appendChild(error);
        }
    }

    // =========================================================================
    // Confirm Actions
    // =========================================================================
    function initConfirmActions() {
        // Delete confirmation
        document.querySelectorAll('.delete-form, .btn-delete').forEach(function(el) {
            el.addEventListener('submit', handleDeleteConfirm);
            el.addEventListener('click', handleDeleteConfirm);
        });

        // Discard confirmation
        document.querySelectorAll('.discard-form').forEach(function(form) {
            form.addEventListener('submit', function(e) {
                if (!confirm('Mark this item as discarded?\n\nThis will log it in consumption history and remove it from inventory.')) {
                    e.preventDefault();
                }
            });
        });

        function handleDeleteConfirm(e) {
            if (!confirm('Are you sure you want to delete this item?\n\nThis action cannot be undone.')) {
                e.preventDefault();
            }
        }
    }

    // =========================================================================
    // Location Select
    // =========================================================================
    function initLocationSelect() {
        const locationOptions = document.querySelectorAll('.location-option');
        
        locationOptions.forEach(function(option) {
            option.addEventListener('click', function() {
                locationOptions.forEach(function(opt) {
                    opt.classList.remove('selected');
                });
                option.classList.add('selected');
                
                const radio = option.querySelector('input[type="radio"]');
                if (radio) {
                    radio.checked = true;
                }
            });
            
            const radio = option.querySelector('input[type="radio"]');
            if (radio && radio.checked) {
                option.classList.add('selected');
            }
        });
    }

    // =========================================================================
    // Keyboard Shortcuts
    // =========================================================================
    function initKeyboardShortcuts() {
        document.addEventListener('keydown', function(e) {
            // Ignore if typing in input
            if (e.target.matches('input, textarea, select')) return;
            
            // / - Focus search
            if (e.key === '/') {
                e.preventDefault();
                const search = document.querySelector('.search-input');
                if (search) search.focus();
            }
            
            // n - New item
            if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
                const addLink = document.querySelector('a[href*="/add"]');
                if (addLink) {
                    window.location = addLink.href;
                }
            }
            
            // g then h - Go home
            // g then i - Go to inventory
            // g then a - Go to alerts
        });
    }

    // =========================================================================
    // Tooltips
    // =========================================================================
    function initTooltips() {
        document.querySelectorAll('[data-tooltip]').forEach(function(el) {
            el.addEventListener('mouseenter', function() {
                const text = el.dataset.tooltip;
                if (!text) return;
                
                const tooltip = document.createElement('div');
                tooltip.className = 'tooltip';
                tooltip.textContent = text;
                tooltip.style.cssText = `
                    position: absolute;
                    background: var(--text-primary);
                    color: var(--bg-body);
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    z-index: 1000;
                    pointer-events: none;
                    white-space: nowrap;
                `;
                
                document.body.appendChild(tooltip);
                
                const rect = el.getBoundingClientRect();
                tooltip.style.top = (rect.top - tooltip.offsetHeight - 4) + 'px';
                tooltip.style.left = (rect.left + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';
                
                el._tooltip = tooltip;
            });
            
            el.addEventListener('mouseleave', function() {
                if (el._tooltip) {
                    el._tooltip.remove();
                    el._tooltip = null;
                }
            });
        });
    }

    // =========================================================================
    // Toast Notifications
    // =========================================================================
    function showToast(message, type) {
        type = type || 'info';
        
        // Remove existing toasts
        document.querySelectorAll('.toast').forEach(function(t) {
            t.remove();
        });
        
        const toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.textContent = message;
        
        const colors = {
            error: '#ef4444',
            success: '#10b981',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            padding: '12px 20px',
            borderRadius: '8px',
            backgroundColor: colors[type] || colors.info,
            color: type === 'warning' ? 'black' : 'white',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: '1000',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            transform: 'translateY(100px)',
            opacity: '0',
            transition: 'all 0.3s ease'
        });
        
        document.body.appendChild(toast);
        
        // Trigger animation
        requestAnimationFrame(function() {
            toast.style.transform = 'translateY(0)';
            toast.style.opacity = '1';
        });
        
        setTimeout(function() {
            toast.style.transform = 'translateY(100px)';
            toast.style.opacity = '0';
            setTimeout(function() {
                toast.remove();
            }, 300);
        }, 3000);
    }

    // Expose showToast globally
    window.showToast = showToast;

    // =========================================================================
    // Export Functions
    // =========================================================================
    window.exportCSV = function() {
        window.location = '/api/export/csv';
    };

    window.exportHistoryCSV = function() {
        window.location = '/api/export/history/csv';
    };

})();
