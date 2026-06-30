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
      hintBg:         '#d4d4d4',
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
     * { id, direction: 'across'|'down', col, row, word, hint }
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
      version:  2,
      width:    _state.width,
      height:   _state.height,
      settings: { ..._state.settings },
      cells:    { ..._state.cells },
      arrows:   { ..._state.arrows },
      words:    _state.words.map(w => ({ ...w })),
      _nextId:  _state._nextId,
    }, null, 2);
  }

  function fromJSON(json) {
    const d = typeof json === 'string' ? JSON.parse(json) : json;
    _state.width    = d.width    || 12;
    _state.height   = d.height   || 12;
    _state.settings = { ..._state.settings, ...(d.settings || {}) };
    _state.cells    = d.cells  || {};
    _state.arrows   = d.arrows || {};
    _state.words    = (d.words  || []).map(w => ({ ...w }));
    _state._nextId  = d._nextId || (_state.words.length + 1);
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
