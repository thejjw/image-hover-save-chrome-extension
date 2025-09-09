// Domain Exclusions Page JavaScript for Image Hover Save Extension
// Copyright (c) Jaewoo Jeon (@thejjw) and Image Hover Save Extension Contributors
// SPDX-License-Identifier: zlib-acknowledgement

// Extension version - should match popup.js
const EXTENSION_VERSION = '1.4.0';

// Debug flag
const DEBUG = false;

// Debug console wrapper
const debug = {
    log: (...args) => DEBUG && console.log('[IHS Exclusions]', ...args),
    error: (...args) => DEBUG && console.error('[IHS Exclusions]', ...args),
    warn: (...args) => DEBUG && console.warn('[IHS Exclusions]', ...args),
    info: (...args) => DEBUG && console.info('[IHS Exclusions]', ...args)
};

// Storage helper functions
const storage = {
    async get(key) {
        try {
            const result = await chrome.storage.sync.get(key);
            return result[key];
        } catch (error) {
            debug.error('Storage get error:', error);
            return null;
        }
    },
    
    async set(key, value) {
        try {
            await chrome.storage.sync.set({ [key]: value });
            return true;
        } catch (error) {
            debug.error('Storage set error:', error);
            return false;
        }
    }
};

// Domain exclusion functionality
class DomainExclusions {
    constructor() {
        this.exclusions = [];
        this.init();
    }

    async init() {
        await this.loadExclusions();
        this.setupEventListeners();
        this.renderExclusions();
        this.updateStorageStatus();
    }

    async loadExclusions() {
        try {
            this.exclusions = (await storage.get('ihs_domain_exclusions')) || [];
            debug.log('Loaded exclusions:', this.exclusions);
        } catch (error) {
            debug.error('Failed to load exclusions:', error);
            this.showStatus('Failed to load exclusions', 'error');
        }
    }

    async saveExclusions() {
        try {
            const success = await storage.set('ihs_domain_exclusions', this.exclusions);
            if (success) {
                debug.log('Saved exclusions:', this.exclusions);
                this.showStatus('Settings saved successfully', 'success');
                this.updateStorageStatus();
            } else {
                throw new Error('Storage operation failed');
            }
        } catch (error) {
            debug.error('Failed to save exclusions:', error);
            this.showStatus('Failed to save settings', 'error');
        }
    }

    setupEventListeners() {
        const domainInput = document.getElementById('domain-input');
        const addBtn = document.getElementById('add-btn');
        const backBtn = document.getElementById('back-btn');

        // Add domain on button click
        addBtn.addEventListener('click', () => {
            this.addDomain(domainInput.value.trim());
        });

        // Add domain on Enter key
        domainInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.addDomain(domainInput.value.trim());
            }
        });

        // Enable/disable add button based on input
        domainInput.addEventListener('input', () => {
            const value = domainInput.value.trim();
            addBtn.disabled = !value || this.exclusions.includes(value);
        });

        // Back button
        backBtn.addEventListener('click', () => {
            window.close();
        });
    }

    validateDomain(domain) {
        if (!domain) {
            return { valid: false, error: 'Domain cannot be empty' };
        }

        // Basic domain validation
        const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        
        if (!domainRegex.test(domain)) {
            return { valid: false, error: 'Invalid domain format' };
        }

        if (this.exclusions.includes(domain)) {
            return { valid: false, error: 'Domain already excluded' };
        }

        return { valid: true };
    }

    async addDomain(domain) {
        const validation = this.validateDomain(domain);
        
        if (!validation.valid) {
            this.showStatus(validation.error, 'error');
            return;
        }

        this.exclusions.push(domain);
        await this.saveExclusions();
        this.renderExclusions();
        
        // Clear input
        document.getElementById('domain-input').value = '';
        document.getElementById('add-btn').disabled = true;
    }

    async removeDomain(domain) {
        const index = this.exclusions.indexOf(domain);
        if (index > -1) {
            this.exclusions.splice(index, 1);
            await this.saveExclusions();
            this.renderExclusions();
        }
    }

    renderExclusions() {
        const container = document.getElementById('exclusions-container');
        const noExclusions = document.getElementById('no-exclusions');
        
        // Clear existing domain items
        const existingItems = container.querySelectorAll('.domain-item');
        existingItems.forEach(item => item.remove());

        if (this.exclusions.length === 0) {
            noExclusions.style.display = 'block';
        } else {
            noExclusions.style.display = 'none';
            
            this.exclusions.forEach(domain => {
                const domainItem = document.createElement('div');
                domainItem.className = 'domain-item';
                
                domainItem.innerHTML = `
                    <span class="domain-text">${this.escapeHtml(domain)}</span>
                    <button class="remove-btn" data-domain="${this.escapeHtml(domain)}">Remove</button>
                `;
                
                // Add remove functionality
                const removeBtn = domainItem.querySelector('.remove-btn');
                removeBtn.addEventListener('click', () => {
                    this.removeDomain(domain);
                });
                
                container.appendChild(domainItem);
            });
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updateStorageStatus() {
        const storageElement = document.getElementById('storage-type');
        if (!storageElement) return;
        
        storageElement.textContent = '☁️ Settings will be synced across your devices';
    }

    showStatus(message, type = 'info') {
        const status = document.getElementById('status');
        status.textContent = message;
        status.className = `status ${type}`;
        
        // Clear status after 3 seconds
        setTimeout(() => {
            status.textContent = '';
            status.className = 'status';
        }, 3000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    debug.log('Initializing domain exclusions page...');
    
    // Populate version in footer
    const versionElement = document.getElementById('version');
    if (versionElement) {
        versionElement.textContent = `v${EXTENSION_VERSION}`;
    }
    
    // Initialize domain exclusions
    new DomainExclusions();
});
