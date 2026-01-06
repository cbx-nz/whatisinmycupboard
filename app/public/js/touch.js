/**
 * ============================================================================
 * TOUCH UI JAVASCRIPT
 * ============================================================================
 * 
 * Minimal JavaScript for the touchscreen interface.
 * Focuses on essential interactions for 3.5"-5" displays.
 */

(function() {
    'use strict';

    // =========================================================================
    // DOM Ready
    // =========================================================================
    document.addEventListener('DOMContentLoaded', function() {
        initQuantityControls();
        initFormValidation();
        initImagePreview();
        initConfirmActions();
        initLocationSelect();
        initPullToRefresh();
    });

    // =========================================================================
    // Quantity Controls
    // =========================================================================
    function initQuantityControls() {
        // Use button with quantity input
        document.querySelectorAll('.use-form').forEach(function(form) {
            form.addEventListener('submit', function(e) {
                const qty = form.querySelector('input[name="quantity"]');
                if (qty && parseInt(qty.value) < 1) {
                    e.preventDefault();
                    showToast('Please enter a valid quantity', 'error');
                }
            });
        });

        // Add quantity button
        document.querySelectorAll('.add-form').forEach(function(form) {
            form.addEventListener('submit', function(e) {
                const qty = form.querySelector('input[name="quantity"]');
                if (qty && parseInt(qty.value) < 1) {
                    e.preventDefault();
                    showToast('Please enter a valid quantity', 'error');
                }
            });
        });

        // Increment/decrement buttons
        document.querySelectorAll('.qty-btn-minus').forEach(function(btn) {
            btn.addEventListener('click', function() {
                const input = btn.parentElement.querySelector('input[type="number"]');
                if (input && parseInt(input.value) > parseInt(input.min || 1)) {
                    input.value = parseInt(input.value) - 1;
                }
            });
        });

        document.querySelectorAll('.qty-btn-plus').forEach(function(btn) {
            btn.addEventListener('click', function() {
                const input = btn.parentElement.querySelector('input[type="number"]');
                if (input) {
                    const max = input.max ? parseInt(input.max) : 9999;
                    if (parseInt(input.value) < max) {
                        input.value = parseInt(input.value) + 1;
                    }
                }
            });
        });
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
                
                // Validate title
                if (!title || !title.value.trim()) {
                    showFieldError(title, 'Title is required');
                    valid = false;
                }
                
                // Validate location
                if (!location || !location.value) {
                    const locationGroup = form.querySelector('.location-group');
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
        
        const error = document.createElement('div');
        error.className = 'field-error';
        error.textContent = message;
        error.style.color = 'var(--color-danger)';
        error.style.fontSize = '14px';
        error.style.marginTop = '4px';
        
        element.parentElement.appendChild(error);
    }

    // =========================================================================
    // Image Preview
    // =========================================================================
    function initImagePreview() {
        const imageInput = document.getElementById('image-input');
        const preview = document.getElementById('image-preview');
        const placeholder = document.querySelector('.upload-placeholder');
        
        if (!imageInput) return;
        
        imageInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            
            if (file) {
                // Validate file type
                if (!file.type.startsWith('image/')) {
                    showToast('Please select an image file', 'error');
                    imageInput.value = '';
                    return;
                }
                
                // Validate file size (max 10MB)
                if (file.size > 10 * 1024 * 1024) {
                    showToast('Image must be less than 10MB', 'error');
                    imageInput.value = '';
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
        });

        // Make upload area clickable
        const uploadArea = document.querySelector('.image-upload-area');
        if (uploadArea && imageInput) {
            uploadArea.addEventListener('click', function() {
                imageInput.click();
            });
        }
    }

    // =========================================================================
    // Confirm Actions
    // =========================================================================
    function initConfirmActions() {
        // Delete confirmation
        document.querySelectorAll('.delete-form').forEach(function(form) {
            form.addEventListener('submit', function(e) {
                if (!confirm('Are you sure you want to delete this item? This cannot be undone.')) {
                    e.preventDefault();
                }
            });
        });

        // Discard confirmation
        document.querySelectorAll('.discard-form').forEach(function(form) {
            form.addEventListener('submit', function(e) {
                if (!confirm('Mark this item as discarded? This will log it in consumption history and remove it.')) {
                    e.preventDefault();
                }
            });
        });
    }

    // =========================================================================
    // Location Select (radio button visual)
    // =========================================================================
    function initLocationSelect() {
        const locationOptions = document.querySelectorAll('.location-option');
        
        locationOptions.forEach(function(option) {
            option.addEventListener('click', function() {
                // Remove selected from all
                locationOptions.forEach(function(opt) {
                    opt.classList.remove('selected');
                });
                
                // Select this one
                option.classList.add('selected');
                
                // Check the radio input
                const radio = option.querySelector('input[type="radio"]');
                if (radio) {
                    radio.checked = true;
                }
            });
            
            // Mark initially selected
            const radio = option.querySelector('input[type="radio"]');
            if (radio && radio.checked) {
                option.classList.add('selected');
            }
        });
    }

    // =========================================================================
    // Pull to Refresh (basic)
    // =========================================================================
    function initPullToRefresh() {
        let startY = 0;
        let pulling = false;
        
        document.addEventListener('touchstart', function(e) {
            if (window.scrollY === 0) {
                startY = e.touches[0].pageY;
                pulling = true;
            }
        }, { passive: true });
        
        document.addEventListener('touchmove', function(e) {
            if (!pulling) return;
            
            const y = e.touches[0].pageY;
            const diff = y - startY;
            
            if (diff > 100) {
                pulling = false;
                showToast('Refreshing...', 'info');
                setTimeout(function() {
                    window.location.reload();
                }, 500);
            }
        }, { passive: true });
        
        document.addEventListener('touchend', function() {
            pulling = false;
        }, { passive: true });
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
        
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 24px',
            borderRadius: '8px',
            backgroundColor: type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6',
            color: 'white',
            fontSize: '16px',
            fontWeight: '500',
            zIndex: '1000',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        });
        
        document.body.appendChild(toast);
        
        setTimeout(function() {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            setTimeout(function() {
                toast.remove();
            }, 300);
        }, 3000);
    }

    // Expose showToast globally
    window.showToast = showToast;

})();
