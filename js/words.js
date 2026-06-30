/**
 * words.js – manages the word list panel, places words onto the grid,
 * detects letter conflicts, and derives 'hint'/'letter' cell states.
 */
'use strict';

const Words = (() => {
  const listEl = document.getElementById('word-list');

  function addWord(partial = {}) {
    const direction = partial.direction || 'across';
    const word = {
      id: State.nextId(),
      direction,
      col: partial.col ?? 0,
      row: partial.row ?? 0,
      word: partial.word || '',
      hint: partial.hint || '',
      hintSide: partial.hintSide || defaultHintSide(direction),
    };
    State.words.push(word);
    rebuildGridFromWords();
    renderList();
    return word;
  }

  function removeWord(id) {
    const idx = State.words.findIndex(w => w.id === id);
    if (idx !== -1) State.words.splice(idx, 1);
    rebuildGridFromWords();
    renderList();
  }

  function updateWord(id, field, value) {
    const w = State.words.find(w => w.id === id);
    if (!w) return;
    if (field === 'col' || field === 'row') {
      value = Math.max(0, parseInt(value, 10) || 0);
    } else if (field === 'word') {
      value = value.toUpperCase().replace(/[^A-ZÅÄÖÆØ]/gi, '');
    }
    w[field] = value;
    rebuildGridFromWords(); // updates the board live
    refreshConflictHighlighting(); // patch row styling without rebuilding inputs
  }

  // Maps a hintSide to the coordinate offset of the hint cell relative to the first letter.
  const HINT_OFFSET = {
    left:  { dc: -1, dr: 0 },
    right: { dc: 1,  dr: 0 },
    up:    { dc: 0,  dr: -1 },
    down:  { dc: 0,  dr: 1 },
  };

  // Maps a hintSide -> which corner of the first-letter cell the arrow sits in.
  // The arrow sits in the corner facing the hint (i.e. the side the hint is on).
  const HINT_SIDE_TO_ANCHOR = {
    left:  'TL', // hint is to the left -> arrow in top-left corner
    right: 'TR',
    up:    'TL',
    down:  'BL',
  };

  function defaultHintSide(direction) {
    return direction === 'across' ? 'left' : 'up';
  }

  /**
   * Wipes all derived 'hint'/'letter' cells and auto-placed arrows, then
   * replays every word entry onto the grid.
   * - w.col / w.row is the coordinate of the FIRST LETTER.
   * - The hint cell is placed one cell away, on the side given by w.hintSide.
   * - A corner arrow is auto-placed on the first-letter cell, pointing in the
   *   word's reading direction, anchored to the corner that faces the hint.
   * Manually-set 'blocked' cells are preserved unless a word needs that cell.
   */
  function rebuildGridFromWords() {
    // 1. Strip all derived states, keep blocked/empty cells as-is.
    for (const key of Object.keys(State.cells)) {
      const cell = State.cells[key];
      if (cell.state === 'hint' || cell.state === 'letter') {
        delete State.cells[key];
      }
    }

    // 1b. Clear previously auto-placed arrows (tracked separately from manual ones).
    for (const key of Object.keys(State.arrows)) {
      if (State.arrows[key]._auto) {
        delete State.arrows[key];
      }
    }

    // 2. Place each word's hint cell, letter cells, and auto arrow.
    for (const w of State.words) {
      if (!w.word) continue;
      const dx = w.direction === 'across' ? 1 : 0;
      const dy = w.direction === 'down'   ? 1 : 0;
      const hintSide = w.hintSide || defaultHintSide(w.direction);
      const offset = HINT_OFFSET[hintSide] || HINT_OFFSET[defaultHintSide(w.direction)];

      // Hint cell sits one cell away from the first letter, on the chosen side.
      const hintCol = w.col + offset.dc;
      const hintRow = w.row + offset.dr;
      if (hintCol >= 0 && hintCol < State.width && hintRow >= 0 && hintRow < State.height) {
        State.setCell(hintCol, hintRow, { state: 'hint', hint: w.hint || '' });
      }

      // Letter cells, starting at the word's own coordinate.
      for (let i = 0; i < w.word.length; i++) {
        const c = w.col + dx * i;
        const r = w.row + dy * i;
        if (c < 0 || c >= State.width || r < 0 || r >= State.height) continue;
        const letter = w.word[i];
        State.setCell(c, r, { state: 'letter', letter });
      }

      // Auto arrow on the first-letter cell, pointing in the word's direction,
      // anchored to the corner facing the hint. Skipped if a manual arrow
      // already occupies that cell (manual placement takes precedence).
      const arrowKey = `${w.col},${w.row}`;
      const manualArrow = State.arrows[arrowKey] && !State.arrows[arrowKey]._auto;
      if (!manualArrow) {
        const anchor = HINT_SIDE_TO_ANCHOR[hintSide] || 'TL';
        State.setArrow(w.col, w.row, { anchor, direction: w.direction === 'across' ? 'right' : 'down', _auto: true });
      }
    }

    detectConflicts();
    Grid.render(); // always redraw the whole grid to reflect the new state
  }

  /**
   * Marks cells with `_conflict: true` if two different letters were
   * written to the same coordinate by different words. Also flags the
   * offending word-list rows.
   */
  function detectConflicts() {
    // Clear old flags
    for (const key of Object.keys(State.cells)) {
      delete State.cells[key]._conflict;
    }
    const conflictWordIds = new Set();

    // Build a map of coordinate -> [{wordId, letter}]
    const coordMap = {};
    for (const w of State.words) {
      if (!w.word) continue;
      const dx = w.direction === 'across' ? 1 : 0;
      const dy = w.direction === 'down'   ? 1 : 0;
      for (let i = 0; i < w.word.length; i++) {
        const c = w.col + dx * i;
        const r = w.row + dy * i;
        const key = `${c},${r}`;
        (coordMap[key] = coordMap[key] || []).push({ wordId: w.id, letter: w.word[i] });
      }
    }

    for (const key of Object.keys(coordMap)) {
      const entries = coordMap[key];
      const letters = new Set(entries.map(e => e.letter));
      if (letters.size > 1) {
        if (State.cells[key]) State.cells[key]._conflict = true;
        entries.forEach(e => conflictWordIds.add(e.wordId));
      }
    }

    _lastConflictIds = conflictWordIds;
    return conflictWordIds;
  }

  let _lastConflictIds = new Set();

  function renderList() {
    listEl.innerHTML = '';
    for (const w of State.words) {
      listEl.appendChild(renderRow(w));
    }
  }

  function renderRow(w) {
    const row = document.createElement('div');
    row.className = 'word-entry';
    row.dataset.wordId = w.id;
    if (_lastConflictIds.has(w.id)) row.classList.add('has-conflict');

    // Direction select
    const dirCell = document.createElement('div');
    dirCell.className = 'we-dir';
    const dirSelect = document.createElement('select');
    dirSelect.innerHTML = `<option value="across">→ Across</option><option value="down">↓ Down</option>`;
    dirSelect.value = w.direction;
    dirSelect.addEventListener('change', () => {
      updateWord(w.id, 'direction', dirSelect.value);
      // If hintSide hasn't been customised away from the old default, refresh it
      // to a sensible default for the new direction; otherwise leave the user's choice.
      sideSelect.value = w.hintSide;
    });
    dirCell.appendChild(dirSelect);

    // Col input
    const colCell = document.createElement('div');
    colCell.className = 'we-col';
    const colInput = document.createElement('input');
    colInput.type = 'number';
    colInput.min = 0;
    colInput.value = w.col + 1; // display 1-indexed
    colInput.addEventListener('input', () => updateWord(w.id, 'col', colInput.value - 1));
    colCell.appendChild(colInput);

    // Row input
    const rowCell = document.createElement('div');
    rowCell.className = 'we-row';
    const rowInput = document.createElement('input');
    rowInput.type = 'number';
    rowInput.min = 0;
    rowInput.value = w.row + 1;
    rowInput.addEventListener('input', () => updateWord(w.id, 'row', rowInput.value - 1));
    rowCell.appendChild(rowInput);

    // Word input
    const wordCell = document.createElement('div');
    wordCell.className = 'we-word';
    const wordInput = document.createElement('input');
    wordInput.type = 'text';
    wordInput.placeholder = 'WORD';
    wordInput.value = w.word;
    wordInput.addEventListener('input', () => {
      const cursorPos = wordInput.selectionStart;
      const before = wordInput.value;
      updateWord(w.id, 'word', wordInput.value);
      // updateWord normalises (uppercase, strips invalid chars) — only rewrite
      // the input's value (and restore cursor) if normalisation changed it,
      // so we don't fight the user's typing on every keystroke.
      if (wordInput.value !== w.word) {
        const removedChars = before.length - w.word.length;
        wordInput.value = w.word;
        const newPos = Math.max(0, cursorPos - removedChars);
        wordInput.setSelectionRange(newPos, newPos);
      }
    });
    wordCell.appendChild(wordInput);

    // Hint input
    const hintCell = document.createElement('div');
    hintCell.className = 'we-hint';
    const hintInput = document.createElement('input');
    hintInput.type = 'text';
    hintInput.placeholder = 'Clue text';
    hintInput.value = w.hint;
    hintInput.addEventListener('input', () => updateWord(w.id, 'hint', hintInput.value));
    hintCell.appendChild(hintInput);

    // Hint side select — which side of the first letter the hint cell sits on.
    const sideCell = document.createElement('div');
    sideCell.className = 'we-side';
    const sideSelect = document.createElement('select');
    sideSelect.innerHTML = `
      <option value="left">← Left</option>
      <option value="right">→ Right</option>
      <option value="up">↑ Up</option>
      <option value="down">↓ Down</option>
    `;
    sideSelect.value = w.hintSide || defaultHintSide(w.direction);
    sideSelect.addEventListener('change', () => updateWord(w.id, 'hintSide', sideSelect.value));
    sideCell.appendChild(sideSelect);

    // Delete button
    const delCell = document.createElement('div');
    delCell.className = 'we-del';
    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑';
    delBtn.title = 'Remove word';
    delBtn.addEventListener('click', () => removeWord(w.id));
    delCell.appendChild(delBtn);

    row.append(dirCell, colCell, rowCell, wordCell, hintCell, sideCell, delCell);
    return row;
  }

  /**
   * Updates only the `.has-conflict` class on existing rows, without
   * touching any input elements — keeps focus intact while typing.
   */
  function refreshConflictHighlighting() {
    listEl.querySelectorAll('.word-entry').forEach(rowEl => {
      const id = Number(rowEl.dataset.wordId);
      rowEl.classList.toggle('has-conflict', _lastConflictIds.has(id));
    });
  }

  /**
   * Called from grid.js when an empty cell is double-clicked.
   * Creates a fresh word entry whose first letter starts at that coordinate.
   */
  function addWordAtCoordinate(col, row) {
    const w = addWord({ col, row, direction: 'across', word: '', hint: '' });
    // Focus the new row's word input for immediate typing
    requestAnimationFrame(() => {
      const rowEl = listEl.querySelector(`.word-entry[data-word-id="${w.id}"]`);
      if (rowEl) {
        const input = rowEl.querySelector('.we-word input');
        if (input) input.focus();
      }
    });
    return w;
  }

  return {
    addWord,
    removeWord,
    updateWord,
    renderList,
    rebuildGridFromWords,
    detectConflicts,
    refreshConflictHighlighting,
    addWordAtCoordinate,
  };
})();
