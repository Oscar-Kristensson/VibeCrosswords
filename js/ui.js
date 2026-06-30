/**
 * ui.js – wires up toolbar buttons, modals (design settings, export, confirm),
 * toast notifications, and design-settings <-> State synchronisation.
 */
'use strict';

const UI = (() => {

  // ── Toast ────────────────────────────────────────────────────────────────
  const toastEl = document.getElementById('toast');
  let toastTimer = null;

  function showToast(msg, duration = 2200) {
    clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden', 'fade-out');
    toastTimer = setTimeout(() => {
      toastEl.classList.add('fade-out');
      setTimeout(() => toastEl.classList.add('hidden'), 400);
    }, duration);
  }

  // ── Generic modal helpers ───────────────────────────────────────────────
  function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
  function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

  function wireModalCloseButtons() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.querySelectorAll('.modal-close, .modal-backdrop').forEach(el => {
        el.addEventListener('click', () => modal.classList.add('hidden'));
      });
    });
  }

  // ── Confirm dialog (returns a Promise<boolean>) ────────────────────────
  function confirmDialog(title, message) {
    return new Promise((resolve) => {
      document.getElementById('confirm-title').textContent = title;
      document.getElementById('confirm-message').textContent = message;
      openModal('modal-confirm');

      const okBtn = document.getElementById('confirm-ok');
      const modal = document.getElementById('modal-confirm');

      function cleanup(result) {
        okBtn.removeEventListener('click', onOk);
        modal.querySelectorAll('.modal-close, .modal-backdrop').forEach(el =>
          el.removeEventListener('click', onCancel));
        closeModal('modal-confirm');
        resolve(result);
      }
      function onOk() { cleanup(true); }
      function onCancel() { cleanup(false); }

      okBtn.addEventListener('click', onOk);
      modal.querySelectorAll('.modal-close, .modal-backdrop').forEach(el =>
        el.addEventListener('click', onCancel));
    });
  }

  // ── Design settings modal ───────────────────────────────────────────────
  function initDesignModal() {
    const fields = {
      hintFontSize:   document.getElementById('cfg-hint-size'),
      letterFontSize: document.getElementById('cfg-letter-size'),
      fontFamily:     document.getElementById('cfg-font'),
      blockedColor:   document.getElementById('cfg-blocked-color'),
      hintBg:         document.getElementById('cfg-hint-bg'),
      hintColor:      document.getElementById('cfg-hint-color'),
      lineColor:      document.getElementById('cfg-line-color'),
      letterColor:    document.getElementById('cfg-letter-color'),
    };

    function syncFieldsFromState() {
      const s = State.settings;
      fields.hintFontSize.value   = s.hintFontSize;
      fields.letterFontSize.value = s.letterFontSize;
      fields.fontFamily.value     = s.fontFamily;
      fields.blockedColor.value   = s.blockedColor;
      fields.hintBg.value         = s.hintBg;
      fields.hintColor.value      = s.hintColor;
      fields.lineColor.value      = s.lineColor;
      fields.letterColor.value    = s.letterColor;
      document.getElementById('cfg-width').value  = State.width;
      document.getElementById('cfg-height').value = State.height;
    }

    Object.entries(fields).forEach(([key, el]) => {
      el.addEventListener('input', () => {
        const val = el.type === 'number' ? parseFloat(el.value) : el.value;
        State.settings[key] = val;
        Grid.render();
      });
    });

    document.getElementById('btn-design').addEventListener('click', () => {
      syncFieldsFromState();
      openModal('modal-design');
    });

    document.getElementById('btn-apply-size').addEventListener('click', async () => {
      const newW = Math.max(3, Math.min(30, parseInt(document.getElementById('cfg-width').value, 10) || 12));
      const newH = Math.max(3, Math.min(30, parseInt(document.getElementById('cfg-height').value, 10) || 12));

      if (newW === State.width && newH === State.height) {
        showToast('Dimensions unchanged');
        return;
      }

      const ok = await confirmDialog(
        'Resize grid?',
        `This will clear all words, hints, blocks and arrows, then create a new ${newW} × ${newH} grid. This cannot be undone.`
      );
      if (!ok) return;

      State.resetGrid(newW, newH);
      Grid.render();
      Words.renderList();
      closeModal('modal-design');
      showToast(`Grid resized to ${newW} × ${newH}`);
    });
  }

  // ── Export modal ─────────────────────────────────────────────────────────
  function initExportModal() {
    document.getElementById('btn-export').addEventListener('click', () => {
      openModal('modal-export');
    });

    document.getElementById('btn-do-export').addEventListener('click', () => {
      const includeAnswerKey = document.getElementById('cfg-answer-key').checked;
      const paper = document.getElementById('cfg-paper').value;
      const orientation = document.getElementById('cfg-orientation').value;

      try {
        PDFExport.exportPDF({ includeAnswerKey, paper, orientation });
        closeModal('modal-export');
        showToast('PDF exported');
      } catch (err) {
        console.error(err);
        showToast('Export failed — see console');
      }
    });
  }

  // ── Save / Load ──────────────────────────────────────────────────────────
  function initSaveLoad() {
    document.getElementById('btn-save').addEventListener('click', () => {
      Serialiser.save('crossword.json');
      showToast('Crossword saved');
    });

    document.getElementById('file-load').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const ok = await confirmDialog(
        'Load crossword?',
        `Loading "${file.name}" will replace your current crossword. Continue?`
      );
      if (!ok) { e.target.value = ''; return; }

      Serialiser.load(file, (success, err) => {
        if (success) {
          Grid.render();
          Words.renderList();
          showToast('Crossword loaded');
        } else {
          showToast('Failed to load file');
        }
        e.target.value = '';
      });
    });
  }

  // ── Add word button ──────────────────────────────────────────────────────
  function initAddWord() {
    document.getElementById('btn-add-word').addEventListener('click', () => {
      Words.addWord({ col: 0, row: 0, direction: 'across', word: '', hint: '' });
    });
  }

  // ── Hint cell double-click -> auto add word entry ────────────────────────
  function initHintDblClick() {
    Grid.setHintDblClickHandler((col, row) => {
      // If a word already starts exactly here, just focus it instead of duplicating.
      const existing = State.words.find(w => w.col === col && w.row === row);
      if (existing) {
        showToast('A word already starts here — edit it in the list');
        return;
      }
      Words.addWordAtCoordinate(col, row);
      showToast(`New word entry added at (${col + 1}, ${row + 1})`);
    });
  }

  function init() {
    wireModalCloseButtons();
    initDesignModal();
    initExportModal();
    initSaveLoad();
    initAddWord();
    initHintDblClick();
  }

  return { init, showToast, confirmDialog };
})();
