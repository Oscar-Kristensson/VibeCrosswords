/**
 * arrows.js – handles "Arrow mode" toggle and the popover UI for placing
 * a single directional arrow (90-degree bends only, no diagonals) on a cell.
 * Max one arrow per cell.
 */
'use strict';

const Arrows = (() => {
  const popover     = document.getElementById('arrow-popover');
  const btnPlace     = document.getElementById('ap-place');
  const btnClear     = document.getElementById('ap-clear');
  const btnCancel    = document.getElementById('ap-cancel');
  const btnToggle    = document.getElementById('btn-arrow-mode');

  let active = false;
  let targetCol = null;
  let targetRow = null;

  function toggle() {
    active = !active;
    btnToggle.classList.toggle('active', active);
    Grid.setArrowMode(active);
    hidePopover();
  }

  function openPopoverFor(col, row, clientX, clientY) {
    targetCol = col;
    targetRow = row;

    // Pre-fill radio state with existing arrow (if any)
    const existing = State.getArrow(col, row);
    const anchor = existing ? existing.anchor : 'TL';
    const direction = existing ? existing.direction : 'right';

    popover.querySelectorAll('input[name="ap-anchor"]').forEach(r => {
      r.checked = (r.value === anchor);
    });
    popover.querySelectorAll('input[name="ap-dir"]').forEach(r => {
      r.checked = (r.value === direction);
    });

    // Position popover near click, clamped to viewport
    const popW = 230, popH = 170;
    let x = clientX + 12;
    let y = clientY + 12;
    if (x + popW > window.innerWidth)  x = window.innerWidth  - popW - 12;
    if (y + popH > window.innerHeight) y = window.innerHeight - popH - 12;

    popover.style.left = x + 'px';
    popover.style.top  = y + 'px';
    popover.classList.remove('hidden');
  }

  function hidePopover() {
    popover.classList.add('hidden');
    targetCol = null;
    targetRow = null;
  }

  function place() {
    if (targetCol === null) return;
    const anchor = popover.querySelector('input[name="ap-anchor"]:checked').value;
    const direction = popover.querySelector('input[name="ap-dir"]:checked').value;
    State.setArrow(targetCol, targetRow, { anchor, direction });
    Grid.render();
    hidePopover();
  }

  function clear() {
    if (targetCol === null) return;
    State.setArrow(targetCol, targetRow, null);
    Grid.render();
    hidePopover();
  }

  function init() {
    btnToggle.addEventListener('click', toggle);
    btnPlace.addEventListener('click', place);
    btnClear.addEventListener('click', clear);
    btnCancel.addEventListener('click', hidePopover);

    // Close popover on outside click
    document.addEventListener('click', (e) => {
      if (!popover.classList.contains('hidden') &&
          !popover.contains(e.target) &&
          !e.target.closest('.cell')) {
        hidePopover();
      }
    });

    Grid.setArrowClickHandler(openPopoverFor);
  }

  function isActive() { return active; }

  return { init, isActive };
})();
