/**
 * scorer.js — Scoring interface logic
 * RubricIQ - S.H.I.T. Evaluation Framework
 * ©2026 G. Bradley Scheller. All rights reserved.
 *
 * Security note: All user-provided strings are sanitized through escapeHtml()
 * or inserted via textContent. No raw user input is placed into innerHTML.
 */

const Scorer = (() => {
  let currentRubric = null;
  let criteriaScores = {};
  let criteriaComments = {};
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

    // Auto-detect iteration when presenter name or rubric changes
    document.getElementById('scorer-presenter').addEventListener('input', autoDetectIteration);
    document.getElementById('scorer-rubric-select').addEventListener('change', autoDetectIteration);

    refreshRubricSelect();
  }

  // ===== Auto-Detect Iteration =====

  function autoDetectIteration() {
    const rubricId = document.getElementById('scorer-rubric-select').value;
    const presenter = document.getElementById('scorer-presenter').value.trim();
    const iterInput = document.getElementById('scorer-iteration');
    const hint = document.getElementById('scorer-iteration-hint');

    if (!rubricId || !presenter) {
      hint.classList.add('hidden');
      return;
    }

    // Find previous evaluations for this presenter+rubric combo
    const evals = Store.getEvaluationsForRubric(rubricId).filter(
      e => (e.presenter || '').toLowerCase() === presenter.toLowerCase()
    );

    if (evals.length > 0) {
      // Find the max iteration number used
      const maxIter = evals.reduce((max, e) => Math.max(max, e.iteration || 1), 0);
      const nextIter = maxIter + 1;
      iterInput.value = nextIter;
      hint.textContent = evals.length + ' previous iteration' + (evals.length > 1 ? 's' : '') + ' found. Suggesting iteration ' + nextIter + '.';
      hint.classList.remove('hidden');
    } else {
      iterInput.value = 1;
      hint.textContent = 'First evaluation for this presenter.';
      hint.classList.remove('hidden');
    }
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
    criteriaComments = {};
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

      const headerRight = createElement('div', { className: 'flex items-center gap-3' });
      const scoreDisplay = createElement('span', {
        className: 'criterion-score-display text-sm font-bold text-gray-300',
        'data-criterion-idx': String(idx)
      }, ['--/4']);
      headerRight.appendChild(scoreDisplay);

      // W x G display
      const wxgDisplay = createElement('div', { className: 'text-right', 'data-wxg-idx': String(idx) });
      const wxgValue = createElement('div', { className: 'text-sm font-bold text-gray-300' }, ['\u2014']);
      wxgValue.setAttribute('data-wxg-value', String(idx));
      const wxgMax = createElement('div', { className: 'text-xs text-gray-400' }, ['max ' + (criterion.weight * 4)]);
      wxgDisplay.appendChild(wxgValue);
      wxgDisplay.appendChild(wxgMax);
      headerRight.appendChild(wxgDisplay);

      header.appendChild(headerRight);
      card.appendChild(header);

      // Radio options — reversed order: 4 (Exemplary) first, 0 (Missing) last
      const radioGroup = createElement('div', { className: 'score-radio-group' });
      const radioName = 'criterion-' + idx;

      for (let level = 4; level >= 0; level--) {
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
          // Update W x G display
          const total = criterion.weight * level;
          const wxgEl = document.querySelector('[data-wxg-value="' + idx + '"]');
          if (wxgEl) {
            wxgEl.textContent = criterion.weight + ' \u00D7 ' + level + ' = ' + total;
            wxgEl.className = 'text-sm font-bold ' + levelColors[level];
          }
          // Show/hide improvement tip
          const tipEl = card.querySelector('.improvement-tip');
          if (level < 4 && criterion.levels && criterion.levels[4]) {
            if (tipEl) {
              tipEl.classList.remove('hidden');
              tipEl.querySelector('.improvement-tip-text').textContent = criterion.levels[4];
            }
          } else {
            if (tipEl) tipEl.classList.add('hidden');
          }
          // Update commentary placeholder based on score
          const commentEl = card.querySelector('[data-comment-idx="' + idx + '"]');
          if (commentEl) {
            if (level <= 2) {
              commentEl.placeholder = 'What specific improvements would help reach a higher score?';
            } else if (level === 3) {
              commentEl.placeholder = 'What would push this from Strong to Excellent?';
            } else {
              commentEl.placeholder = 'What made this exemplary? What should they keep doing?';
            }
          }
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

      // Improvement tip (hidden by default, shown when score < 4)
      if (criterion.levels && criterion.levels[4]) {
        const tipDiv = createElement('div', { className: 'improvement-tip hidden mt-3 p-3 rounded-lg border' });
        tipDiv.style.backgroundColor = '#f0f7ff';
        tipDiv.style.borderColor = '#C4A35A';
        const tipHeader = createElement('span', { className: 'text-xs font-bold' });
        tipHeader.style.color = '#1B365D';
        tipHeader.textContent = '\uD83D\uDCA1 To reach Excellent: ';
        const tipText = createElement('span', { className: 'improvement-tip-text text-xs' });
        tipText.style.color = '#1B365D';
        tipText.textContent = criterion.levels[4];
        tipDiv.appendChild(tipHeader);
        tipDiv.appendChild(tipText);
        card.appendChild(tipDiv);
      }

      // Commentary textarea
      const commentDiv = createElement('div', { className: 'mt-3' });
      const commentLabel = createElement('label', { className: 'text-xs font-medium text-gray-600' }, ['Commentary:']);
      const commentInput = createElement('textarea', {
        className: 'input-field text-xs mt-1',
        rows: '2',
        placeholder: 'Why did you select this score? What evidence supports it?',
        'data-comment-idx': String(idx)
      });
      commentInput.addEventListener('input', () => {
        criteriaComments[idx] = commentInput.value;
      });
      commentDiv.appendChild(commentLabel);
      commentDiv.appendChild(commentInput);
      card.appendChild(commentDiv);

      // Notes field
      const notesDiv = createElement('div', { className: 'mt-2' });
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
    const iteration = parseInt(document.getElementById('scorer-iteration').value, 10) || 1;

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

    // Gather commentary
    const comments = {};
    document.querySelectorAll('[data-comment-idx]').forEach(ta => {
      const val = ta.value.trim();
      if (val) comments[ta.dataset.commentIdx] = val;
    });

    // Calculate final score
    const result = Store.calculateScore(currentRubric, criteriaScores, hardViolations, softViolations);

    const evaluation = {
      rubricId: currentRubric.id,
      rubricName: currentRubric.name,
      presenter,
      title,
      evaluator,
      iteration,
      scores: { ...criteriaScores },
      notes,
      comments,
      hardViolations: [...hardViolations],
      softViolations: [...softViolations],
      result
    };

    const savedEvaluation = Store.saveEvaluation(evaluation);
    App.toast('Evaluation submitted! Score: ' + result.finalPercentage.toFixed(1) + '% (' + (result.passed ? 'PASS' : 'FAIL') + ')', 'success');

    // Refresh dashboard
    if (typeof Dashboard !== 'undefined') Dashboard.refresh();

    // Show result with Generate Report option
    showResultOverlay(savedEvaluation);
  }

  // ===== Result Overlay After Submit =====

  function showResultOverlay(evaluation) {
    const result = evaluation.result;
    const resultMsg = result.hardFail
      ? 'HARD GUARDRAIL VIOLATION - AUTOMATIC FAIL'
      : (result.passed ? 'PASSED' : 'FAILED') + ' with ' + result.finalPercentage.toFixed(1) + '%';

    // Create overlay
    const overlay = createElement('div', {
      className: 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4'
    });
    const box = createElement('div', {
      className: 'bg-white rounded-2xl shadow-xl max-w-md w-full p-6 text-center'
    });

    const passColor = result.passed ? 'text-green-600' : 'text-red-600';
    const titleEl = createElement('h3', { className: 'text-lg font-bold text-navy mb-2' }, ['Evaluation Submitted']);
    const scoreEl = createElement('div', { className: 'text-4xl font-bold mb-1 ' + passColor },
      [result.finalPercentage.toFixed(1) + '%']);
    const labelEl = createElement('div', { className: 'text-lg font-bold mb-4 ' + passColor },
      [result.passed ? 'PASSED' : 'FAILED']);

    if (result.hardFail) {
      const hardNote = createElement('div', { className: 'text-sm text-red-600 font-semibold mb-4' },
        ['Hard guardrail violation - automatic fail']);
      box.appendChild(titleEl);
      box.appendChild(scoreEl);
      box.appendChild(hardNote);
    } else {
      box.appendChild(titleEl);
      box.appendChild(scoreEl);
      box.appendChild(labelEl);
    }

    const btnRow = createElement('div', { className: 'flex gap-3 justify-center' });

    const reportBtn = createElement('button', {
      className: 'px-5 py-2.5 rounded-lg text-sm font-semibold text-white cursor-pointer'
    });
    reportBtn.style.backgroundColor = '#1B365D';
    reportBtn.textContent = 'Generate Report';
    reportBtn.addEventListener('click', () => {
      if (typeof Dashboard !== 'undefined') Dashboard.generateReport(evaluation);
    });

    const closeBtn = createElement('button', {
      className: 'px-5 py-2.5 rounded-lg text-sm font-semibold border border-gray-300 text-gray-700 cursor-pointer hover:bg-gray-50'
    });
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => overlay.remove());

    btnRow.appendChild(reportBtn);
    btnRow.appendChild(closeBtn);
    box.appendChild(btnRow);
    overlay.appendChild(box);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
  }

  // ===== Reset Scorer =====

  function resetScorer() {
    currentRubric = null;
    criteriaScores = {};
    criteriaComments = {};
    hardViolations = [];
    softViolations = [];

    document.getElementById('scorer-rubric-select').value = '';
    document.getElementById('scorer-presenter').value = '';
    document.getElementById('scorer-title').value = '';
    document.getElementById('scorer-evaluator').value = '';
    document.getElementById('scorer-iteration').value = 1;
    document.getElementById('scorer-iteration-hint').classList.add('hidden');

    renderEmptyState();
  }

  // ===== Public API =====
  return {
    init,
    refreshRubricSelect,
    resetScorer
  };
})();
