/**
 * main.js – bootstraps the application: initial grid render, sample puzzle,
 * wiring of modules, and viewport resize handling for the scaling grid.
 */
'use strict';

(function init() {
  // Seed a small example so the grid isn't empty on first load.
  State.resetGrid(12, 12);
  Words.addWord({ direction: 'across', col: 1, row: 1, word: 'KRYSS', hint: 'Ord-pussel' });
  Words.addWord({ direction: 'down',   col: 3, row: 0, word: 'ORD',   hint: 'Vad du fyller i' });
  State.setArrow(1, 1, { anchor: 'BR', direction: 'right' });

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
