/**
 * pdf.js – exports the crossword to a PDF using jsPDF (vendored, no CDN).
 * Page 1: blank puzzle (hint cells show clue text, letter cells empty, blocked cells grey).
 * Page 2 (optional): answer key (letter cells filled in).
 * No row/column numbers or numbering of any kind are included (Scandinavian style).
 */
'use strict';

const PDFExport = (() => {

  function exportPDF({ includeAnswerKey, paper, orientation }) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation,
      unit: 'mm',
      format: paper,
    });

    drawPuzzlePage(doc, false);

    if (includeAnswerKey) {
      doc.addPage(paper, orientation);
      drawPuzzlePage(doc, true);
    }

    doc.save('crossword.pdf');
  }

  function drawPuzzlePage(doc, showAnswers) {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;

    const w = State.width;
    const h = State.height;

    const availW = pageW - margin * 2;
    const availH = pageH - margin * 2 - (showAnswers ? 10 : 0);
    const cell = Math.min(availW / w, availH / h);

    const gridW = cell * w;
    const gridH = cell * h;
    const startX = (pageW - gridW) / 2;
    const startY = margin + (showAnswers ? 10 : 0);

    if (showAnswers) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(20, 20, 30);
      doc.text('Answer key', pageW / 2, margin + 4, { align: 'center' });
    }

    const s = State.settings;
    const editorCellPx = Grid.REFERENCE_CELL_PX;
    const MM_PER_PX = 0.2645833; // 96dpi assumption, matches CSS px
    const cellPxEquivalent = cell / MM_PER_PX;
    const fontScaleRatio = cellPxEquivalent / editorCellPx;
    const blockedRGB = hexToRgb(s.blockedColor);
    const hintBgRGB  = hexToRgb(s.hintBg);
    const lineRGB    = hexToRgb(s.lineColor);
    const letterRGB  = hexToRgb(s.letterColor);
    const hintTxtRGB = hexToRgb(s.hintColor);

    // Draw cells
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const data = State.getCell(c, r);
        const x = startX + c * cell;
        const y = startY + r * cell;

        if (data.state === 'blocked') {
          doc.setFillColor(blockedRGB.r, blockedRGB.g, blockedRGB.b);
          doc.rect(x, y, cell, cell, 'F');
        } else if (data.state === 'hint') {
          doc.setFillColor(hintBgRGB.r, hintBgRGB.g, hintBgRGB.b);
          doc.rect(x, y, cell, cell, 'F');
        } else {
          doc.setFillColor(255, 255, 255);
          doc.rect(x, y, cell, cell, 'F');
        }

        // Border
        doc.setDrawColor(lineRGB.r, lineRGB.g, lineRGB.b);
        doc.setLineWidth(0.3);
        doc.rect(x, y, cell, cell, 'S');

        // Hint text — font size scaled to match the same cell-size ratio as the editor
        if (data.state === 'hint' && data.hint) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(pxToPt(s.hintFontSize * fontScaleRatio));
          doc.setTextColor(hintTxtRGB.r, hintTxtRGB.g, hintTxtRGB.b);
          const lines = doc.splitTextToSize(data.hint, cell - 1.5);
          const lineHeight = doc.getFontSize() * 0.352778 * 1.05;
          const totalH = lines.length * lineHeight;
          let ty = y + cell / 2 - totalH / 2 + lineHeight * 0.8;
          for (const line of lines.slice(0, Math.floor(cell / lineHeight))) {
            doc.text(line, x + cell / 2, ty, { align: 'center' });
            ty += lineHeight;
          }
        }

        // Letter — only shown on answer key page
        if (data.state === 'letter' && showAnswers && data.letter) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(pxToPt(s.letterFontSize * fontScaleRatio));
          doc.setTextColor(letterRGB.r, letterRGB.g, letterRGB.b);
          doc.text(data.letter, x + cell / 2, y + cell / 2 + cell * 0.14, { align: 'center' });
        }

        // Arrow
        const arrow = State.getArrow(c, r);
        if (arrow) {
          drawArrow(doc, x, y, cell, arrow, lineRGB);
        }
      }
    }

    // Outer border emphasis
    doc.setLineWidth(0.6);
    doc.setDrawColor(lineRGB.r, lineRGB.g, lineRGB.b);
    doc.rect(startX, startY, gridW, gridH, 'S');
  }

  function drawArrow(doc, x, y, cell, arrow, rgb) {
    const triSize = Math.max(1.8, cell * 0.16);
    let px, py;
    const pad = 0.8;
    switch (arrow.anchor) {
      case 'TL': px = x + pad; py = y + pad; break;
      case 'TR': px = x + cell - pad - triSize; py = y + pad; break;
      case 'BL': px = x + pad; py = y + cell - pad - triSize; break;
      case 'BR': px = x + cell - pad - triSize; py = y + cell - pad - triSize; break;
    }

    // Triangle points for "right" orientation, then rotate manually per direction.
    let pts;
    switch (arrow.direction) {
      case 'right':
        pts = [[px, py], [px + triSize, py + triSize / 2], [px, py + triSize]];
        break;
      case 'left':
        pts = [[px + triSize, py], [px, py + triSize / 2], [px + triSize, py + triSize]];
        break;
      case 'down':
        pts = [[px, py], [px + triSize, py], [px + triSize / 2, py + triSize]];
        break;
      case 'up':
        pts = [[px, py + triSize], [px + triSize, py + triSize], [px + triSize / 2, py]];
        break;
    }

    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.triangle(
      pts[0][0], pts[0][1],
      pts[1][0], pts[1][1],
      pts[2][0], pts[2][1],
      'F'
    );
  }

  function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const num = parseInt(hex, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  // jsPDF setFontSize() expects points. CSS px -> pt: 1px = 0.75pt (96dpi assumption).
  function pxToPt(px) {
    return Math.max(3, px * 0.75);
  }

  return { exportPDF };
})();
