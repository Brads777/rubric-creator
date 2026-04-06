# RubricIQ

**Scheller's Superior Human-in-the-Loop (S.H.I.T.)™ Evaluation Framework**

A rubric creation and peer evaluation web app for academic presentations. Create rubrics using the S.H.I.T. Loop scoring methodology, then use them to evaluate presentations.

## Features

- **Rubric Builder** -- Create custom rubrics with weighted criteria, 5-level descriptions (0-4), hard guardrails (instant fail), and soft guardrails (penalty deductions)
- **Scorer** -- Evaluate presentations in real time with running score calculation, PASS/FAIL verdict, and evidence notes
- **Dashboard** -- View all evaluations, sort by any column, see presenter averages, and export to CSV

## Scoring System (S.H.I.T. Loop)

```
Score = SUM(score_i x weight_i) / SUM(4 x weight_i) x 100%
```

- Each criterion is scored 0-4 (Missing, Weak, Adequate, Strong, Exemplary)
- Each criterion has a weight (1-5)
- Hard guardrails: any violation = automatic fail regardless of score
- Soft guardrails: penalty percentage deducted from final score
- Configurable pass threshold (default: 96%)

## Quick Start

1. Open `index.html` in any modern browser
2. The example "Presentation Evaluation" rubric loads automatically on first visit
3. Use the three tabs: Builder, Scorer, Dashboard

No build tools, no server, no dependencies beyond Tailwind CDN.

## Deployment

### GitHub Pages

1. Push this folder to a GitHub repository
2. Go to Settings > Pages
3. Set source to `main` branch, root folder
4. Your app is live at `https://username.github.io/rubric-creator/`

### Any Static Host

Upload all files maintaining the folder structure. Works on Netlify, Vercel, or any web server.

## Data Storage

All data is stored in the browser's localStorage under these keys:
- `rubriciq_rubrics` -- saved rubric definitions
- `rubriciq_evaluations` -- submitted evaluations

No data leaves the browser. No server required.

## File Structure

```
rubric-creator/
  index.html          -- Main app (all HTML structure)
  css/style.css       -- Custom styles beyond Tailwind
  js/store.js         -- localStorage CRUD for rubrics and evaluations
  js/rubric-builder.js -- Rubric creation logic and UI
  js/scorer.js        -- Scoring interface logic
  js/dashboard.js     -- Results dashboard logic
  js/app.js           -- Navigation, initialization
  README.md           -- This file
  .gitignore          -- Standard web gitignore
```

## Keyboard Shortcuts

- `Ctrl+1` -- Switch to Builder tab
- `Ctrl+2` -- Switch to Scorer tab
- `Ctrl+3` -- Switch to Dashboard tab
- `Escape` -- Close detail modal

## Legal

Scheller's Superior Human-in-the-Loop (S.H.I.T.)™ is a trademark of G. Bradley Scheller.
©2026 G. Bradley Scheller. All rights reserved. Patent pending.

The S.H.I.T. Loop evaluation methodology, scoring system, and rubric framework are the intellectual property of G. Bradley Scheller.
