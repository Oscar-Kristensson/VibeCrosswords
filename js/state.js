/**
 * state.js – single source of truth for the crossword builder.
 * All modules read/write through this object.
 */
'use strict';

const State = (() => {
  const _state = {
    // Grid dimensions
    width: 12,
    height: 12,

    // Design settings
    settings: {
      hintFontSize:   9,
      letterFontSize: 18,
      fontFamily:     "'Helvetica Neue', sans-serif",
      blockedColor:   '#b0b0b0',
      hintBg:         '#fffbe6',
      hintColor:      '#222222',
      lineColor:      '#333333',
      letterColor:    '#1a1a2e',
    },

    /**
     * cells: sparse map keyed "col,row"
     * Values: { state: 'empty'|'blocked'|'hint'|'letter', hint?: string, letter?: string }
     * 'hint' and 'letter' states are derived from word entries – not set manually.
     */
    cells: {},

    /**
     * arrows: sparse map keyed "col,row"
     * Value: { anchor: 'TL'|'TR'|'BL'|'BR', direction: 'right'|'left'|'up'|'down' }
     * Max one arrow per cell.
     */
    arrows: {},

    /**
     * words: array of word entry objects
     * {
     *   id, direction: 'across'|'down',
     *   col, row,        // coordinate of the FIRST LETTER (not the hint)
     *   word, hint,
     *   hintSide: 'left'|'right'|'up'|'down'  // which side of the first letter the hint cell sits on
     * }
     */
    words: [],

    // Next word ID counter
    _nextId: 1,
  };

  // ── Accessors ───────────────────────────────────────────────────────────────

  function getCell(col, row) {
    return _state.cells[`${col},${row}`] || { state: 'empty' };
  }

  function setCell(col, row, data) {
    const key = `${col},${row}`;
    _state.cells[key] = { ...(_state.cells[key] || {}), ...data };
  }

  function clearCell(col, row) {
    delete _state.cells[`${col},${row}`];
  }

  function getArrow(col, row) {
    return _state.arrows[`${col},${row}`] || null;
  }

  function setArrow(col, row, arrow) {
    if (arrow) {
      _state.arrows[`${col},${row}`] = arrow;
    } else {
      delete _state.arrows[`${col},${row}`];
    }
  }

  function nextId() {
    return _state._nextId++;
  }

  // ── Grid manipulation ────────────────────────────────────────────────────────

  function resetGrid(width, height) {
    _state.width   = width;
    _state.height  = height;
    _state.cells   = {};
    _state.arrows  = {};
    _state.words   = [];
    _state._nextId = 1;
  }

  // ── Serialisation ────────────────────────────────────────────────────────────

  function toJSON() {
    return JSON.stringify({
      version:  3,
      width:    _state.width,
      height:   _state.height,
      settings: { ..._state.settings },
      cells:    { ..._state.cells },
      arrows:   { ..._state.arrows },
      words:    _state.words.map(w => ({ ...w })),
      _nextId:  _state._nextId,
    }, null, 2);
  }

  // Coordinate offset from the old hint position to the new first-letter
  // position, used only when migrating version <= 2 files.
  const LEGACY_FIRST_LETTER_OFFSET = {
    across: { dc: 1, dr: 0 },
    down:   { dc: 0, dr: 1 },
  };

  function fromJSON(json) {
    const d = typeof json === 'string' ? JSON.parse(json) : json;
    const version = d.version || 1;

    _state.width    = d.width    || 12;
    _state.height   = d.height   || 12;
    _state.settings = { ..._state.settings, ...(d.settings || {}) };
    _state.arrows   = d.arrows || {};
    _state.words    = (d.words  || []).map(w => ({ ...w }));
    _state._nextId  = d._nextId || (_state.words.length + 1);

    if (version <= 2) {
      // Old files stored the HINT position in col/row, with the first letter
      // immediately after it in the word's own direction (no hintSide concept
      // existed). Convert each word's col/row to the new first-letter
      // convention, and set hintSide to match the word's direction so the
      // hint lands back in the same spot it used to occupy.
      _state.words = _state.words.map(w => {
        const offset = LEGACY_FIRST_LETTER_OFFSET[w.direction] || LEGACY_FIRST_LETTER_OFFSET.across;
        return {
          ...w,
          col: w.col + offset.dc,
          row: w.row + offset.dr,
          hintSide: w.direction === 'across' ? 'left' : 'up',
        };
      });
      // Derived cells/arrows from the old format don't match the new model —
      // discard them; they'll be fully recomputed by Words.rebuildGridFromWords()
      // right after load (see ui.js load handler).
      _state.cells = {};
    } else {
      _state.cells = d.cells || {};
    }
  }

  // Public API
  return {
    get width()    { return _state.width; },
    get height()   { return _state.height; },
    get settings() { return _state.settings; },
    get cells()    { return _state.cells; },
    get arrows()   { return _state.arrows; },
    get words()    { return _state.words; },

    getCell, setCell, clearCell,
    getArrow, setArrow,
    nextId,
    resetGrid,
    toJSON, fromJSON,
  };
})();
