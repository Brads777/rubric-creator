/**
 * dashboard.js — Results dashboard logic
 * RubricIQ - S.H.I.T. Evaluation Framework
 * ©2026 G. Bradley Scheller. All rights reserved.
 *
 * Security note: All user-provided strings are inserted via textContent
 * or createElement. No raw user input is placed into innerHTML.
 */

const Dashboard = (() => {
  let sortColumn = 'date';
  let sortDirection = 'desc';

  // ===== Utility =====

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
    document.getElementById('dashboard-rubric-select').addEventListener('change', refresh);
    document.getElementById('export-csv-btn').addEventListener('click', exportCSV);
    document.getElementById('clear-evaluations-btn').addEventListener('click', clearAllEvaluations);
    document.getElementById('close-detail-modal').addEventListener('click', closeDetailModal);
    document.getElementById('evaluation-detail-modal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('evaluation-detail-modal')) closeDetailModal();
    });

    refreshRubricSelect();
    refresh();
  }

  // ===== Refresh Rubric Dropdown =====

  function refreshRubricSelect() {
    const select = document.getElementById('dashboard-rubric-select');
    const rubrics = Store.getRubrics();

    while (select.options.length > 1) select.remove(1);

    rubrics.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.name;
      select.appendChild(opt);
    });
  }

  // ===== Main Refresh =====

  function refresh() {
    const rubricId = document.getElementById('dashboard-rubric-select').value;
    let evals = Store.getEvaluations();

    if (rubricId) {
      evals = evals.filter(e => e.rubricId === rubricId);
    }

    updateStats(evals);
    renderPresenterAverages(evals);
    renderEvaluationsTable(evals);
  }

  // ===== Stats =====

  function updateStats(evals) {
    document.getElementById('stat-total').textContent = evals.length;
    const passed = evals.filter(e => e.result && e.result.passed).length;
    const failed = evals.length - passed;
    document.getElementById('stat-pass').textContent = passed;
    document.getElementById('stat-fail').textContent = failed;

    if (evals.length > 0) {
      const avgScore = evals.reduce((sum, e) => sum + (e.result ? e.result.finalPercentage : 0), 0) / evals.length;
      document.getElementById('stat-avg').textContent = avgScore.toFixed(1) + '%';
    } else {
      document.getElementById('stat-avg').textContent = '--%';
    }
  }

  // ===== Presenter Averages =====

  function renderPresenterAverages(evals) {
    const section = document.getElementById('presenter-averages-section');
    const container = document.getElementById('presenter-averages-table');
    container.replaceChildren();

    // Group by presenter
    const presenterMap = {};
    evals.forEach(e => {
      const name = e.presenter || 'Unknown';
      if (!presenterMap[name]) presenterMap[name] = [];
      presenterMap[name].push(e);
    });

    const presenters = Object.keys(presenterMap);
    if (presenters.length === 0) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');

    const table = createElement('table', { className: 'w-full text-sm' });

    // Header
    const thead = createElement('thead');
    const headerRow = createElement('tr', { className: 'border-b-2 border-gray-200' });
    ['Presenter', 'Evaluations', 'Avg Score', 'Min', 'Max', 'Pass Rate'].forEach(text => {
      const th = createElement('th', { className: 'text-left py-2 px-3 text-xs font-bold text-navy uppercase' }, [text]);
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = createElement('tbody');
    presenters.sort().forEach(name => {
      const group = presenterMap[name];
      const scores = group.map(e => e.result ? e.result.finalPercentage : 0);
      const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      const passRate = (group.filter(e => e.result && e.result.passed).length / group.length * 100);

      const tr = createElement('tr', { className: 'border-b border-gray-100 hover:bg-gray-50' });

      const nameTd = createElement('td', { className: 'py-2 px-3 font-semibold' }, [name]);
      const countTd = createElement('td', { className: 'py-2 px-3' }, [String(group.length)]);
      const avgTd = createElement('td', { className: 'py-2 px-3 font-bold ' + (avg >= 96 ? 'text-green-600' : avg >= 91 ? 'text-yellow-600' : 'text-red-600') },
        [avg.toFixed(1) + '%']);
      const minTd = createElement('td', { className: 'py-2 px-3' }, [min.toFixed(1) + '%']);
      const maxTd = createElement('td', { className: 'py-2 px-3' }, [max.toFixed(1) + '%']);
      const passRateTd = createElement('td', { className: 'py-2 px-3' }, [passRate.toFixed(0) + '%']);

      tr.appendChild(nameTd);
      tr.appendChild(countTd);
      tr.appendChild(avgTd);
      tr.appendChild(minTd);
      tr.appendChild(maxTd);
      tr.appendChild(passRateTd);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  }

  // ===== Evaluations Table =====

  function renderEvaluationsTable(evals) {
    const container = document.getElementById('evaluations-table-container');
    container.replaceChildren();

    if (evals.length === 0) {
      const p = createElement('p', { className: 'text-sm text-gray-400 italic' }, ['No evaluations yet.']);
      container.appendChild(p);
      return;
    }

    // Sort
    const sorted = [...evals].sort((a, b) => {
      let aVal, bVal;
      switch (sortColumn) {
        case 'presenter': aVal = a.presenter || ''; bVal = b.presenter || ''; break;
        case 'title': aVal = a.title || ''; bVal = b.title || ''; break;
        case 'evaluator': aVal = a.evaluator || ''; bVal = b.evaluator || ''; break;
        case 'score': aVal = a.result ? a.result.finalPercentage : 0; bVal = b.result ? b.result.finalPercentage : 0; break;
        case 'passfail': aVal = a.result && a.result.passed ? 1 : 0; bVal = b.result && b.result.passed ? 1 : 0; break;
        case 'date': default: aVal = a.date || ''; bVal = b.date || ''; break;
      }
      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? cmp : -cmp;
      }
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    const table = createElement('table', { className: 'sortable-table w-full text-sm' });

    // Header
    const thead = createElement('thead');
    const headerRow = createElement('tr', { className: 'border-b-2 border-gray-200' });

    const columns = [
      { key: 'presenter', label: 'Presenter' },
      { key: 'title', label: 'Title' },
      { key: 'evaluator', label: 'Evaluator' },
      { key: 'score', label: 'Score %' },
      { key: 'passfail', label: 'Result' },
      { key: 'date', label: 'Date' }
    ];

    columns.forEach(col => {
      const th = createElement('th', { className: 'text-left py-2 px-3 text-xs font-bold text-navy uppercase' });
      th.textContent = col.label;

      const indicator = createElement('span', { className: 'sort-indicator' });
      if (sortColumn === col.key) {
        th.classList.add(sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
        indicator.textContent = sortDirection === 'asc' ? '\u25B2' : '\u25BC';
      } else {
        indicator.textContent = '\u25BC';
      }
      th.appendChild(indicator);

      th.addEventListener('click', () => {
        if (sortColumn === col.key) {
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          sortColumn = col.key;
          sortDirection = 'asc';
        }
        refresh();
      });

      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = createElement('tbody');
    sorted.forEach(ev => {
      const tr = createElement('tr', { className: 'border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors' });
      tr.addEventListener('click', () => showDetail(ev));

      const presenterTd = createElement('td', { className: 'py-2 px-3 font-semibold' }, [ev.presenter || '']);
      const titleTd = createElement('td', { className: 'py-2 px-3' }, [ev.title || '--']);
      const evaluatorTd = createElement('td', { className: 'py-2 px-3' }, [ev.evaluator || '']);

      const scorePct = ev.result ? ev.result.finalPercentage : 0;
      const scoreColor = ev.result && ev.result.hardFail ? 'text-red-600' :
        scorePct >= (ev.result ? ev.result.threshold : 96) ? 'text-green-600' :
        scorePct >= (ev.result ? ev.result.threshold : 96) - 5 ? 'text-yellow-600' : 'text-red-600';
      const scoreTd = createElement('td', { className: 'py-2 px-3 font-bold ' + scoreColor }, [scorePct.toFixed(1) + '%']);

      const passed = ev.result && ev.result.passed;
      const resultBadge = createElement('td', { className: 'py-2 px-3' });
      const badge = createElement('span', {
        className: 'inline-block px-2 py-0.5 rounded text-xs font-bold ' +
          (passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')
      }, [passed ? 'PASS' : 'FAIL']);
      resultBadge.appendChild(badge);

      const dateStr = ev.date ? new Date(ev.date).toLocaleDateString() : '--';
      const dateTd = createElement('td', { className: 'py-2 px-3 text-gray-500' }, [dateStr]);

      tr.appendChild(presenterTd);
      tr.appendChild(titleTd);
      tr.appendChild(evaluatorTd);
      tr.appendChild(scoreTd);
      tr.appendChild(resultBadge);
      tr.appendChild(dateTd);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  }

  // ===== Detail Modal =====

  function showDetail(ev) {
    const modal = document.getElementById('evaluation-detail-modal');
    const content = document.getElementById('evaluation-detail-content');
    content.replaceChildren();

    const rubric = Store.getRubric(ev.rubricId);

    // Header info
    const infoGrid = createElement('div', { className: 'grid grid-cols-2 gap-2 mb-4 text-sm' });

    const fields = [
      ['Presenter', ev.presenter],
      ['Title', ev.title || '--'],
      ['Evaluator', ev.evaluator],
      ['Date', ev.date ? new Date(ev.date).toLocaleString() : '--'],
      ['Rubric', ev.rubricName || '--'],
      ['Threshold', (ev.result ? ev.result.threshold : '--') + '%']
    ];

    fields.forEach(([label, value]) => {
      const div = createElement('div');
      const labelEl = createElement('span', { className: 'text-xs text-gray-400 uppercase' }, [label]);
      const valueEl = createElement('div', { className: 'font-semibold text-navy' }, [String(value)]);
      div.appendChild(labelEl);
      div.appendChild(valueEl);
      infoGrid.appendChild(div);
    });
    content.appendChild(infoGrid);

    // Score summary
    const scorePct = ev.result ? ev.result.finalPercentage : 0;
    const passed = ev.result && ev.result.passed;
    const scoreBox = createElement('div', {
      className: 'p-4 rounded-lg mb-4 text-center ' +
        (passed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200')
    });
    const scoreTitle = createElement('div', {
      className: 'text-3xl font-bold ' + (passed ? 'text-green-600' : 'text-red-600')
    }, [scorePct.toFixed(1) + '%']);
    const scoreLabel = createElement('div', {
      className: 'text-sm font-bold ' + (passed ? 'text-green-600' : 'text-red-600')
    }, [passed ? 'PASSED' : 'FAILED']);
    scoreBox.appendChild(scoreTitle);
    scoreBox.appendChild(scoreLabel);

    if (ev.result && ev.result.hardFail) {
      const hardNote = createElement('div', { className: 'text-sm text-red-700 mt-1 font-semibold' }, ['Hard guardrail violation - automatic fail']);
      scoreBox.appendChild(hardNote);
    }
    if (ev.result && ev.result.penaltyTotal > 0) {
      const penaltyNote = createElement('div', { className: 'text-xs text-yellow-600 mt-1' },
        ['Raw score: ' + ev.result.percentage.toFixed(1) + '% - Penalties: ' + ev.result.penaltyTotal + '%']);
      scoreBox.appendChild(penaltyNote);
    }

    const pointsNote = createElement('div', { className: 'text-xs text-gray-500 mt-1' },
      [ev.result ? (ev.result.rawScore + ' / ' + ev.result.maxScore + ' weighted points') : '']);
    scoreBox.appendChild(pointsNote);
    content.appendChild(scoreBox);

    // Criteria breakdown
    const criteriaTitle = createElement('h4', { className: 'text-sm font-bold text-navy uppercase mb-2' }, ['Criteria Breakdown']);
    content.appendChild(criteriaTitle);

    const levelLabels = ['Missing', 'Weak', 'Adequate', 'Strong', 'Exemplary'];

    if (rubric && rubric.criteria) {
      rubric.criteria.forEach((criterion, idx) => {
        const row = createElement('div', { className: 'detail-criterion-row' });

        const nameDiv = createElement('div');
        const namePrimary = createElement('div', { className: 'text-sm font-semibold' }, [criterion.name]);
        const weightLabel = createElement('span', { className: 'text-xs text-gray-400' }, ['Weight: ' + criterion.weight]);
        nameDiv.appendChild(namePrimary);
        nameDiv.appendChild(weightLabel);

        const score = ev.scores && ev.scores[idx] !== undefined ? ev.scores[idx] : 0;
        const levelColors = ['text-red-500', 'text-orange-500', 'text-yellow-600', 'text-blue-500', 'text-green-600'];
        const scoreDiv = createElement('div', { className: 'text-right' });
        const scoreVal = createElement('span', { className: 'font-bold ' + levelColors[score] }, [score + '/4']);
        const scoreLabel2 = createElement('span', { className: 'text-xs text-gray-400 ml-1' }, ['(' + levelLabels[score] + ')']);
        scoreDiv.appendChild(scoreVal);
        scoreDiv.appendChild(scoreLabel2);

        const weightedDiv = createElement('div', { className: 'text-right text-xs text-gray-500' },
          [(score * criterion.weight) + '/' + (4 * criterion.weight) + ' pts']);

        row.appendChild(nameDiv);
        row.appendChild(scoreDiv);
        row.appendChild(weightedDiv);
        content.appendChild(row);

        // Show commentary if present
        if (ev.comments && ev.comments[idx]) {
          const commentDiv = createElement('div', { className: 'text-sm text-navy pl-2 pt-1 pb-1' });
          const commentLabel = createElement('span', { className: 'text-xs font-semibold text-gray-500 uppercase' }, ['Commentary: ']);
          const commentText = createElement('span', { className: 'text-xs text-gray-700' }, [ev.comments[idx]]);
          commentDiv.appendChild(commentLabel);
          commentDiv.appendChild(commentText);
          content.appendChild(commentDiv);
        }

        // Show notes if present
        if (ev.notes && ev.notes[idx]) {
          const noteDiv = createElement('div', { className: 'text-xs text-gray-500 italic pl-2 pb-2 border-b border-gray-100' },
            ['Note: ' + ev.notes[idx]]);
          content.appendChild(noteDiv);
        }
      });
    }

    // Guardrail violations
    if (ev.hardViolations && ev.hardViolations.length > 0 && rubric && rubric.hardGuardrails) {
      const hardTitle = createElement('h4', { className: 'text-sm font-bold text-red-600 uppercase mt-4 mb-2' }, ['Hard Guardrail Violations']);
      content.appendChild(hardTitle);
      ev.hardViolations.forEach(idx => {
        const g = rubric.hardGuardrails[idx];
        if (g) {
          const item = createElement('div', { className: 'text-sm text-red-700 mb-1' }, ['\u2716 ' + g.name]);
          content.appendChild(item);
        }
      });
    }

    if (ev.softViolations && ev.softViolations.length > 0 && rubric && rubric.softGuardrails) {
      const softTitle = createElement('h4', { className: 'text-sm font-bold text-yellow-600 uppercase mt-4 mb-2' }, ['Soft Guardrail Violations']);
      content.appendChild(softTitle);
      ev.softViolations.forEach(idx => {
        const g = rubric.softGuardrails[idx];
        if (g) {
          const item = createElement('div', { className: 'text-sm text-yellow-700 mb-1' }, ['\u26A0 ' + g.name + ' (-' + g.penalty + '%)']);
          content.appendChild(item);
        }
      });
    }

    // Generate Report button
    const reportBtnContainer = createElement('div', { className: 'mt-4 pt-4 border-t border-gray-200 text-center' });
    const reportBtn = createElement('button', {
      className: 'inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white cursor-pointer'
    });
    reportBtn.style.backgroundColor = '#1B365D';
    reportBtn.textContent = 'Generate Report';
    reportBtn.addEventListener('click', () => generateReport(ev));
    reportBtnContainer.appendChild(reportBtn);
    content.appendChild(reportBtnContainer);

    modal.classList.remove('hidden');
  }

  // ===== Generate Print Report =====

  function generateReport(ev) {
    const rubric = Store.getRubric(ev.rubricId);
    const levelLabels = ['Missing', 'Weak', 'Adequate', 'Strong', 'Exemplary'];
    const scorePct = ev.result ? ev.result.finalPercentage : 0;
    const passed = ev.result && ev.result.passed;
    const dateStr = ev.date ? new Date(ev.date).toLocaleString() : '--';

    // Escape helper for safe HTML insertion
    function esc(str) {
      if (!str) return '';
      const d = document.createElement('div');
      d.textContent = str;
      return d.innerHTML;
    }

    // Build criteria rows for the full rubric table
    let rubricTableRows = '';
    if (rubric && rubric.criteria) {
      rubric.criteria.forEach(c => {
        rubricTableRows += '<tr>';
        rubricTableRows += '<td style="padding:6px 8px;border:1px solid #ddd;font-weight:600;">' + esc(c.name) + '</td>';
        rubricTableRows += '<td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-weight:700;">' + c.weight + '</td>';
        for (let l = 4; l >= 0; l--) {
          rubricTableRows += '<td style="padding:6px 8px;border:1px solid #ddd;font-size:11px;">' + esc(c.levels ? c.levels[l] || '' : '') + '</td>';
        }
        rubricTableRows += '</tr>';
      });
    }

    // Build scores section
    let scoresHtml = '';
    if (rubric && rubric.criteria) {
      rubric.criteria.forEach((criterion, idx) => {
        const score = ev.scores && ev.scores[idx] !== undefined ? ev.scores[idx] : 0;
        const weighted = score * criterion.weight;
        const maxWeighted = 4 * criterion.weight;
        const levelDesc = criterion.levels && criterion.levels[score] ? criterion.levels[score] : '';
        const scoreColors = ['#ef4444', '#f97316', '#ca8a04', '#3b82f6', '#16a34a'];

        scoresHtml += '<div style="margin-bottom:12px;padding:10px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa;">';
        scoresHtml += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        scoresHtml += '<div><strong>' + esc(criterion.name) + '</strong> <span style="color:#999;font-size:12px;">(Weight: ' + criterion.weight + ')</span></div>';
        scoresHtml += '<div style="text-align:right;">';
        scoresHtml += '<span style="font-weight:700;color:' + scoreColors[score] + ';font-size:18px;">' + score + '/4</span>';
        scoresHtml += ' <span style="color:#999;font-size:12px;">(' + levelLabels[score] + ')</span>';
        scoresHtml += '<div style="font-size:12px;color:#666;">' + weighted + '/' + maxWeighted + ' weighted pts</div>';
        scoresHtml += '</div></div>';

        if (levelDesc) {
          scoresHtml += '<div style="margin-top:6px;font-size:12px;color:#444;font-style:italic;">"' + esc(levelDesc) + '"</div>';
        }

        // Commentary
        if (ev.comments && ev.comments[idx]) {
          scoresHtml += '<div style="margin-top:6px;padding:6px 8px;background:#eef2ff;border-radius:4px;font-size:12px;">';
          scoresHtml += '<strong style="color:#1B365D;">Commentary:</strong> ' + esc(ev.comments[idx]);
          scoresHtml += '</div>';
        }

        scoresHtml += '</div>';
      });
    }

    // Build improvement suggestions
    let improvementsHtml = '';
    if (rubric && rubric.criteria) {
      let hasImprovements = false;
      rubric.criteria.forEach((criterion, idx) => {
        const score = ev.scores && ev.scores[idx] !== undefined ? ev.scores[idx] : 0;
        if (score < 4 && criterion.levels && criterion.levels[4]) {
          hasImprovements = true;
          improvementsHtml += '<div style="margin-bottom:8px;padding:8px 10px;background:#fffbeb;border:1px solid #C4A35A;border-radius:6px;font-size:12px;">';
          improvementsHtml += '<strong style="color:#1B365D;">' + esc(criterion.name) + '</strong> (scored ' + score + '/4):<br>';
          improvementsHtml += '<span style="color:#92400e;">To reach Excellent: ' + esc(criterion.levels[4]) + '</span>';
          improvementsHtml += '</div>';
        }
      });
      if (!hasImprovements) {
        improvementsHtml = '<p style="color:#16a34a;font-weight:600;">All criteria scored at Exemplary level. Outstanding performance!</p>';
      }
    }

    // Build guardrail violations
    let guardrailsHtml = '';
    if (ev.hardViolations && ev.hardViolations.length > 0 && rubric && rubric.hardGuardrails) {
      guardrailsHtml += '<div style="margin-bottom:8px;padding:8px;background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;">';
      guardrailsHtml += '<strong style="color:#dc2626;">Hard Guardrail Violations (Instant Fail):</strong><ul style="margin:4px 0 0 16px;">';
      ev.hardViolations.forEach(idx => {
        const g = rubric.hardGuardrails[idx];
        if (g) guardrailsHtml += '<li style="color:#991b1b;">' + esc(g.name) + (g.description ? ': ' + esc(g.description) : '') + '</li>';
      });
      guardrailsHtml += '</ul></div>';
    }
    if (ev.softViolations && ev.softViolations.length > 0 && rubric && rubric.softGuardrails) {
      guardrailsHtml += '<div style="margin-bottom:8px;padding:8px;background:#fefce8;border:1px solid #fde68a;border-radius:6px;">';
      guardrailsHtml += '<strong style="color:#ca8a04;">Soft Guardrail Violations:</strong><ul style="margin:4px 0 0 16px;">';
      ev.softViolations.forEach(idx => {
        const g = rubric.softGuardrails[idx];
        if (g) guardrailsHtml += '<li style="color:#92400e;">' + esc(g.name) + ' (-' + g.penalty + '%)' + (g.description ? ': ' + esc(g.description) : '') + '</li>';
      });
      guardrailsHtml += '</ul></div>';
    }
    if (!guardrailsHtml) {
      guardrailsHtml = '<p style="color:#16a34a;">No guardrail violations.</p>';
    }

    // Final score breakdown
    let breakdownHtml = '';
    if (ev.result) {
      breakdownHtml += '<div style="font-size:13px;color:#444;margin-top:8px;">';
      breakdownHtml += 'Raw weighted score: ' + ev.result.rawScore + ' / ' + ev.result.maxScore + ' points<br>';
      breakdownHtml += 'Raw percentage: ' + ev.result.percentage.toFixed(1) + '%<br>';
      if (ev.result.penaltyTotal > 0) {
        breakdownHtml += 'Soft guardrail penalties: -' + ev.result.penaltyTotal + '%<br>';
      }
      breakdownHtml += 'Final score: ' + ev.result.finalPercentage.toFixed(1) + '%<br>';
      breakdownHtml += 'Pass threshold: ' + ev.result.threshold + '%<br>';
      if (ev.result.hardFail) {
        breakdownHtml += '<strong style="color:#dc2626;">Hard guardrail violation -- automatic FAIL</strong>';
      }
      breakdownHtml += '</div>';
    }

    const passColor = passed ? '#16a34a' : '#dc2626';
    const passLabel = passed ? 'PASSED' : 'FAILED';

    const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>RubricIQ Evaluation Report</title>' +
      '<style>' +
      'body{font-family:Georgia,"Times New Roman",serif;max-width:900px;margin:0 auto;padding:24px;color:#1a1a1a;line-height:1.5;}' +
      'h1,h2,h3{font-family:"Segoe UI",Helvetica,Arial,sans-serif;}' +
      'table{width:100%;border-collapse:collapse;margin:8px 0;}' +
      'th{background:#1B365D;color:white;padding:6px 8px;text-align:left;font-size:11px;text-transform:uppercase;}' +
      '@media print{body{padding:12px;}.no-print{display:none !important;}}' +
      '</style></head><body>' +
      '<div style="text-align:center;border-bottom:3px solid #1B365D;padding-bottom:16px;margin-bottom:24px;">' +
        '<h1 style="color:#1B365D;margin:0 0 4px 0;font-size:24px;">RubricIQ Evaluation Report</h1>' +
        '<p style="color:#C4A35A;margin:0;font-size:13px;font-weight:600;">Scheller\'s Superior Human-in-the-Loop (S.H.I.T.) Evaluation Framework\u2122</p>' +
      '</div>' +

      '<h2 style="color:#1B365D;font-size:16px;border-bottom:1px solid #C4A35A;padding-bottom:4px;">Evaluation Information</h2>' +
      '<table><tr>' +
        '<td style="padding:4px 8px;border:1px solid #ddd;width:25%;font-weight:600;background:#f9fafb;">Presenter</td>' +
        '<td style="padding:4px 8px;border:1px solid #ddd;">' + esc(ev.presenter) + '</td>' +
        '<td style="padding:4px 8px;border:1px solid #ddd;width:25%;font-weight:600;background:#f9fafb;">Date</td>' +
        '<td style="padding:4px 8px;border:1px solid #ddd;">' + esc(dateStr) + '</td>' +
      '</tr><tr>' +
        '<td style="padding:4px 8px;border:1px solid #ddd;font-weight:600;background:#f9fafb;">Presentation Title</td>' +
        '<td style="padding:4px 8px;border:1px solid #ddd;">' + esc(ev.title || '--') + '</td>' +
        '<td style="padding:4px 8px;border:1px solid #ddd;font-weight:600;background:#f9fafb;">Evaluator</td>' +
        '<td style="padding:4px 8px;border:1px solid #ddd;">' + esc(ev.evaluator) + '</td>' +
      '</tr></table>' +

      '<h2 style="color:#1B365D;font-size:16px;border-bottom:1px solid #C4A35A;padding-bottom:4px;margin-top:20px;">Rubric Used</h2>' +
      '<table><tr>' +
        '<td style="padding:4px 8px;border:1px solid #ddd;width:25%;font-weight:600;background:#f9fafb;">Name</td>' +
        '<td style="padding:4px 8px;border:1px solid #ddd;">' + esc(rubric ? rubric.name : ev.rubricName || '--') + '</td>' +
      '</tr><tr>' +
        '<td style="padding:4px 8px;border:1px solid #ddd;font-weight:600;background:#f9fafb;">Description</td>' +
        '<td style="padding:4px 8px;border:1px solid #ddd;">' + esc(rubric ? rubric.description || '' : '') + '</td>' +
      '</tr><tr>' +
        '<td style="padding:4px 8px;border:1px solid #ddd;font-weight:600;background:#f9fafb;">Domain</td>' +
        '<td style="padding:4px 8px;border:1px solid #ddd;">' + esc(rubric ? rubric.domain || '--' : '--') + '</td>' +
      '</tr><tr>' +
        '<td style="padding:4px 8px;border:1px solid #ddd;font-weight:600;background:#f9fafb;">Pass Threshold</td>' +
        '<td style="padding:4px 8px;border:1px solid #ddd;">' + (ev.result ? ev.result.threshold : '--') + '%</td>' +
      '</tr></table>' +

      '<h2 style="color:#1B365D;font-size:16px;border-bottom:1px solid #C4A35A;padding-bottom:4px;margin-top:20px;">Full Rubric Definition</h2>' +
      '<div style="overflow-x:auto;">' +
      '<table>' +
        '<tr><th>Criterion</th><th>Wt</th><th>4 Exemplary</th><th>3 Strong</th><th>2 Adequate</th><th>1 Weak</th><th>0 Missing</th></tr>' +
        rubricTableRows +
      '</table></div>' +

      '<h2 style="color:#1B365D;font-size:16px;border-bottom:1px solid #C4A35A;padding-bottom:4px;margin-top:20px;">Scores &amp; Commentary</h2>' +
      scoresHtml +

      '<h2 style="color:#1B365D;font-size:16px;border-bottom:1px solid #C4A35A;padding-bottom:4px;margin-top:20px;">Improvement Suggestions</h2>' +
      improvementsHtml +

      '<h2 style="color:#1B365D;font-size:16px;border-bottom:1px solid #C4A35A;padding-bottom:4px;margin-top:20px;">Guardrail Violations</h2>' +
      guardrailsHtml +

      '<h2 style="color:#1B365D;font-size:16px;border-bottom:1px solid #C4A35A;padding-bottom:4px;margin-top:20px;">Final Score</h2>' +
      '<div style="text-align:center;padding:16px;border:2px solid ' + passColor + ';border-radius:12px;margin:8px 0;">' +
        '<div style="font-size:36px;font-weight:700;color:' + passColor + ';">' + scorePct.toFixed(1) + '%</div>' +
        '<div style="font-size:18px;font-weight:700;color:' + passColor + ';">' + passLabel + '</div>' +
      '</div>' +
      breakdownHtml +

      '<div style="text-align:center;border-top:3px solid #1B365D;padding-top:12px;margin-top:32px;font-size:11px;color:#888;">' +
        '<p style="margin:0;">\u00A92026 G. Bradley Scheller \u00B7 Scheller\'s Superior Human-in-the-Loop (S.H.I.T.) Evaluation Framework\u2122</p>' +
      '</div>' +

      '<div class="no-print" style="text-align:center;margin-top:16px;">' +
        '<button onclick="window.print()" style="background:#1B365D;color:white;border:none;padding:10px 24px;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600;">Print Report</button>' +
      '</div>' +

      '</body></html>';

    // Use Blob URL for safe rendering (avoids document.write)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  function closeDetailModal() {
    document.getElementById('evaluation-detail-modal').classList.add('hidden');
  }

  // ===== Export CSV =====

  function exportCSV() {
    const rubricId = document.getElementById('dashboard-rubric-select').value;
    let evals = Store.getEvaluations();
    if (rubricId) evals = evals.filter(e => e.rubricId === rubricId);

    if (evals.length === 0) {
      App.toast('No evaluations to export.', 'warning');
      return;
    }

    // Build CSV
    const headers = ['Presenter', 'Title', 'Evaluator', 'Rubric', 'Raw Score', 'Max Score', 'Percentage', 'Penalties', 'Final Score', 'Threshold', 'Result', 'Hard Fail', 'Date'];

    // Add per-criterion columns
    const rubric = rubricId ? Store.getRubric(rubricId) : null;
    if (rubric) {
      rubric.criteria.forEach(c => headers.push(c.name));
    }

    const rows = evals.map(ev => {
      const row = [
        ev.presenter || '',
        ev.title || '',
        ev.evaluator || '',
        ev.rubricName || '',
        ev.result ? ev.result.rawScore : '',
        ev.result ? ev.result.maxScore : '',
        ev.result ? ev.result.percentage.toFixed(1) : '',
        ev.result ? ev.result.penaltyTotal : '',
        ev.result ? ev.result.finalPercentage.toFixed(1) : '',
        ev.result ? ev.result.threshold : '',
        ev.result ? (ev.result.passed ? 'PASS' : 'FAIL') : '',
        ev.result ? (ev.result.hardFail ? 'YES' : 'NO') : '',
        ev.date ? new Date(ev.date).toLocaleString() : ''
      ];
      if (rubric) {
        rubric.criteria.forEach((c, idx) => {
          row.push(ev.scores && ev.scores[idx] !== undefined ? ev.scores[idx] : '');
        });
      }
      return row;
    });

    const csvContent = [headers, ...rows].map(row =>
      row.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rubriciq-evaluations-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    App.toast('Evaluations exported as CSV!', 'success');
  }

  // ===== Clear All =====

  function clearAllEvaluations() {
    const rubricId = document.getElementById('dashboard-rubric-select').value;
    const msg = rubricId
      ? 'Delete all evaluations for this rubric? This cannot be undone.'
      : 'Delete ALL evaluations across ALL rubrics? This cannot be undone.';

    if (!confirm(msg)) return;

    Store.deleteAllEvaluations(rubricId || null);
    refresh();
    App.toast('Evaluations cleared.', 'success');
  }

  // ===== Public API =====
  return {
    init,
    refresh,
    refreshRubricSelect,
    generateReport
  };
})();
