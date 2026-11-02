// A mockup, not for merge: ?mock=row moves the live position chips (and the Notes chips beside them) off the map and
// into the shown chart's row in the Charts drawer, under its city and year, after a "Chart position:" line
// (docs/spec/design.md, "A chart's position chips, and the line each was fitted to"). It moves the live element, so
// every chip still works and still lights where the sheet lies. docs/mockups/chart-position/README.md shows the renders.
const css = document.createElement('style');
css.textContent = `
  .mk-pos { margin: 6px 0 2px; padding-top: 6px; border-top: 1px dotted var(--rule); }
  .mk-pos[hidden] { display: none; }
  .mk-pos > b { display: block; font: 13px var(--serif); font-weight: normal; opacity: 0.85; margin: 0 0 4px; }
  .mk-pos #sheetChips { position: static !important; display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
  .mk-pos #sheetChips[hidden] { display: none; }
  .mk-pos #sheetChips .where { display: contents; }
  .mk-pos #sheetChips .chip { padding: 2px 8px; font-size: 12px; }
`;
document.head.append(css);

const chips = document.getElementById('sheetChips');
const box = Object.assign(document.createElement('div'), { className: 'mk-pos', hidden: true });
box.append(Object.assign(document.createElement('b'), { textContent: 'Chart position:' }));

// keep the chips in the row of the chart they belong to; hide the line with them when no sheet is shown
function settle() {
  const li = chips.dataset.id && document.querySelector(`#chartList li[data-overlay="${chips.dataset.id}"]`);
  if (!li) { box.hidden = true; return; }
  const about = li.querySelector('.about'), where = about.querySelector('.where');
  if (box.parentNode !== about || box.previousElementSibling !== where) where.after(box);
  if (chips.parentNode !== box) box.append(chips);
  box.hidden = chips.hidden;
}
new MutationObserver(settle).observe(chips, { attributes: true, attributeFilter: ['hidden', 'data-id'] });
settle();
