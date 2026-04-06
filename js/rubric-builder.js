/**
 * rubric-builder.js — Rubric creation logic and UI
 * RubricIQ - SHIT Loop Evaluation Framework
 * (c)2026 Brad Scheller
 *
 * Security note: All user-provided strings are sanitized through escapeHtml()
 * which uses textContent assignment for safe HTML entity encoding before any
 * DOM insertion. No raw user input is ever inserted into innerHTML.
 */

const RubricBuilder = (() => {
  let editingRubricId = null;
  let criteriaCount = 0;
  let hardGuardrailCount = 0;
  let softGuardrailCount = 0;

  // ===== Utility =====

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // ===== Safe DOM builder =====
  // Creates elements safely using DOM APIs instead of innerHTML where possible

  function createElement(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, val]) => {
      if (key === 'className') el.className = val;
      else if (key === 'textContent') el.textContent = val;
      else if (key.startsWith('data-')) el.setAttribute(key, val);
      else el.setAttribute(key, val);
    });
    children.forEach(child => {
      if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child));
      } else if (child) {
        el.appendChild(child);
      }
    });
    return el;
  }

  // ===== Initialization =====

  function init() {
    document.getElementById('add-criterion-btn').addEventListener('click', () => addCriterion());
    document.getElementById('add-hard-guardrail-btn').addEventListener('click', () => addHardGuardrail());
    document.getElementById('add-soft-guardrail-btn').addEventListener('click', () => addSoftGuardrail());
    document.getElementById('save-rubric-btn').addEventListener('click', saveRubric);
    document.getElementById('clear-builder-btn').addEventListener('click', clearForm);
    document.getElementById('export-rubric-btn').addEventListener('click', exportCurrentRubric);
    document.getElementById('import-rubric-input').addEventListener('change', importRubricFile);
    document.getElementById('load-example-btn').addEventListener('click', loadExample);
    document.getElementById('cancel-edit-btn').addEventListener('click', cancelEdit);
    document.getElementById('print-rubric-btn').addEventListener('click', () => window.print());

    const builderSection = document.getElementById('tab-builder');
    builderSection.addEventListener('input', debounce(updatePreview, 300));
    builderSection.addEventListener('change', updatePreview);

    refreshSavedRubricsList();

    if (Store.isFirstVisit()) {
      loadExample();
    }
  }

  // ===== Criteria =====

  function addCriterion(data = null) {
    criteriaCount++;
    const container = document.getElementById('criteria-list');

    const card = document.createElement('div');
    card.className = 'criterion-card';
    card.dataset.criterionIdx = criteriaCount;

    const levelLabels = ['0 = Missing', '1 = Weak', '2 = Adequate', '3 = Strong', '4 = Exemplary'];
    const levelColors = ['text-red-500', 'text-orange-500', 'text-yellow-600', 'text-blue-500', 'text-green-600'];

    // Header row
    const headerRow = createElement('div', { className: 'flex items-center justify-between mb-2' });

    const leftGroup = createElement('div', { className: 'flex items-center gap-2 flex-1 min-w-0' });
    const collapseToggle = createElement('span', { className: 'collapse-toggle text-xs text-gray-400', title: 'Toggle' });
    const nameInput = createElement('input', {
      type: 'text',
      className: 'criterion-name input-field text-sm font-semibold py-1',
      placeholder: 'Criterion name',
      value: data ? data.name : ''
    });
    leftGroup.appendChild(collapseToggle);
    leftGroup.appendChild(nameInput);

    const rightGroup = createElement('div', { className: 'flex items-center gap-2 ml-2 shrink-0' });
    const weightLabel = createElement('label', { className: 'text-xs text-gray-500 whitespace-nowrap' }, ['Weight:']);
    const weightSelect = createElement('select', { className: 'criterion-weight input-field w-16 text-xs py-1' });
    [1,2,3,4,5].forEach(w => {
      const opt = createElement('option', { value: String(w) }, [String(w)]);
      if (data && data.weight === w) opt.selected = true;
      weightSelect.appendChild(opt);
    });
    if (!data) weightSelect.value = '3';

    const removeBtn = createElement('button', { className: 'remove-criterion text-red-400 hover:text-red-600 text-lg leading-none', title: 'Remove' });
    removeBtn.textContent = '\u00D7';

    rightGroup.appendChild(weightLabel);
    rightGroup.appendChild(weightSelect);
    rightGroup.appendChild(removeBtn);

    headerRow.appendChild(leftGroup);
    headerRow.appendChild(rightGroup);
    card.appendChild(headerRow);

    // Levels section
    const levelsContainer = createElement('div', { className: 'criterion-levels' });
    const levelsGrid = createElement('div', { className: 'levels-grid mt-2' });

    levelLabels.forEach((label, li) => {
      const levelBox = createElement('div', { className: 'level-box level-' + li });
      const labelDiv = createElement('div', { className: 'text-xs font-semibold mb-1 ' + levelColors[li] }, [label]);
      const textarea = createElement('textarea', {
        className: 'level-desc',
        placeholder: 'Describe this level...',
        'data-level': String(li)
      });
      textarea.value = (data && data.levels && data.levels[li]) ? data.levels[li] : '';
      levelBox.appendChild(labelDiv);
      levelBox.appendChild(textarea);
      levelsGrid.appendChild(levelBox);
    });

    levelsContainer.appendChild(levelsGrid);
    card.appendChild(levelsContainer);

    // Event listeners
    removeBtn.addEventListener('click', () => {
      card.remove();
      updatePreview();
    });

    collapseToggle.addEventListener('click', () => {
      card.classList.toggle('collapsed');
    });

    container.appendChild(card);
    updatePreview();
    return card;
  }

  // ===== Hard Guardrails =====

  function addHardGuardrail(data = null) {
    hardGuardrailCount++;
    const container = document.getElementById('hard-guardrails-list');

    const card = createElement('div', { className: 'guardrail-card flex items-start gap-2' });
    const fieldGroup = createElement('div', { className: 'flex-1 space-y-1' });

    const nameInput = createElement('input', {
      type: 'text',
      className: 'guardrail-name input-field text-sm py-1',
      placeholder: 'Guardrail name',
      value: data ? data.name : ''
    });
    const descInput = createElement('input', {
      type: 'text',
      className: 'guardrail-desc input-field text-xs py-1',
      placeholder: 'Description',
      value: data ? data.description : ''
    });

    fieldGroup.appendChild(nameInput);
    fieldGroup.appendChild(descInput);

    const removeBtn = createElement('button', {
      className: 'remove-guardrail text-red-400 hover:text-red-600 text-lg leading-none mt-1',
      title: 'Remove'
    });
    removeBtn.textContent = '\u00D7';

    card.appendChild(fieldGroup);
    card.appendChild(removeBtn);

    removeBtn.addEventListener('click', () => {
      card.remove();
      updatePreview();
    });

    container.appendChild(card);
    updatePreview();
  }

  // ===== Soft Guardrails =====

  function addSoftGuardrail(data = null) {
    softGuardrailCount++;
    const container = document.getElementById('soft-guardrails-list');

    const card = createElement('div', { className: 'guardrail-card flex items-start gap-2' });
    const fieldGroup = createElement('div', { className: 'flex-1 space-y-1' });

    const topRow = createElement('div', { className: 'flex gap-2' });
    const nameInput = createElement('input', {
      type: 'text',
      className: 'guardrail-name input-field text-sm py-1 flex-1',
      placeholder: 'Guardrail name',
      value: data ? data.name : ''
    });

    const penaltyGroup = createElement('div', { className: 'flex items-center gap-1 shrink-0' });
    const penaltyLabel = createElement('label', { className: 'text-xs text-gray-500' }, ['Penalty:']);
    const penaltyInput = createElement('input', {
      type: 'number',
      className: 'guardrail-penalty input-field w-16 text-xs py-1',
      min: '1',
      max: '10',
      value: data ? String(data.penalty) : '5',
      placeholder: '%'
    });
    const pctLabel = createElement('span', { className: 'text-xs text-gray-400' }, ['%']);

    penaltyGroup.appendChild(penaltyLabel);
    penaltyGroup.appendChild(penaltyInput);
    penaltyGroup.appendChild(pctLabel);

    topRow.appendChild(nameInput);
    topRow.appendChild(penaltyGroup);

    const descInput = createElement('input', {
      type: 'text',
      className: 'guardrail-desc input-field text-xs py-1',
      placeholder: 'Description',
      value: data ? data.description : ''
    });

    fieldGroup.appendChild(topRow);
    fieldGroup.appendChild(descInput);

    const removeBtn = createElement('button', {
      className: 'remove-guardrail text-yellow-500 hover:text-yellow-700 text-lg leading-none mt-1',
      title: 'Remove'
    });
    removeBtn.textContent = '\u00D7';

    card.appendChild(fieldGroup);
    card.appendChild(removeBtn);

    removeBtn.addEventListener('click', () => {
      card.remove();
      updatePreview();
    });

    container.appendChild(card);
    updatePreview();
  }

  // ===== Collect Form Data =====

  function collectFormData() {
    const name = document.getElementById('rubric-name').value.trim();
    const description = document.getElementById('rubric-description').value.trim();
    const domain = document.getElementById('rubric-domain').value.trim();
    const threshold = parseInt(document.getElementById('rubric-threshold').value) || 96;

    const criteriaCards = document.querySelectorAll('#criteria-list .criterion-card');
    const criteria = [];
    criteriaCards.forEach(card => {
      const cName = card.querySelector('.criterion-name').value.trim();
      const weight = parseInt(card.querySelector('.criterion-weight').value) || 3;
      const levels = [];
      card.querySelectorAll('.level-desc').forEach(ta => {
        levels.push(ta.value.trim());
      });
      criteria.push({ name: cName, weight, levels });
    });

    const hardCards = document.querySelectorAll('#hard-guardrails-list .guardrail-card');
    const hardGuardrails = [];
    hardCards.forEach(card => {
      const gName = card.querySelector('.guardrail-name').value.trim();
      const gDesc = card.querySelector('.guardrail-desc').value.trim();
      if (gName) hardGuardrails.push({ name: gName, description: gDesc });
    });

    const softCards = document.querySelectorAll('#soft-guardrails-list .guardrail-card');
    const softGuardrails = [];
    softCards.forEach(card => {
      const gName = card.querySelector('.guardrail-name').value.trim();
      const gDesc = card.querySelector('.guardrail-desc').value.trim();
      const penalty = parseInt(card.querySelector('.guardrail-penalty').value) || 5;
      if (gName) softGuardrails.push({ name: gName, description: gDesc, penalty });
    });

    return { name, description, domain, threshold, criteria, hardGuardrails, softGuardrails };
  }

  // ===== Validation =====

  function validate(data) {
    const errors = [];
    if (!data.name) errors.push('Rubric name is required.');
    if (data.criteria.length === 0) errors.push('At least one criterion is required.');
    data.criteria.forEach((c, i) => {
      if (!c.name) errors.push('Criterion ' + (i + 1) + ': Name is required.');
      const emptyLevels = c.levels.filter(l => !l).length;
      if (emptyLevels > 0) errors.push('Criterion "' + (c.name || i + 1) + '": All 5 level descriptions must be filled.');
    });
    if (data.threshold < 1 || data.threshold > 100) errors.push('Pass threshold must be between 1 and 100.');
    return errors;
  }

  // ===== Save =====

  function saveRubric() {
    const data = collectFormData();
    const errors = validate(data);

    if (errors.length > 0) {
      App.toast(errors.join('\n'), 'error');
      return;
    }

    if (editingRubricId) {
      data.id = editingRubricId;
    }

    Store.saveRubric(data);
    App.toast('Rubric "' + data.name + '" saved!', 'success');

    editingRubricId = data.id || null;
    refreshSavedRubricsList();

    if (typeof Scorer !== 'undefined') Scorer.refreshRubricSelect();
    if (typeof Dashboard !== 'undefined') Dashboard.refreshRubricSelect();
  }

  // ===== Clear Form =====

  function clearForm() {
    editingRubricId = null;
    document.getElementById('rubric-name').value = '';
    document.getElementById('rubric-description').value = '';
    document.getElementById('rubric-domain').value = '';
    document.getElementById('rubric-threshold').value = '96';
    document.getElementById('criteria-list').replaceChildren();
    document.getElementById('hard-guardrails-list').replaceChildren();
    document.getElementById('soft-guardrails-list').replaceChildren();
    document.getElementById('editing-indicator').classList.add('hidden');
    criteriaCount = 0;
    hardGuardrailCount = 0;
    softGuardrailCount = 0;
    updatePreview();
  }

  function cancelEdit() {
    clearForm();
  }

  // ===== Load Rubric into Editor =====

  function loadRubricIntoEditor(rubric) {
    clearForm();
    editingRubricId = rubric.id;

    document.getElementById('rubric-name').value = rubric.name || '';
    document.getElementById('rubric-description').value = rubric.description || '';
    document.getElementById('rubric-domain').value = rubric.domain || '';
    document.getElementById('rubric-threshold').value = rubric.threshold || 96;

    (rubric.criteria || []).forEach(c => addCriterion(c));
    (rubric.hardGuardrails || []).forEach(g => addHardGuardrail(g));
    (rubric.softGuardrails || []).forEach(g => addSoftGuardrail(g));

    if (rubric.id) {
      document.getElementById('editing-indicator').classList.remove('hidden');
      document.getElementById('editing-rubric-name').textContent = rubric.name;
    }

    updatePreview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ===== Load Example =====

  function loadExample() {
    const example = Store.getExampleRubric();
    const saved = Store.saveRubric(example);
    loadRubricIntoEditor(saved);
    refreshSavedRubricsList();
    if (typeof Scorer !== 'undefined') Scorer.refreshRubricSelect();
    if (typeof Dashboard !== 'undefined') Dashboard.refreshRubricSelect();
    App.toast('Example rubric loaded!', 'success');
  }

  // ===== Export =====

  function exportCurrentRubric() {
    const data = collectFormData();
    if (!data.name) {
      App.toast('Please name your rubric before exporting.', 'warning');
      return;
    }

    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rubric-' + data.name.toLowerCase().replace(/\s+/g, '-') + '.json';
    a.click();
    URL.revokeObjectURL(url);
    App.toast('Rubric exported!', 'success');
  }

  // ===== Import =====

  function importRubricFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const rubric = Store.importRubric(evt.target.result);
      if (rubric) {
        loadRubricIntoEditor(rubric);
        refreshSavedRubricsList();
        if (typeof Scorer !== 'undefined') Scorer.refreshRubricSelect();
        if (typeof Dashboard !== 'undefined') Dashboard.refreshRubricSelect();
        App.toast('Rubric "' + rubric.name + '" imported!', 'success');
      } else {
        App.toast('Failed to import rubric. Invalid format.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // ===== Live Preview =====

  function updatePreview() {
    const data = collectFormData();
    const preview = document.getElementById('rubric-preview');

    // Clear previous content safely
    preview.replaceChildren();

    if (!data.name && data.criteria.length === 0) {
      const placeholder = createElement('p', { className: 'text-gray-400 italic' }, ['Start building your rubric to see a preview here.']);
      preview.appendChild(placeholder);
      return;
    }

    // Title
    const title = createElement('h3', { className: 'text-base font-bold text-navy mb-1' }, [data.name || 'Untitled Rubric']);
    preview.appendChild(title);

    if (data.description) {
      const desc = createElement('p', { className: 'text-xs text-gray-500 mb-1' }, [data.description]);
      preview.appendChild(desc);
    }

    const metaText = data.domain
      ? 'Domain: ' + data.domain + ' \u00B7 Pass: ' + data.threshold + '%'
      : 'Pass Threshold: ' + data.threshold + '%';
    const meta = createElement('p', { className: 'text-xs text-gray-400 mb-2' }, [metaText]);
    preview.appendChild(meta);

    // Criteria table
    if (data.criteria.length > 0) {
      let maxWeighted = 0;
      data.criteria.forEach(c => maxWeighted += 4 * c.weight);

      const tableWrapper = createElement('div', { className: 'overflow-x-auto mb-3' });
      const table = createElement('table', { className: 'preview-rubric-table' });

      // thead
      const thead = createElement('thead');
      const headerRow = createElement('tr');
      ['Criterion', 'Wt', '0 Missing', '1 Weak', '2 Adequate', '3 Strong', '4 Exemplary'].forEach(text => {
        const th = createElement('th', {}, [text]);
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      // tbody
      const tbody = createElement('tbody');
      data.criteria.forEach(c => {
        const tr = createElement('tr');
        const nameTd = createElement('td', { className: 'font-semibold' }, [c.name || 'Unnamed']);
        const wtTd = createElement('td', { className: 'text-center font-bold' }, [String(c.weight)]);
        tr.appendChild(nameTd);
        tr.appendChild(wtTd);
        for (let l = 0; l < 5; l++) {
          const td = createElement('td', {}, [c.levels[l] || '']);
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      tableWrapper.appendChild(table);
      preview.appendChild(tableWrapper);

      const maxInfo = createElement('p', { className: 'text-xs text-gray-400' }, ['Max weighted score: ' + maxWeighted + ' points']);
      preview.appendChild(maxInfo);
    }

    // Hard guardrails
    if (data.hardGuardrails.length > 0) {
      const hardBox = createElement('div', { className: 'mt-3 p-2 bg-red-50 border border-red-200 rounded-lg' });
      const hardTitle = createElement('p', { className: 'text-xs font-bold text-red-600 mb-1' }, ['Hard Guardrails (Instant Fail):']);
      hardBox.appendChild(hardTitle);
      const ul = createElement('ul', { className: 'text-xs text-red-700 list-disc list-inside' });
      data.hardGuardrails.forEach(g => {
        const li = createElement('li');
        const strong = createElement('strong', {}, [g.name]);
        li.appendChild(strong);
        if (g.description) li.appendChild(document.createTextNode(': ' + g.description));
        ul.appendChild(li);
      });
      hardBox.appendChild(ul);
      preview.appendChild(hardBox);
    }

    // Soft guardrails
    if (data.softGuardrails.length > 0) {
      const softBox = createElement('div', { className: 'mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg' });
      const softTitle = createElement('p', { className: 'text-xs font-bold text-yellow-600 mb-1' }, ['Soft Guardrails (Penalties):']);
      softBox.appendChild(softTitle);
      const ul = createElement('ul', { className: 'text-xs text-yellow-700 list-disc list-inside' });
      data.softGuardrails.forEach(g => {
        const li = createElement('li');
        const strong = createElement('strong', {}, [g.name]);
        li.appendChild(strong);
        li.appendChild(document.createTextNode(' (-' + g.penalty + '%)'));
        if (g.description) li.appendChild(document.createTextNode(': ' + g.description));
        ul.appendChild(li);
      });
      softBox.appendChild(ul);
      preview.appendChild(softBox);
    }
  }

  // ===== Saved Rubrics List =====

  function refreshSavedRubricsList() {
    const container = document.getElementById('saved-rubrics-list');
    const rubrics = Store.getRubrics();

    container.replaceChildren();

    if (rubrics.length === 0) {
      const placeholder = createElement('p', { className: 'text-sm text-gray-400 italic' }, ['No rubrics saved yet.']);
      container.appendChild(placeholder);
      return;
    }

    rubrics.forEach(r => {
      const row = createElement('div', { className: 'flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors' });

      const info = createElement('div', { className: 'min-w-0 flex-1' });
      const nameDiv = createElement('div', { className: 'text-sm font-semibold text-navy truncate' }, [r.name]);
      const metaDiv = createElement('div', { className: 'text-xs text-gray-400' }, [
        (r.criteria ? r.criteria.length : 0) + ' criteria \u00B7 ' + (r.threshold || 96) + '% threshold'
      ]);
      info.appendChild(nameDiv);
      info.appendChild(metaDiv);

      const buttons = createElement('div', { className: 'flex gap-1 ml-2 shrink-0' });

      const editBtn = createElement('button', { className: 'edit-rubric-btn btn-outline text-xs px-2 py-1' }, ['Edit']);
      const dupeBtn = createElement('button', { className: 'duplicate-rubric-btn btn-outline text-xs px-2 py-1', title: 'Duplicate' }, ['Copy']);
      const exportBtn = createElement('button', { className: 'export-saved-rubric-btn btn-outline text-xs px-2 py-1' }, ['Export']);
      const deleteBtn = createElement('button', { className: 'delete-rubric-btn btn-outline-red text-xs px-2 py-1' }, ['Del']);

      editBtn.addEventListener('click', () => {
        const rubric = Store.getRubric(r.id);
        if (rubric) loadRubricIntoEditor(rubric);
      });

      dupeBtn.addEventListener('click', () => {
        const rubric = Store.getRubric(r.id);
        if (rubric) {
          const copy = { ...rubric, name: rubric.name + ' (Copy)', id: undefined, createdAt: undefined, updatedAt: undefined };
          copy.criteria = rubric.criteria.map(c => ({ ...c, levels: [...c.levels] }));
          copy.hardGuardrails = (rubric.hardGuardrails || []).map(g => ({ ...g }));
          copy.softGuardrails = (rubric.softGuardrails || []).map(g => ({ ...g }));
          Store.saveRubric(copy);
          refreshSavedRubricsList();
          if (typeof Scorer !== 'undefined') Scorer.refreshRubricSelect();
          if (typeof Dashboard !== 'undefined') Dashboard.refreshRubricSelect();
          App.toast('Duplicated "' + rubric.name + '"!', 'success');
        }
      });

      exportBtn.addEventListener('click', () => {
        const jsonStr = Store.exportRubric(r.id);
        if (jsonStr) {
          const rubric = Store.getRubric(r.id);
          const blob = new Blob([jsonStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'rubric-' + (rubric.name || 'export').toLowerCase().replace(/\s+/g, '-') + '.json';
          a.click();
          URL.revokeObjectURL(url);
          App.toast('Rubric exported!', 'success');
        }
      });

      deleteBtn.addEventListener('click', () => {
        const rubric = Store.getRubric(r.id);
        if (rubric && confirm('Delete rubric "' + rubric.name + '" and all its evaluations?')) {
          Store.deleteRubric(r.id);
          if (editingRubricId === r.id) clearForm();
          refreshSavedRubricsList();
          if (typeof Scorer !== 'undefined') Scorer.refreshRubricSelect();
          if (typeof Dashboard !== 'undefined') Dashboard.refreshRubricSelect();
          App.toast('Rubric "' + rubric.name + '" deleted.', 'success');
        }
      });

      buttons.appendChild(editBtn);
      buttons.appendChild(dupeBtn);
      buttons.appendChild(exportBtn);
      buttons.appendChild(deleteBtn);

      row.appendChild(info);
      row.appendChild(buttons);
      container.appendChild(row);
    });
  }

  // ===== Public API =====
  return {
    init,
    refreshSavedRubricsList,
    loadRubricIntoEditor,
    updatePreview
  };
})();
