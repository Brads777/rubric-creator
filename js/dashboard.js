/**
 * dashboard.js — Results dashboard logic with iteration progress tracking
 * RubricIQ - S.H.I.T. Evaluation Framework
 * ©2026 G. Bradley Scheller. All rights reserved.
 *
 * Security note: All user-provided strings are inserted via textContent
 * or createElement. No raw user input is placed into innerHTML.
 */

const Dashboard = (() => {
  let sortColumn = 'presenter';
  let sortDirection = 'asc';

  // ===== Brand Colors =====
  const COLORS = {
    navy: '#1B365D',
    gold: '#C4A35A',
    accent: '#489FC8',
    green: '#16a34a',
    red: '#dc2626',
    gray: '#9ca3af'
  };

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
    renderProgressTracker(evals);
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

    // Avg iterations to pass
    const presenterMap = groupByPresenter(evals);
    const presenters = Object.keys(presenterMap);
    let totalItersToPass = 0;
    let presentersWhoPassed = 0;

    presenters.forEach(name => {
      const group = presenterMap[name];
      const sorted = sortByIteration(group);
      // Find the first iteration that passed
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].result && sorted[i].result.passed) {
          totalItersToPass += (sorted[i].iteration || 1);
          presentersWhoPassed++;
          break;
        }
      }
    });

    const avgItersEl = document.getElementById('stat-avg-iters');
    if (presentersWhoPassed > 0) {
      avgItersEl.textContent = (totalItersToPass / presentersWhoPassed).toFixed(1);
    } else {
      avgItersEl.textContent = '--';
    }
  }

  // ===== Helper: Group by Presenter =====

  function groupByPresenter(evals) {
    const map = {};
    evals.forEach(e => {
      const name = e.presenter || 'Unknown';
      if (!map[name]) map[name] = [];
      map[name].push(e);
    });
    return map;
  }

  // ===== Helper: Sort by Iteration =====

  function sortByIteration(group) {
    return [...group].sort((a, b) => (a.iteration || 1) - (b.iteration || 1));
  }

  // ===== Helper: Trend indicator =====

  function getTrend(sorted) {
    if (sorted.length < 2) {
      if (sorted.length === 1 && sorted[0].result && sorted[0].result.passed) {
        return { symbol: '\u2713', label: 'Passed', color: COLORS.green };
      }
      return { symbol: '\u2192', label: 'Stable', color: COLORS.gray };
    }

    const lastPassed = sorted[sorted.length - 1].result && sorted[sorted.length - 1].result.passed;
    if (lastPassed) {
      return { symbol: '\u2713', label: 'Passed', color: COLORS.green };
    }

    const lastScore = sorted[sorted.length - 1].result ? sorted[sorted.length - 1].result.finalPercentage : 0;
    const prevScore = sorted[sorted.length - 2].result ? sorted[sorted.length - 2].result.finalPercentage : 0;

    if (lastScore > prevScore + 0.5) {
      return { symbol: '\u2191', label: 'Improving', color: COLORS.green };
    } else if (lastScore < prevScore - 0.5) {
      return { symbol: '\u2193', label: 'Declining', color: COLORS.red };
    }
    return { symbol: '\u2192', label: 'Stable', color: COLORS.gray };
  }

  // ===== Progress Tracker (replaces Presenter Averages) =====

  function renderProgressTracker(evals) {
    const section = document.getElementById('progress-tracker-section');
    const container = document.getElementById('progress-tracker-container');
    container.replaceChildren();

    const presenterMap = groupByPresenter(evals);
    const presenters = Object.keys(presenterMap).sort();

    if (presenters.length === 0) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');

    presenters.forEach(name => {
      const group = presenterMap[name];
      const sorted = sortByIteration(group);
      const trend = getTrend(sorted);
      const threshold = sorted[0].result ? sorted[0].result.threshold : 96;

      // Presenter block
      const block = createElement('div', { className: 'border border-gray-200 rounded-lg p-4' });

      // Header row: name + trend
      const header = createElement('div', { className: 'flex items-center justify-between mb-3' });
      const nameEl = createElement('h4', { className: 'text-sm font-bold text-navy' }, [name]);
      const trendEl = createElement('span', { className: 'text-sm font-bold' });
      trendEl.style.color = trend.color;
      trendEl.textContent = trend.symbol + ' ' + trend.label;
      header.appendChild(nameEl);
      header.appendChild(trendEl);
      block.appendChild(header);

      // SVG progress chart (only if there are iterations)
      if (sorted.length > 0) {
        const chartSvg = buildProgressChart(sorted, threshold);
        block.appendChild(chartSvg);
      }

      // Iteration table
      const table = createElement('table', { className: 'w-full text-xs mt-3' });
      const thead = createElement('thead');
      const headerRow = createElement('tr', { className: 'border-b border-gray-200' });
      ['Iter.', 'Date', 'Evaluator', 'Score', 'Result'].forEach(text => {
        const th = createElement('th', { className: 'text-left py-1.5 px-2 text-xs font-bold text-navy uppercase' }, [text]);
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = createElement('tbody');
      sorted.forEach((ev, i) => {
        const tr = createElement('tr', { className: 'border-b border-gray-50 hover:bg-gray-50 cursor-pointer' });
        tr.addEventListener('click', () => showDetail(ev));

        const iterTd = createElement('td', { className: 'py-1.5 px-2 font-semibold' }, [String(ev.iteration || 1)]);
        const dateStr = ev.date ? new Date(ev.date).toLocaleDateString() : '--';
        const dateTd = createElement('td', { className: 'py-1.5 px-2 text-gray-500' }, [dateStr]);
        const evalTd = createElement('td', { className: 'py-1.5 px-2' }, [ev.evaluator || '']);
        const scorePct = ev.result ? ev.result.finalPercentage : 0;
        const scoreColor = ev.result && ev.result.passed ? 'text-green-600' :
          scorePct >= threshold - 5 ? 'text-yellow-600' : 'text-red-600';

        // Show delta from previous iteration
        let deltaText = '';
        if (i > 0) {
          const prevPct = sorted[i - 1].result ? sorted[i - 1].result.finalPercentage : 0;
          const diff = scorePct - prevPct;
          if (diff > 0) deltaText = ' (+' + diff.toFixed(1) + '%)';
          else if (diff < 0) deltaText = ' (' + diff.toFixed(1) + '%)';
        }

        const scoreTd = createElement('td', { className: 'py-1.5 px-2 font-bold ' + scoreColor });
        scoreTd.textContent = scorePct.toFixed(1) + '%' + deltaText;

        const passed = ev.result && ev.result.passed;
        const resultTd = createElement('td', { className: 'py-1.5 px-2' });
        const badge = createElement('span', {
          className: 'inline-block px-2 py-0.5 rounded text-xs font-bold ' +
            (passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')
        }, [passed ? 'PASS' : 'FAIL']);
        resultTd.appendChild(badge);

        tr.appendChild(iterTd);
        tr.appendChild(dateTd);
        tr.appendChild(evalTd);
        tr.appendChild(scoreTd);
        tr.appendChild(resultTd);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      block.appendChild(table);

      container.appendChild(block);
    });
  }

  // ===== SVG Progress Chart =====

  function buildProgressChart(sorted, threshold) {
    const width = 400;
    const height = 200;
    const padding = { top: 20, right: 50, bottom: 30, left: 45 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const wrapper = createElement('div', { className: 'progress-chart-wrapper' });

    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', 'auto');
    svg.style.maxWidth = '500px';
    svg.style.display = 'block';

    // Background
    const bg = document.createElementNS(svgNs, 'rect');
    bg.setAttribute('x', '0');
    bg.setAttribute('y', '0');
    bg.setAttribute('width', String(width));
    bg.setAttribute('height', String(height));
    bg.setAttribute('fill', '#fafafa');
    bg.setAttribute('rx', '8');
    svg.appendChild(bg);

    // Determine X and Y ranges
    const iterations = sorted.map(e => e.iteration || 1);
    const minIter = Math.min(...iterations);
    const maxIter = Math.max(...iterations);
    const iterRange = maxIter === minIter ? 1 : maxIter - minIter;

    // Y: 0 to 100
    function xPos(iter) {
      if (sorted.length === 1) return padding.left + chartW / 2;
      return padding.left + ((iter - minIter) / iterRange) * chartW;
    }
    function yPos(pct) {
      return padding.top + chartH - (pct / 100) * chartH;
    }

    // Y axis gridlines and labels
    [0, 25, 50, 75, 100].forEach(pct => {
      const y = yPos(pct);
      const gridline = document.createElementNS(svgNs, 'line');
      gridline.setAttribute('x1', String(padding.left));
      gridline.setAttribute('y1', String(y));
      gridline.setAttribute('x2', String(width - padding.right));
      gridline.setAttribute('y2', String(y));
      gridline.setAttribute('stroke', '#e5e7eb');
      gridline.setAttribute('stroke-width', '1');
      svg.appendChild(gridline);

      const label = document.createElementNS(svgNs, 'text');
      label.setAttribute('x', String(padding.left - 6));
      label.setAttribute('y', String(y + 4));
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('font-size', '10');
      label.setAttribute('fill', COLORS.navy);
      label.textContent = pct + '%';
      svg.appendChild(label);
    });

    // X axis labels
    iterations.forEach(iter => {
      const x = xPos(iter);
      const label = document.createElementNS(svgNs, 'text');
      label.setAttribute('x', String(x));
      label.setAttribute('y', String(height - 6));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '10');
      label.setAttribute('fill', COLORS.navy);
      label.textContent = String(iter);
      svg.appendChild(label);
    });

    // X axis title
    const xTitle = document.createElementNS(svgNs, 'text');
    xTitle.setAttribute('x', String(padding.left + chartW / 2));
    xTitle.setAttribute('y', String(height - 0));
    xTitle.setAttribute('text-anchor', 'middle');
    xTitle.setAttribute('font-size', '9');
    xTitle.setAttribute('fill', COLORS.gray);
    xTitle.textContent = 'Iteration';
    svg.appendChild(xTitle);

    // Axes
    const xAxis = document.createElementNS(svgNs, 'line');
    xAxis.setAttribute('x1', String(padding.left));
    xAxis.setAttribute('y1', String(padding.top + chartH));
    xAxis.setAttribute('x2', String(width - padding.right));
    xAxis.setAttribute('y2', String(padding.top + chartH));
    xAxis.setAttribute('stroke', COLORS.navy);
    xAxis.setAttribute('stroke-width', '1.5');
    svg.appendChild(xAxis);

    const yAxis = document.createElementNS(svgNs, 'line');
    yAxis.setAttribute('x1', String(padding.left));
    yAxis.setAttribute('y1', String(padding.top));
    yAxis.setAttribute('x2', String(padding.left));
    yAxis.setAttribute('y2', String(padding.top + chartH));
    yAxis.setAttribute('stroke', COLORS.navy);
    yAxis.setAttribute('stroke-width', '1.5');
    svg.appendChild(yAxis);

    // Threshold line (dashed, gold)
    const threshY = yPos(threshold);
    const threshLine = document.createElementNS(svgNs, 'line');
    threshLine.setAttribute('x1', String(padding.left));
    threshLine.setAttribute('y1', String(threshY));
    threshLine.setAttribute('x2', String(width - padding.right));
    threshLine.setAttribute('y2', String(threshY));
    threshLine.setAttribute('stroke', COLORS.gold);
    threshLine.setAttribute('stroke-width', '2');
    threshLine.setAttribute('stroke-dasharray', '6,4');
    svg.appendChild(threshLine);

    // Threshold label
    const threshLabel = document.createElementNS(svgNs, 'text');
    threshLabel.setAttribute('x', String(width - padding.right + 4));
    threshLabel.setAttribute('y', String(threshY + 4));
    threshLabel.setAttribute('font-size', '9');
    threshLabel.setAttribute('fill', COLORS.gold);
    threshLabel.setAttribute('font-weight', 'bold');
    threshLabel.textContent = threshold + '%';
    svg.appendChild(threshLabel);

    // Progress line connecting dots
    if (sorted.length > 1) {
      const pathPoints = sorted.map(ev => {
        const pct = ev.result ? ev.result.finalPercentage : 0;
        return xPos(ev.iteration || 1) + ',' + yPos(pct);
      });
      const polyline = document.createElementNS(svgNs, 'polyline');
      polyline.setAttribute('points', pathPoints.join(' '));
      polyline.setAttribute('fill', 'none');
      polyline.setAttribute('stroke', COLORS.accent);
      polyline.setAttribute('stroke-width', '2.5');
      polyline.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(polyline);
    }

    // Dots and score labels
    sorted.forEach((ev, i) => {
      const pct = ev.result ? ev.result.finalPercentage : 0;
      const x = xPos(ev.iteration || 1);
      const y = yPos(pct);
      const passed = ev.result && ev.result.passed;

      // Determine dot color
      let dotColor;
      if (passed) {
        dotColor = COLORS.green;
      } else if (i > 0) {
        const prevPct = sorted[i - 1].result ? sorted[i - 1].result.finalPercentage : 0;
        dotColor = pct > prevPct ? COLORS.gold : COLORS.red;
      } else {
        dotColor = pct >= threshold ? COLORS.green : COLORS.red;
      }

      // Draw dot
      const circle = document.createElementNS(svgNs, 'circle');
      circle.setAttribute('cx', String(x));
      circle.setAttribute('cy', String(y));
      circle.setAttribute('r', '5');
      circle.setAttribute('fill', dotColor);
      circle.setAttribute('stroke', 'white');
      circle.setAttribute('stroke-width', '2');
      svg.appendChild(circle);

      // Score label next to dot
      const scoreLabel = document.createElementNS(svgNs, 'text');
      scoreLabel.setAttribute('x', String(x));
      scoreLabel.setAttribute('y', String(y - 10));
      scoreLabel.setAttribute('text-anchor', 'middle');
      scoreLabel.setAttribute('font-size', '9');
      scoreLabel.setAttribute('font-weight', 'bold');
      scoreLabel.setAttribute('fill', dotColor);
      scoreLabel.textContent = pct.toFixed(1) + '%';
      svg.appendChild(scoreLabel);
    });

    wrapper.appendChild(svg);
    return wrapper;
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

    // Sort: default by presenter then iteration
    const sorted = [...evals].sort((a, b) => {
      let aVal, bVal;
      switch (sortColumn) {
        case 'iteration': aVal = a.iteration || 1; bVal = b.iteration || 1; break;
        case 'presenter': aVal = a.presenter || ''; bVal = b.presenter || ''; break;
        case 'title': aVal = a.title || ''; bVal = b.title || ''; break;
        case 'evaluator': aVal = a.evaluator || ''; bVal = b.evaluator || ''; break;
        case 'score': aVal = a.result ? a.result.finalPercentage : 0; bVal = b.result ? b.result.finalPercentage : 0; break;
        case 'passfail': aVal = a.result && a.result.passed ? 1 : 0; bVal = b.result && b.result.passed ? 1 : 0; break;
        case 'date': aVal = a.date || ''; bVal = b.date || ''; break;
        default: aVal = a.presenter || ''; bVal = b.presenter || ''; break;
      }
      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal);
        if (cmp !== 0) return sortDirection === 'asc' ? cmp : -cmp;
        // Secondary sort by iteration
        return (a.iteration || 1) - (b.iteration || 1);
      }
      const diff = sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      if (diff !== 0) return diff;
      // Secondary sort by presenter name then iteration
      const nameCmp = (a.presenter || '').localeCompare(b.presenter || '');
      if (nameCmp !== 0) return nameCmp;
      return (a.iteration || 1) - (b.iteration || 1);
    });

    const table = createElement('table', { className: 'sortable-table w-full text-sm' });

    // Header
    const thead = createElement('thead');
    const headerRow = createElement('tr', { className: 'border-b-2 border-gray-200' });

    const columns = [
      { key: 'presenter', label: 'Presenter' },
      { key: 'iteration', label: 'Iter.' },
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
      const iterTd = createElement('td', { className: 'py-2 px-3 text-center font-mono text-xs' }, [String(ev.iteration || 1)]);
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
      tr.appendChild(iterTd);
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
      ['Iteration', '#' + (ev.iteration || 1)],
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

    // ===== vs. Previous Iteration Section =====
    const prevEval = findPreviousIteration(ev);
    if (prevEval) {
      content.appendChild(buildIterationComparison(ev, prevEval, rubric));
    }

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

  // ===== Find Previous Iteration =====

  function findPreviousIteration(ev) {
    const evals = Store.getEvaluationsForRubric(ev.rubricId);
    const samePresenter = evals.filter(
      e => (e.presenter || '').toLowerCase() === (ev.presenter || '').toLowerCase() &&
           e.id !== ev.id
    );
    const currentIter = ev.iteration || 1;
    // Find the evaluation with the highest iteration below current
    let best = null;
    samePresenter.forEach(e => {
      const iter = e.iteration || 1;
      if (iter < currentIter) {
        if (!best || iter > (best.iteration || 1)) {
          best = e;
        }
      }
    });
    return best;
  }

  // ===== Build Iteration Comparison =====

  function buildIterationComparison(current, previous, rubric) {
    const section = createElement('div', { className: 'mb-4 p-4 rounded-lg border-2 border-accent bg-blue-50' });

    const title = createElement('h4', { className: 'text-sm font-bold text-navy uppercase mb-3' },
      ['vs. Previous Iteration (#' + (previous.iteration || 1) + ' \u2192 #' + (current.iteration || 1) + ')']);
    section.appendChild(title);

    // Overall improvement
    const prevPct = previous.result ? previous.result.finalPercentage : 0;
    const currPct = current.result ? current.result.finalPercentage : 0;
    const diff = currPct - prevPct;
    const diffStr = diff > 0 ? '+' + diff.toFixed(1) : diff.toFixed(1);
    const diffColor = diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-500';

    const overallDiv = createElement('div', { className: 'text-sm mb-3 p-2 rounded bg-white' });
    const overallText = createElement('span', { className: 'font-semibold' },
      ['Overall: ' + prevPct.toFixed(1) + '% \u2192 ' + currPct.toFixed(1) + '% ']);
    const overallDiff = createElement('span', { className: 'font-bold ' + diffColor }, ['(' + diffStr + '%)']);
    overallDiv.appendChild(overallText);
    overallDiv.appendChild(overallDiff);
    section.appendChild(overallDiv);

    // Per-criterion comparison
    if (rubric && rubric.criteria) {
      rubric.criteria.forEach((criterion, idx) => {
        const prevScore = previous.scores && previous.scores[idx] !== undefined ? previous.scores[idx] : 0;
        const currScore = current.scores && current.scores[idx] !== undefined ? current.scores[idx] : 0;
        const scoreDiff = currScore - prevScore;

        let indicator, rowBg;
        if (scoreDiff > 0) {
          indicator = '\u2191';
          rowBg = 'bg-green-50';
        } else if (scoreDiff < 0) {
          indicator = '\u2193';
          rowBg = 'bg-red-50';
        } else {
          indicator = '\u2192';
          rowBg = 'bg-gray-50';
        }

        const row = createElement('div', { className: 'flex items-center justify-between py-1.5 px-2 rounded text-xs ' + rowBg });
        const nameSpan = createElement('span', { className: 'font-semibold flex-1' }, [criterion.name]);
        const changeSpan = createElement('span', { className: 'font-mono' },
          [prevScore + '/4 \u2192 ' + currScore + '/4 ' + indicator]);

        let changeColor;
        if (scoreDiff > 0) changeColor = COLORS.green;
        else if (scoreDiff < 0) changeColor = COLORS.red;
        else changeColor = COLORS.gray;
        changeSpan.style.color = changeColor;

        row.appendChild(nameSpan);
        row.appendChild(changeSpan);
        section.appendChild(row);
      });
    }

    return section;
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

    // Build iteration history for report
    let iterationHtml = '';
    const allEvals = Store.getEvaluationsForRubric(ev.rubricId).filter(
      e => (e.presenter || '').toLowerCase() === (ev.presenter || '').toLowerCase()
    );
    const sortedIters = [...allEvals].sort((a, b) => (a.iteration || 1) - (b.iteration || 1));
    if (sortedIters.length > 1) {
      iterationHtml += '<h2 style="color:#1B365D;font-size:16px;border-bottom:1px solid #C4A35A;padding-bottom:4px;margin-top:20px;">Iteration History</h2>';
      iterationHtml += '<table><tr><th style="padding:6px 8px;background:#1B365D;color:white;font-size:11px;">Iter.</th><th style="padding:6px 8px;background:#1B365D;color:white;font-size:11px;">Date</th><th style="padding:6px 8px;background:#1B365D;color:white;font-size:11px;">Evaluator</th><th style="padding:6px 8px;background:#1B365D;color:white;font-size:11px;">Score</th><th style="padding:6px 8px;background:#1B365D;color:white;font-size:11px;">Result</th></tr>';
      sortedIters.forEach(iterEv => {
        const iterPct = iterEv.result ? iterEv.result.finalPercentage : 0;
        const iterPassed = iterEv.result && iterEv.result.passed;
        const isCurrent = iterEv.id === ev.id;
        const bgStyle = isCurrent ? 'background:#e0f2fe;' : '';
        iterationHtml += '<tr style="' + bgStyle + '">';
        iterationHtml += '<td style="padding:4px 8px;border:1px solid #ddd;text-align:center;font-weight:600;">' + (iterEv.iteration || 1) + '</td>';
        iterationHtml += '<td style="padding:4px 8px;border:1px solid #ddd;">' + (iterEv.date ? new Date(iterEv.date).toLocaleDateString() : '--') + '</td>';
        iterationHtml += '<td style="padding:4px 8px;border:1px solid #ddd;">' + esc(iterEv.evaluator || '') + '</td>';
        iterationHtml += '<td style="padding:4px 8px;border:1px solid #ddd;font-weight:700;color:' + (iterPassed ? '#16a34a' : '#dc2626') + ';">' + iterPct.toFixed(1) + '%</td>';
        iterationHtml += '<td style="padding:4px 8px;border:1px solid #ddd;font-weight:700;color:' + (iterPassed ? '#16a34a' : '#dc2626') + ';">' + (iterPassed ? 'PASS' : 'FAIL') + '</td>';
        iterationHtml += '</tr>';
      });
      iterationHtml += '</table>';
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
      breakdownHtml += 'Iteration: #' + (ev.iteration || 1) + '<br>';
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
      '</tr><tr>' +
        '<td style="padding:4px 8px;border:1px solid #ddd;font-weight:600;background:#f9fafb;">Iteration</td>' +
        '<td style="padding:4px 8px;border:1px solid #ddd;">#' + (ev.iteration || 1) + '</td>' +
        '<td style="padding:4px 8px;border:1px solid #ddd;font-weight:600;background:#f9fafb;">&nbsp;</td>' +
        '<td style="padding:4px 8px;border:1px solid #ddd;">&nbsp;</td>' +
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

      iterationHtml +

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
    const headers = ['Presenter', 'Iteration', 'Title', 'Evaluator', 'Rubric', 'Raw Score', 'Max Score', 'Percentage', 'Penalties', 'Final Score', 'Threshold', 'Result', 'Hard Fail', 'Date'];

    // Add per-criterion columns
    const rubric = rubricId ? Store.getRubric(rubricId) : null;
    if (rubric) {
      rubric.criteria.forEach(c => headers.push(c.name));
    }

    const rows = evals.map(ev => {
      const row = [
        ev.presenter || '',
        ev.iteration || 1,
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
