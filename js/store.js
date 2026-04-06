/**
 * store.js — localStorage CRUD for rubrics and evaluations
 * RubricIQ - S.H.I.T. Evaluation Framework
 * ©2026 G. Bradley Scheller. All rights reserved.
 */

const Store = (() => {
  const RUBRICS_KEY = 'rubriciq_rubrics';
  const EVALUATIONS_KEY = 'rubriciq_evaluations';

  // ===== Helpers =====

  function _get(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error(`Store: Error reading ${key}`, e);
      return [];
    }
  }

  function _set(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error(`Store: Error writing ${key}`, e);
    }
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  }

  // ===== Rubric CRUD =====

  function getRubrics() {
    return _get(RUBRICS_KEY);
  }

  function getRubric(id) {
    return getRubrics().find(r => r.id === id) || null;
  }

  function saveRubric(rubric) {
    const rubrics = getRubrics();
    if (rubric.id) {
      // Update existing
      const idx = rubrics.findIndex(r => r.id === rubric.id);
      if (idx >= 0) {
        rubrics[idx] = { ...rubric, updatedAt: new Date().toISOString() };
      } else {
        rubrics.push({ ...rubric, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      }
    } else {
      // New rubric
      rubric.id = generateId();
      rubric.createdAt = new Date().toISOString();
      rubric.updatedAt = new Date().toISOString();
      rubrics.push(rubric);
    }
    _set(RUBRICS_KEY, rubrics);
    return rubric;
  }

  function deleteRubric(id) {
    const rubrics = getRubrics().filter(r => r.id !== id);
    _set(RUBRICS_KEY, rubrics);
    // Also delete associated evaluations
    const evals = getEvaluations().filter(e => e.rubricId !== id);
    _set(EVALUATIONS_KEY, evals);
  }

  function exportRubric(id) {
    const rubric = getRubric(id);
    if (!rubric) return null;
    // Strip internal IDs for clean export
    const exportData = { ...rubric };
    delete exportData.id;
    delete exportData.createdAt;
    delete exportData.updatedAt;
    return JSON.stringify(exportData, null, 2);
  }

  function importRubric(jsonStr) {
    try {
      const rubric = JSON.parse(jsonStr);
      if (!rubric.name || !rubric.criteria || !Array.isArray(rubric.criteria)) {
        throw new Error('Invalid rubric format: must have name and criteria array');
      }
      // Assign new ID
      rubric.id = generateId();
      rubric.createdAt = new Date().toISOString();
      rubric.updatedAt = new Date().toISOString();
      const rubrics = getRubrics();
      rubrics.push(rubric);
      _set(RUBRICS_KEY, rubrics);
      return rubric;
    } catch (e) {
      console.error('Import error:', e);
      return null;
    }
  }

  // ===== Evaluation CRUD =====

  function getEvaluations() {
    return _get(EVALUATIONS_KEY);
  }

  function getEvaluation(id) {
    return getEvaluations().find(e => e.id === id) || null;
  }

  function getEvaluationsForRubric(rubricId) {
    return getEvaluations().filter(e => e.rubricId === rubricId);
  }

  function saveEvaluation(evaluation) {
    const evals = getEvaluations();
    evaluation.id = generateId();
    evaluation.date = new Date().toISOString();
    evals.push(evaluation);
    _set(EVALUATIONS_KEY, evals);
    return evaluation;
  }

  function deleteAllEvaluations(rubricId) {
    let evals = getEvaluations();
    if (rubricId) {
      evals = evals.filter(e => e.rubricId !== rubricId);
    } else {
      evals = [];
    }
    _set(EVALUATIONS_KEY, evals);
  }

  // ===== Score Calculation =====

  /**
   * Calculate S.H.I.T. Loop score
   * @param {Object} rubric - The rubric object
   * @param {Object} scores - { criterionIndex: scoreValue (0-4) }
   * @param {Array} hardViolations - array of indices of violated hard guardrails
   * @param {Array} softViolations - array of indices of violated soft guardrails
   * @returns {Object} { rawScore, maxScore, percentage, penaltyTotal, finalPercentage, passed, hardFail }
   */
  function calculateScore(rubric, scores, hardViolations = [], softViolations = []) {
    let rawScore = 0;
    let maxScore = 0;

    rubric.criteria.forEach((criterion, i) => {
      const weight = criterion.weight || 1;
      const score = scores[i] !== undefined ? scores[i] : 0;
      rawScore += score * weight;
      maxScore += 4 * weight;
    });

    const percentage = maxScore > 0 ? (rawScore / maxScore) * 100 : 0;

    // Calculate soft guardrail penalties
    let penaltyTotal = 0;
    if (rubric.softGuardrails && rubric.softGuardrails.length > 0) {
      softViolations.forEach(idx => {
        if (rubric.softGuardrails[idx]) {
          penaltyTotal += rubric.softGuardrails[idx].penalty || 0;
        }
      });
    }

    const finalPercentage = Math.max(0, percentage - penaltyTotal);
    const hardFail = hardViolations.length > 0;
    const threshold = rubric.threshold || 96;
    const passed = !hardFail && finalPercentage >= threshold;

    return {
      rawScore,
      maxScore,
      percentage: Math.round(percentage * 100) / 100,
      penaltyTotal,
      finalPercentage: Math.round(finalPercentage * 100) / 100,
      passed,
      hardFail,
      threshold
    };
  }

  // ===== Example Rubric =====

  function getExampleRubric() {
    return {
      name: 'Presentation Evaluation',
      description: 'Comprehensive rubric for evaluating student presentations in an academic setting. Uses the S.H.I.T. Loop scoring methodology.',
      domain: 'Academic',
      threshold: 96,
      criteria: [
        {
          name: 'Content Quality & Depth',
          weight: 5,
          levels: [
            'No content presented or completely off-topic.',
            'Superficial content with significant inaccuracies; lacks research.',
            'Covers the topic adequately with some research; few errors.',
            'Well-researched content with good depth; demonstrates clear understanding.',
            'Exceptional research quality; original insights; masterful command of the subject matter.'
          ]
        },
        {
          name: 'Organization & Structure',
          weight: 4,
          levels: [
            'No discernible structure; random collection of ideas.',
            'Weak structure; missing intro or conclusion; poor transitions.',
            'Basic structure present with intro, body, and conclusion; some transitions.',
            'Clear logical flow; effective transitions; well-defined sections.',
            'Masterful organization; seamless transitions; compelling narrative arc.'
          ]
        },
        {
          name: 'Visual Design & Slides',
          weight: 4,
          levels: [
            'No slides or visual aids.',
            'Cluttered slides; walls of text; poor color/font choices; distracting.',
            'Readable slides with basic formatting; some visual hierarchy.',
            'Clean, professional slides; good use of visuals; supports the narrative.',
            'Outstanding visual design; perfect balance of text and graphics; enhances understanding significantly.'
          ]
        },
        {
          name: 'Delivery & Speaking',
          weight: 5,
          levels: [
            'Did not speak or mumbled inaudibly.',
            'Read directly from notes/slides; monotone; poor eye contact.',
            'Mostly clear delivery; occasional eye contact; some notes dependency.',
            'Confident delivery; good projection and pace; natural eye contact.',
            'Captivating speaker; dynamic vocal variety; commanding presence; fully engaged with audience.'
          ]
        },
        {
          name: 'Audience Engagement',
          weight: 3,
          levels: [
            'No attempt to engage the audience.',
            'Minimal engagement; lost audience attention early.',
            'Some audience interaction; maintained basic attention.',
            'Good engagement techniques; audience clearly interested.',
            'Exceptional audience rapport; interactive elements; audience fully invested throughout.'
          ]
        },
        {
          name: 'Time Management',
          weight: 3,
          levels: [
            'Significantly over or under time (more than 50% off).',
            'Notably over or under time; pacing issues throughout.',
            'Close to time limit; minor pacing issues.',
            'Within time limit; well-paced; all sections got appropriate time.',
            'Perfect time management; every section precisely timed; smooth conclusion at the mark.'
          ]
        },
        {
          name: 'Q&A Handling',
          weight: 3,
          levels: [
            'Refused or unable to answer any questions.',
            'Struggled significantly with questions; defensive or dismissive.',
            'Answered basic questions; some uncertainty in complex areas.',
            'Handled questions confidently; acknowledged limitations honestly.',
            'Expert-level Q&A; turned questions into deeper discussion; graceful handling of challenges.'
          ]
        },
        {
          name: 'Professionalism',
          weight: 4,
          levels: [
            'Unprofessional behavior; disrespectful to audience.',
            'Multiple unprofessional elements (attire, language, preparation).',
            'Generally professional; minor lapses in preparation or presentation.',
            'Professional demeanor; well-prepared; respectful of audience time.',
            'Exemplary professionalism; polished presence; sets the standard for the class.'
          ]
        }
      ],
      hardGuardrails: [
        { name: 'No-show / Did not present', description: 'Student did not show up or refused to present.' },
        { name: 'Plagiarism detected', description: 'Presentation content was plagiarized from another source without attribution.' }
      ],
      softGuardrails: [
        { name: 'Exceeded time limit by >50%', description: 'Presentation ran more than 50% over the allotted time.', penalty: 5 },
        { name: 'Technical difficulties due to unpreparedness', description: 'Preventable technical issues caused significant delay (e.g., wrong file format, no backup).', penalty: 3 }
      ]
    };
  }

  // ===== Full Backup / Restore =====

  function exportAll() {
    return {
      rubrics: getRubrics(),
      evaluations: getEvaluations(),
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
  }

  function importAll(data) {
    let rubricsAdded = 0;
    let evalsAdded = 0;

    if (data.rubrics && Array.isArray(data.rubrics)) {
      const existing = getRubrics();
      const existingIds = new Set(existing.map(r => r.id));
      data.rubrics.forEach(r => {
        if (r.id && !existingIds.has(r.id)) {
          existing.push(r);
          rubricsAdded++;
        }
      });
      _set(RUBRICS_KEY, existing);
    }

    if (data.evaluations && Array.isArray(data.evaluations)) {
      const existing = getEvaluations();
      const existingIds = new Set(existing.map(e => e.id));
      data.evaluations.forEach(e => {
        if (e.id && !existingIds.has(e.id)) {
          existing.push(e);
          evalsAdded++;
        }
      });
      _set(EVALUATIONS_KEY, existing);
    }

    return { rubricsAdded, evalsAdded };
  }

  // ===== Check first visit =====
  function isFirstVisit() {
    return getRubrics().length === 0;
  }

  // ===== Public API =====
  return {
    getRubrics,
    getRubric,
    saveRubric,
    deleteRubric,
    exportRubric,
    importRubric,
    getEvaluations,
    getEvaluation,
    getEvaluationsForRubric,
    saveEvaluation,
    deleteAllEvaluations,
    calculateScore,
    getExampleRubric,
    exportAll,
    importAll,
    isFirstVisit,
    generateId
  };
})();
