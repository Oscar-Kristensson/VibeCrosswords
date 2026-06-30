/**
 * main.js – bootstraps the application: initial grid render, sample puzzle,
 * wiring of modules, and viewport resize handling for the scaling grid.
 */
'use strict';

(function init() {
  // Seed a small example so the grid isn't empty on first load.
  // Demonstrates the "hint with a 90° bend" feature: the hint sits to the
  // left of the first letter, and the word then reads downward — exactly
  // like the classic Scandinavian-style crossword convention.
  State.resetGrid(18, 25);
  Words.addWord({ direction: 'down', col: 1, row: 0, word: 'ORD', hint: 'Vad du fyller i', hintSide: 'left' });
  Words.addWord({ direction: 'across', col: 3, row: 2, word: 'KRYSS', hint: 'Ord-pussel', hintSide: 'up' });

  Grid.render();
  Words.renderList();
  Arrows.init();
  UI.init();

  // Re-render grid (for scaling) on window resize.
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => Grid.render(), 80);
  });
})();
