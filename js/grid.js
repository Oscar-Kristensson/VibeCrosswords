/**
 * grid.js – renders the crossword grid and handles cell click interactions.
 * Cell state ('empty' | 'blocked' | 'hint' | 'letter') is derived:
 *   - 'hint' and 'letter' are set automatically by words.js based on word entries.
 *   - 'blocked' / 'empty' are toggled manually via right-click (cycle: empty <-> blocked).
 */
'use strict';

const Grid = (() => {
  const gridEl   = document.getElementById('crossword-grid');
  const colHdrEl = document.getElementById('grid-col-headers');
  const rowHdrEl = document.getElementById('grid-row-headers');

  // Fixed reference cell size (px) that the Design Settings font sizes are
  // calibrated against. The grid visually scales to fit the viewport, but
  // font sizes (hintFontSize/letterFontSize) are absolute px values relative
  // to THIS reference — not the actual rendered cell size — so exported
  // PDFs and on-screen rendering both derive font size the same way.
  const REFERENCE_CELL_PX = 56;

  let arrowModeActive = false;
  let onCellArrowClick = null; // callback(col,row,clientX,clientY) set by arrows.js
  let onHintCellDblClick = null; // callback(col,row) set by ui.js (auto-add word entry)

  function setArrowMode(active) {
    arrowModeActive = active;
    document.body.classList.toggle('arrow-mode', active);
  }

  function setArrowClickHandler(fn) { onCellArrowClick = fn; }
  function setHintDblClickHandler(fn) { onHintCellDblClick = fn; }

  function applyCssVars(cellSize) {
    const s = State.settings;
    const root = document.documentElement.style;
    const ratio = cellSize ? (cellSize / REFERENCE_CELL_PX) : 1;
    root.setProperty('--hint-size', (s.hintFontSize * ratio) + 'px');
    root.setProperty('--letter-size', (s.letterFontSize * ratio) + 'px');
    root.setProperty('--font-grid', s.fontFamily);
    root.setProperty('--c-blocked', s.blockedColor);
    root.setProperty('--c-hint-bg', s.hintBg);
    root.setProperty('--c-hint-text', s.hintColor);
    root.setProperty('--c-border', s.lineColor);
    root.setProperty('--c-letter', s.letterColor);
  }

  function render() {
    const w = State.width;
    const h = State.height;

    gridEl.style.gridTemplateColumns = `repeat(${w}, 1fr)`;
    gridEl.style.gridTemplateRows = `repeat(${h}, 1fr)`;

    // Scale the whole grid to fit available viewport while keeping square cells.
    const wrapperMaxW = document.querySelector('.grid-section').clientWidth - 60;
    const wrapperMaxH = document.querySelector('.grid-section').clientHeight - 60;
    const cellSize = Math.max(20, Math.min(wrapperMaxW / w, wrapperMaxH / h, REFERENCE_CELL_PX));
    applyCssVars(cellSize);
    gridEl.style.width  = (cellSize * w) + 'px';
    gridEl.style.height = (cellSize * h) + 'px';

    // Column headers
    colHdrEl.innerHTML = '';
    colHdrEl.style.width = (cellSize * w) + 'px';
    for (let c = 0; c < w; c++) {
      const div = document.createElement('div');
      div.className = 'gh-cell';
      div.style.width = cellSize + 'px';
      div.textContent = c + 1;
      colHdrEl.appendChild(div);
    }

    // Row headers
    rowHdrEl.innerHTML = '';
    rowHdrEl.style.height = (cellSize * h) + 'px';
    for (let r = 0; r < h; r++) {
      const div = document.createElement('div');
      div.className = 'gh-cell';
      div.style.height = cellSize + 'px';
      div.textContent = r + 1;
      rowHdrEl.appendChild(div);
    }

    // Cells
    gridEl.innerHTML = '';
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        gridEl.appendChild(renderCell(c, r));
      }
    }
  }

  function renderCell(col, row) {
    const data = State.getCell(col, row);
    const div = document.createElement('div');
    div.className = 'cell';
    div.dataset.col = col;
    div.dataset.row = row;

    if (data.state === 'blocked') {
      div.classList.add('blocked');
    } else if (data.state === 'hint') {
      div.classList.add('hint-cell');
      const hintSpan = document.createElement('div');
      hintSpan.className = 'cell-hint-text';
      hintSpan.textContent = data.hint || '';
      div.appendChild(hintSpan);
    } else if (data.state === 'letter') {
      const letterSpan = document.createElement('div');
      letterSpan.className = 'cell-letter';
      letterSpan.textContent = data.letter || '';
      div.appendChild(letterSpan);
    }

    // Arrow overlay
    const arrow = State.getArrow(col, row);
    if (arrow) {
      div.appendChild(renderArrowSVG(arrow));
    }

    // Conflict marker (set externally by Words.detectConflicts)
    if (data._conflict) {
      div.classList.add('conflict');
    }

    // ── Interactions ──────────────────────────────────────────────────────
    div.addEventListener('click', (e) => {
      if (arrowModeActive) {
        if (onCellArrowClick) onCellArrowClick(col, row, e.clientX, e.clientY);
        return;
      }
    });

    div.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (arrowModeActive) return;
      toggleBlocked(col, row);
    });

    div.addEventListener('dblclick', () => {
      if (arrowModeActive) return;
      const cur = State.getCell(col, row);
      if (cur.state === 'hint' && onHintCellDblClick) {
        onHintCellDblClick(col, row);
      }
    });

    return div;
  }

  function renderArrowSVG(arrow) {
    const wrap = document.createElement('div');
    wrap.className = `cell-arrow pos-${arrow.anchor}`;

    const size = 11;
    const rotations = { right: 0, down: 90, left: 180, up: 270 };
    const rot = rotations[arrow.direction] || 0;

    wrap.innerHTML = `
      <svg width="${size}" height="${size}" viewBox="0 0 16 16"
           style="transform: rotate(${rot}deg)">
        <polygon points="2,2 14,8 2,14" fill="var(--c-arrow, #1a1a2e)"></polygon>
      </svg>`;
    return wrap;
  }

  function toggleBlocked(col, row) {
    const cur = State.getCell(col, row);
    // Cannot block a cell that's part of a word (hint or letter state).
    if (cur.state === 'hint' || cur.state === 'letter') return;

    if (cur.state === 'blocked') {
      State.clearCell(col, row);
    } else {
      State.setCell(col, row, { state: 'blocked' });
    }
    render();
    Words.detectConflicts();
    Words.refreshConflictHighlighting();
  }

  return {
    render,
    setArrowMode,
    setArrowClickHandler,
    setHintDblClickHandler,
    renderArrowSVG,
    REFERENCE_CELL_PX,
  };
})();
