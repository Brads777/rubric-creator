/**
 * scorer.js — Scoring interface logic
 * RubricIQ - SHIT Loop Evaluation Framework
 * (c)2026 Brad Scheller
 *
 * Security note: All user-provided strings are sanitized through escapeHtml()
 * or inserted via textContent. No raw user input is placed into innerHTML.
 */

const Scorer = (() => {
  let currentRubric = null;
  let criteriaScores = {};
  let hardViolations = [];
  let softViolations = [];

  // ===== Utility =====

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function createElement(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, val]) => {
      if (key === 'className') el.className = val;
      else if (key === 'textContent') el.textContent = val;
      else if (key.startsWith('data-')) el.setAttribute(key, val);
      else el.setAttribute(key, val);
    });
    children.forEach(child => {
      if (typeof child === 'string') el.appendChild(document.createTextNode(child));
      else if (child) el.appendChild(child);
    });
    return el;
  }

  // ===== Initialization =====

  function init() {
    document.getElementById('scorer-rubric-select').addEventListener('change', onRubricSelect);
    document.getElementById('submit-evaluation-btn').addEventListener('click', submitEvaluation);
    document.getElementById('reset-scorer-btn').addEventListener('click', resetScorer);

    refreshRubricSelect();
  }

  // ===== Refresh Rubric Dropdown =====

  function refreshRubricSelect() {
    const select = document.getElementById('scorer-rubric-select');
    const rubrics = Store.getRubrics();

    // Keep the first option
    while (select.options.length > 1) select.remove(1);

    rubrics.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.name;
      select.appendChild(opt);
    });
  }

  // ===== Rubric Selection =====

  function onRubricSelect() {
    const rubricId = document.getElementById('scorer-rubric-select').value;
    if (!rubricId) {
      currentRubric = null;
      renderEmptyState();
      return;
    }

    currentRubric = Store.getRubric(rubricId);
    if (!currentRubric) return;

    criteriaScores = {};
    hardViolations = [];
    softViolations = [];

    renderCriteriaScoring();
    renderGuardrails();
    updateRunningScore();
    document.getElementById('submit-evaluation-btn').disabled = false;
  }

  // ===== Render Empty State =====

  function renderEmptyState() {
    const container = document.getElementById('scorer-criteria-container');
    container.replaceChildren();
    const p = createElement('p', { className: 'text-sm text-gray-400 italic bg-white rounded-xl shadow-sm border border-gray-200 p-6' },
      ['Select a rubric above to begin scoring.']);
    container.appendChild(p);

    document.getElementById('scorer-guardrails-container').classList.add('hidden');
    document.getElementById('submit-evaluation-btn').disabled = true;
    resetRunningScoreDisplay();
  }

  // ===== Render Criteria Scoring Cards =====

  function renderCriteriaScoring() {
    const container = document.getElementById('scorer-criteria-container');
    container.replaceChildren();

    const levelLabels = ['Missing', 'Weak', 'Adequate', 'Strong', 'Exemplary'];
    const levelColors = ['text-red-500', 'text-orange-500', 'text-yellow-600', 'text-blue-500', 'text-green-600'];

    currentRubric.criteria.forEach((criterion, idx) => {
      const card = createElement('div', { className: 'bg-white rounded-xl shadow-sm border border-gray-200 p-6' });

      // Header
      const header = createElement('div', { className: 'flex items-center justify-between mb-3' });
      const titleGroup = createElement('div');
      const titleEl = createElement('h4', { className: 'text-sm font-bold text-navy' }, [criterion.name]);
      const weightBadge = createElement('span', { className: 'text-xs text-gray-400 ml-2' }, ['Weight: ' + criterion.weight]);
      titleEl.appendChild(weightBadge);
      titleGroup.appendChild(titleEl);
      header.appendChild(titleGroup);

      const scoreDisplay = createElement('span', {
        className: 'criterion-score-display text-sm font-bold text-gray-300',
        'data-criterion-idx': String(idx)
      }, ['--/4']);
      header.appendChild(scoreDisplay);
      card.appendChild(header);

      // Radio options
      const radioGroup = createElement('div', { className: 'score-radio-group' });
      const radioName = 'criterion-' + idx;

      for (let level = 0; level < 5; level++) {
        const label = createElement('label', { className: 'score-radio-label' });

        const radio = createElement('input', {
          type: 'radio',
          name: radioName,
          value: String(level)
        });
        radio.addEventListener('change', () => {
          criteriaScores[idx] = level;
          // Update selected styling
          radioGroup.querySelectorAll('.score-radio-label').forEach(l => l.classList.remove('selected'));
          label.classList.add('selected');
          // Update criterion score display
          scoreDisplay.textContent = level + '/4';
          scoreDisplay.className = 'criterion-score-display text-sm font-bold ' + levelColors[level];
          updateRunningScore();
        });

        const scoreNum = createElement('span', {
          className: 'font-bold shrink-0 w-5 text-center ' + levelColors[level]
        }, [String(level)]);

        const descGroup = createElement('div', { className: 'flex-1' });
        const levelName = createElement('span', { className: 'font-semibold ' + levelColors[level] }, [levelLabels[level]]);
        descGroup.appendChild(levelName);

        if (criterion.levels && criterion.levels[level]) {
          const desc = createElement('p', { className: 'text-xs text-gray-500 mt-0.5' }, [criterion.levels[level]]);
          descGroup.appendChild(desc);
        }

        label.appendChild(radio);
        label.appendChild(scoreNum);
        label.appendChild(descGroup);
        radioGroup.appendChild(label);
      }

      card.appendChild(radioGroup);

      // Notes field
      const notesDiv = createElement('div', { className: 'mt-3' });
      const notesLabel = createElement('label', { className: 'text-xs text-gray-500' }, ['Evidence/Notes (optional):']);
      const notesInput = createElement('textarea', {
        className: 'input-field text-xs mt-1',
        rows: '2',
        placeholder: 'Add supporting evidence or notes...',
        'data-notes-idx': String(idx)
      });
      notesDiv.appendChild(notesLabel);
      notesDiv.appendChild(notesInput);
      card.appendChild(notesDiv);

      container.appendChild(card);
    });
  }

  // ===== Render Guardrails =====

  function renderGuardrails() {
    const guardrailContainer = document.getElementById('scorer-guardrails-container');
    guardrailContainer.classList.remove('hidden');

    // Hard guardrails
    const hardSection = document.getElementById('scorer-hard-guardrails');
    const hardList = document.getElementById('scorer-hard-guardrails-list');
    hardList.replaceChildren();

    if (currentRubric.hardGuardrails && currentRubric.hardGuardrails.length > 0) {
      hardSection.classList.remove('hidden');
      currentRubric.hardGuardrails.forEach((g, idx) => {
        const label = createElement('label', { className: 'flex items-start gap-2 cursor-pointer' });
        const checkbox = createElement('input', { type: 'checkbox', className: 'mt-0.5 accent-red-600' });
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) {
            if (!hardViolations.includes(idx)) hardViolations.push(idx);
          } else {
            hardViolations = hardViolations.filter(i => i !== idx);
          }
          updateRunningScore();
        });
        const textDiv = createElement('div');
        const nameSpan = createElement('span', { className: 'text-sm font-semibold text-red-700' }, [g.name]);
        textDiv.appendChild(nameSpan);
        if (g.description) {
          const descSpan = createElement('p', { className: 'text-xs text-red-500' }, [g.description]);
          textDiv.appendChild(descSpan);
        }
        label.appendChild(checkbox);
        label.appendChild(textDiv);
        hardList.appendChild(label);
      });
    } else {
      hardSection.classList.add('hidden');
    }

    // Soft guardrails
    const softSection = document.getElementById('scorer-soft-guardrails');
    const softList = document.getElementById('scorer-soft-guardrails-list');
    softList.replaceChildren();

    if (currentRubric.softGuardrails && currentRubric.softGuardrails.length > 0) {
      softSection.classList.remove('hidden');
      currentRubric.softGuardrails.forEach((g, idx) => {
        const label = createElement('label', { className: 'flex items-start gap-2 cursor-pointer' });
        const checkbox = createElement('input', { type: 'checkbox', className: 'mt-0.5 accent-yellow-600' });
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) {
            if (!softViolations.includes(idx)) softViolations.push(idx);
          } else {
            softViolations = softViolations.filter(i => i !== idx);
          }
          updateRunningScore();
        });
        const textDiv = createElement('div');
        const nameSpan = createElement('span', { className: 'text-sm font-semibold text-yellow-700' }, [g.name + ' (-' + g.penalty + '%)']);
        textDiv.appendChild(nameSpan);
        if (g.description) {
          const descSpan = createElement('p', { className: 'text-xs text-yellow-600' }, [g.description]);
          textDiv.appendChild(descSpan);
        }
        label.appendChild(checkbox);
        label.appendChild(textDiv);
        softList.appendChild(label);
      });
    } else {
      softSection.classList.add('hidden');
    }

    // Hide guardrail container if neither has entries
    if ((!currentRubric.hardGuardrails || currentRubric.hardGuardrails.length === 0) &&
        (!currentRubric.softGuardrails || currentRubric.softGuardrails.length === 0)) {
      guardrailContainer.classList.add('hidden');
    }
  }

  // ===== Running Score =====

  function updateRunningScore() {
    if (!currentRubric) {
      resetRunningScoreDisplay();
      return;
    }

    const result = Store.calculateScore(currentRubric, criteriaScores, hardViolations, softViolations);

    // Update circle
    const circle = document.getElementById('score-circle');
    const percentEl = document.getElementById('score-percentage');
    const pointsEl = document.getElementById('score-points');
    const thresholdEl = document.getElementById('score-threshold');
    const verdictEl = document.getElementById('score-verdict');
    const hardFailEl = document.getElementById('score-hard-fail');
    const penaltyEl = document.getElementById('score-penalty-info');

    const displayPct = result.hardFail ? 0 : result.finalPercentage;

    percentEl.textContent = displayPct.toFixed(1) + '%';
    pointsEl.textContent = result.rawScore + ' / ' + result.maxScore + ' points';
    thresholdEl.textContent = 'Threshold: ' + result.threshold + '%';

    // Color coding
    circle.className = 'w-32 h-32 mx-auto rounded-full border-8 flex items-center justify-center mb-3';
    if (result.hardFail) {
      circle.classList.add('score-circle-fail');
      percentEl.className = 'text-3xl font-bold text-red-600';
      verdictEl.textContent = 'FAIL';
      verdictEl.className = 'text-lg font-bold text-red-600';
    } else if (result.finalPercentage >= result.threshold) {
      circle.classList.add('score-circle-pass');
      percentEl.className = 'text-3xl font-bold text-green-600';
      verdictEl.textContent = 'PASS';
      verdictEl.className = 'text-lg font-bold text-green-600';
    } else if (result.finalPercentage >= result.threshold - 5) {
      circle.classList.add('score-circle-close');
      percentEl.className = 'text-3xl font-bold text-yellow-600';
      verdictEl.textContent = 'FAIL';
      verdictEl.className = 'text-lg font-bold text-yellow-600';
    } else {
      circle.classList.add('score-circle-fail');
      percentEl.className = 'text-3xl font-bold text-red-600';
      verdictEl.textContent = 'FAIL';
      verdictEl.className = 'text-lg font-bold text-red-600';
    }

    // Hard fail indicator
    if (result.hardFail) {
      hardFailEl.classList.remove('hidden');
    } else {
      hardFailEl.classList.add('hidden');
    }

    // Penalty info
    if (result.penaltyTotal > 0) {
      penaltyEl.classList.remove('hidden');
      penaltyEl.textContent = 'Soft penalty: -' + result.penaltyTotal + '% (raw: ' + result.percentage.toFixed(1) + '%)';
    } else {
      penaltyEl.classList.add('hidden');
    }
  }

  function resetRunningScoreDisplay() {
    const circle = document.getElementById('score-circle');
    circle.className = 'w-32 h-32 mx-auto rounded-full border-8 border-gray-200 flex items-center justify-center mb-3';
    document.getElementById('score-percentage').textContent = '--%';
    document.getElementById('score-percentage').className = 'text-3xl font-bold text-gray-300';
    document.getElementById('score-points').textContent = '0 / 0 points';
    document.getElementById('score-threshold').textContent = 'Threshold: --%';
    document.getElementById('score-verdict').textContent = '--';
    document.getElementById('score-verdict').className = 'text-lg font-bold text-gray-300';
    document.getElementById('score-hard-fail').classList.add('hidden');
    document.getElementById('score-penalty-info').classList.add('hidden');
  }

  // ===== Submit Evaluation =====

  function submitEvaluation() {
    if (!currentRubric) {
      App.toast('Please select a rubric first.', 'warning');
      return;
    }

    const presenter = document.getElementById('scorer-presenter').value.trim();
    const title = document.getElementById('scorer-title').value.trim();
    const evaluator = document.getElementById('scorer-evaluator').value.trim();

    if (!presenter) {
      App.toast('Presenter name is required.', 'error');
      return;
    }
    if (!evaluator) {
      App.toast('Your name (evaluator) is required.', 'error');
      return;
    }

    // Check that at least some criteria are scored
    const scoredCount = Object.keys(criteriaScores).length;
    if (scoredCount === 0) {
      App.toast('Please score at least one criterion before submitting.', 'warning');
      return;
    }
    if (scoredCount < currentRubric.criteria.length) {
      if (!confirm('You have only scored ' + scoredCount + ' of ' + currentRubric.criteria.length + ' criteria. Unscored criteria will count as 0. Continue?')) {
        return;
      }
    }

    // Gather notes
    const notes = {};
    document.querySelectorAll('[data-notes-idx]').forEach(ta => {
      const val = ta.value.trim();
      if (val) notes[ta.dataset.notesIdx] = val;
    });

    // Calculate final score
    const result = Store.calculateScore(currentRubric, criteriaScores, hardViolations, softViolations);

    const evaluation = {
      rubricId: currentRubric.id,
      rubricName: currentRubric.name,
      presenter,
      title,
      evaluator,
      scores: { ...criteriaScores },
      notes,
      hardViolations: [...hardViolations],
      softViolations: [...softViolations],
      result
    };

    Store.saveEvaluation(evaluation);
    App.toast('Evaluation submitted! Score: ' + result.finalPercentage.toFixed(1) + '% (' + (result.passed ? 'PASS' : 'FAIL') + ')', 'success');

    // Refresh dashboard
    if (typeof Dashboard !== 'undefined') Dashboard.refresh();

    // Show result alert
    const resultMsg = result.hardFail
      ? 'HARD GUARDRAIL VIOLATION - AUTOMATIC FAIL'
      : (result.passed ? 'PASSED' : 'FAILED') + ' with ' + result.finalPercentage.toFixed(1) + '%';
    alert('Evaluation Result: ' + resultMsg);
  }

  // ===== Reset Scorer =====

  function resetScorer() {
    currentRubric = null;
    criteriaScores = {};
    hardViolations = [];
    softViolations = [];

    document.getElementById('scorer-rubric-select').value = '';
    document.getElementById('scorer-presenter').value = '';
    document.getElementById('scorer-title').value = '';
    document.getElementById('scorer-evaluator').value = '';

    renderEmptyState();
  }

  // ===== Public API =====
  return {
    init,
    refreshRubricSelect,
    resetScorer
  };
})();
