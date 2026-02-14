// ===== Glasseria Accessibility Widget =====
// תוסף נגישות לפי תקן ישראלי 5568 ו-WCAG 2.0 AA

(function() {
    'use strict';
    
    // State - שמירה ב-localStorage
    const STORAGE_KEY = 'glasseria_accessibility';
    let settings = loadSettings();
    
    function loadSettings() {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : {
            fontSize: 0,          // -2 to +4
            highContrast: false,
            readableFont: false,
            stopAnimations: false,
            highlightLinks: false,
            bigCursor: false
        };
    }
    
    function saveSettings() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
    
    // יצירת ה-Widget
    function createWidget() {
        // כפתור נגישות צף
        const btn = document.createElement('button');
        btn.className = 'accessibility-widget-btn';
        btn.id = 'accessibility-btn';
        btn.setAttribute('aria-label', 'פתח תפריט נגישות');
        btn.setAttribute('title', 'נגישות');
        btn.innerHTML = `
            <svg viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
                <path d="M192 96a48 48 0 1 0 0-96 48 48 0 1 0 0 96zM120.5 247.2c12.4-4.7 18.7-18.5 14-30.9s-18.5-18.7-30.9-14C43.1 225.1 0 283.5 0 352c0 88.4 71.6 160 160 160c61.2 0 114.3-34.3 141.2-84.7c6.2-11.7 1.8-26.2-9.9-32.5s-26.2-1.8-32.5 9.9C240 434.6 204.4 464 160 464c-61.9 0-112-50.1-112-112c0-47.9 30.1-88.8 72.5-104.8zM259.8 176l-1.9-9.7c-4.5-22.3-24-38.3-46.8-38.3c-30.1 0-52.7 27.5-46.8 57l23.1 115.5c6 29.9 32.2 51.4 62.8 51.4h5.1c.4 0 .8 0 1.3 0h94.1c6.7 0 12.6 4.1 15 10.4L402 476.3c8.2 21.2 32.2 31.8 53.6 23.6s31.8-32.2 23.6-53.6l-64.2-165.6c-9.5-24.5-33.2-40.7-59.6-40.7H304v-64h50.7c17.6 0 35.5-2.7 52.5-8.3l42.4-14.1c13.8-4.6 21.3-19.5 16.7-33.3s-19.5-21.3-33.3-16.7l-42.4 14.1c-10.4 3.5-21.3 5.3-32.4 5.3H259.8z"/>
            </svg>
        `;
        
        // פאנל נגישות
        const panel = document.createElement('div');
        panel.className = 'accessibility-panel';
        panel.id = 'accessibility-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'תפריט נגישות');
        panel.innerHTML = `
            <div class="accessibility-panel-header">
                <h2>♿ הגדרות נגישות</h2>
                <button class="accessibility-panel-close" id="accessibility-close" aria-label="סגור תפריט נגישות">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="accessibility-panel-body">
                <!-- גודל טקסט -->
                <div class="accessibility-option">
                    <span class="accessibility-option-label">גודל טקסט</span>
                    <div class="accessibility-font-controls">
                        <button class="accessibility-font-btn" id="font-decrease" aria-label="הקטן טקסט">א-</button>
                        <span class="accessibility-font-size" id="font-size-display">100%</span>
                        <button class="accessibility-font-btn" id="font-increase" aria-label="הגדל טקסט">א+</button>
                    </div>
                </div>
                
                <!-- ניגודיות גבוהה -->
                <button class="accessibility-option accessibility-toggle" id="toggle-contrast" aria-pressed="false">
                    <span class="accessibility-option-icon">🎨</span>
                    <span class="accessibility-option-label">ניגודיות גבוהה</span>
                    <span class="accessibility-option-status"></span>
                </button>
                
                <!-- גופן קריא -->
                <button class="accessibility-option accessibility-toggle" id="toggle-font" aria-pressed="false">
                    <span class="accessibility-option-icon">📖</span>
                    <span class="accessibility-option-label">גופן קריא</span>
                    <span class="accessibility-option-status"></span>
                </button>
                
                <!-- עצירת אנימציות -->
                <button class="accessibility-option accessibility-toggle" id="toggle-animations" aria-pressed="false">
                    <span class="accessibility-option-icon">⏸️</span>
                    <span class="accessibility-option-label">עצירת אנימציות</span>
                    <span class="accessibility-option-status"></span>
                </button>
                
                <!-- הדגשת קישורים -->
                <button class="accessibility-option accessibility-toggle" id="toggle-links" aria-pressed="false">
                    <span class="accessibility-option-icon">🔗</span>
                    <span class="accessibility-option-label">הדגשת קישורים</span>
                    <span class="accessibility-option-status"></span>
                </button>
                
                <!-- סמן מוגדל -->
                <button class="accessibility-option accessibility-toggle" id="toggle-cursor" aria-pressed="false">
                    <span class="accessibility-option-icon">👆</span>
                    <span class="accessibility-option-label">סמן מוגדל</span>
                    <span class="accessibility-option-status"></span>
                </button>
            </div>
            <div class="accessibility-panel-footer">
                <button class="accessibility-reset-btn" id="accessibility-reset">
                    🔄 איפוס הגדרות
                </button>
                <a href="accessibility.html" class="accessibility-statement-link">
                    📄 הצהרת נגישות
                </a>
            </div>
        `;
        
        document.body.appendChild(btn);
        document.body.appendChild(panel);
        
        // Event Listeners
        btn.addEventListener('click', togglePanel);
        document.getElementById('accessibility-close').addEventListener('click', closePanel);
        document.getElementById('font-decrease').addEventListener('click', () => changeFontSize(-1));
        document.getElementById('font-increase').addEventListener('click', () => changeFontSize(1));
        document.getElementById('toggle-contrast').addEventListener('click', () => toggleOption('highContrast'));
        document.getElementById('toggle-font').addEventListener('click', () => toggleOption('readableFont'));
        document.getElementById('toggle-animations').addEventListener('click', () => toggleOption('stopAnimations'));
        document.getElementById('toggle-links').addEventListener('click', () => toggleOption('highlightLinks'));
        document.getElementById('toggle-cursor').addEventListener('click', () => toggleOption('bigCursor'));
        document.getElementById('accessibility-reset').addEventListener('click', resetSettings);
        
        // סגירה בלחיצה מחוץ לפאנל
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('accessibility-panel');
            const btn = document.getElementById('accessibility-btn');
            if (panel.classList.contains('active') && 
                !panel.contains(e.target) && 
                !btn.contains(e.target)) {
                closePanel();
            }
        });
        
        // סגירה ב-Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closePanel();
            }
        });
        
        // החלת הגדרות שמורות
        applySettings();
    }
    
    function togglePanel() {
        const panel = document.getElementById('accessibility-panel');
        const btn = document.getElementById('accessibility-btn');
        const isOpen = panel.classList.toggle('active');
        btn.setAttribute('aria-expanded', isOpen);
        
        if (isOpen) {
            // פוקוס על הפאנל
            panel.querySelector('.accessibility-panel-close').focus();
        }
    }
    
    function closePanel() {
        const panel = document.getElementById('accessibility-panel');
        const btn = document.getElementById('accessibility-btn');
        panel.classList.remove('active');
        btn.setAttribute('aria-expanded', 'false');
        btn.focus();
    }
    
    function changeFontSize(delta) {
        settings.fontSize = Math.max(-2, Math.min(10, settings.fontSize + delta));
        saveSettings();
        applyFontSize();
        updateUI();
    }
    
    function toggleOption(option) {
        settings[option] = !settings[option];
        saveSettings();
        applySettings();
        updateUI();
    }
    
    function resetSettings() {
        settings = {
            fontSize: 0,
            highContrast: false,
            readableFont: false,
            stopAnimations: false,
            highlightLinks: false,
            bigCursor: false
        };
        saveSettings();
        applySettings();
        updateUI();
        
        // הודעה למשתמש
        announceToScreenReader('ההגדרות אופסו');
    }
    
    function applySettings() {
        applyFontSize();
        applyHighContrast();
        applyReadableFont();
        applyStopAnimations();
        applyHighlightLinks();
        applyBigCursor();
        updateUI();
    }
    
    function applyFontSize() {
        const scale = 1 + (settings.fontSize * 0.1); // כל שלב = 10%
        document.documentElement.style.setProperty('--accessibility-font-scale', scale);
        document.documentElement.style.fontSize = `${scale * 100}%`;
    }
    
    function applyHighContrast() {
        document.body.classList.toggle('accessibility-high-contrast', settings.highContrast);
    }
    
    function applyReadableFont() {
        document.body.classList.toggle('accessibility-readable-font', settings.readableFont);
    }
    
    function applyStopAnimations() {
        document.body.classList.toggle('accessibility-stop-animations', settings.stopAnimations);
    }
    
    function applyHighlightLinks() {
        document.body.classList.toggle('accessibility-highlight-links', settings.highlightLinks);
    }
    
    function applyBigCursor() {
        document.body.classList.toggle('accessibility-big-cursor', settings.bigCursor);
    }
    
    function updateUI() {
        // עדכון תצוגת גודל טקסט
        const sizeDisplay = document.getElementById('font-size-display');
        if (sizeDisplay) {
            const percentage = 100 + (settings.fontSize * 10);
            sizeDisplay.textContent = `${percentage}%`;
        }
        
        // עדכון מצב הכפתורים
        updateToggleButton('toggle-contrast', settings.highContrast);
        updateToggleButton('toggle-font', settings.readableFont);
        updateToggleButton('toggle-animations', settings.stopAnimations);
        updateToggleButton('toggle-links', settings.highlightLinks);
        updateToggleButton('toggle-cursor', settings.bigCursor);
    }
    
    function updateToggleButton(id, isActive) {
        const btn = document.getElementById(id);
        if (btn) {
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', isActive);
        }
    }
    
    // הודעה לקוראי מסך
    function announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'sr-only';
        announcement.textContent = message;
        document.body.appendChild(announcement);
        
        setTimeout(() => announcement.remove(), 1000);
    }
    
    // הפעלה כשהדף נטען
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createWidget);
    } else {
        createWidget();
    }
})();
