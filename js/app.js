/**
 * app.js — Navigation, initialization, global utilities
 * RubricIQ - SHIT Loop Evaluation Framework
 * (c)2026 Brad Scheller
 */

const App = (() => {

  // ===== Tab Navigation =====

  function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;

        // Update button states
        tabButtons.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');

        // Update content visibility
        tabContents.forEach(tc => tc.classList.add('hidden'));
        const targetTab = document.getElementById('tab-' + tabId);
        if (targetTab) targetTab.classList.remove('hidden');

        // Refresh tab-specific content
        if (tabId === 'scorer' && typeof Scorer !== 'undefined') {
          Scorer.refreshRubricSelect();
        }
        if (tabId === 'dashboard' && typeof Dashboard !== 'undefined') {
          Dashboard.refreshRubricSelect();
          Dashboard.refresh();
        }
        if (tabId === 'builder' && typeof RubricBuilder !== 'undefined') {
          RubricBuilder.refreshSavedRubricsList();
        }
      });
    });
  }

  // ===== Toast Notifications =====

  function toast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toastEl = document.createElement('div');
    toastEl.className = 'toast toast-' + type;
    toastEl.textContent = message;
    container.appendChild(toastEl);

    setTimeout(() => {
      toastEl.style.opacity = '0';
      toastEl.style.transition = 'opacity 0.3s';
      setTimeout(() => toastEl.remove(), 300);
    }, 3000);
  }

  // ===== Keyboard Navigation =====

  function initKeyboard() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+1/2/3 for tab switching
      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        if (e.key === '1') {
          e.preventDefault();
          document.querySelector('[data-tab="builder"]').click();
        } else if (e.key === '2') {
          e.preventDefault();
          document.querySelector('[data-tab="scorer"]').click();
        } else if (e.key === '3') {
          e.preventDefault();
          document.querySelector('[data-tab="dashboard"]').click();
        }
      }

      // Escape to close modal
      if (e.key === 'Escape') {
        const modal = document.getElementById('evaluation-detail-modal');
        if (!modal.classList.contains('hidden')) {
          modal.classList.add('hidden');
        }
      }
    });
  }

  // ===== Initialize Everything =====

  function init() {
    initTabs();
    initKeyboard();
    RubricBuilder.init();
    Scorer.init();
    Dashboard.init();
  }

  // Boot on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    toast,
    init
  };
})();
