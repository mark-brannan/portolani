// A mockup for the settings drawers' reorg, not for merge: ?mock=1 (moods over one scroll, families as chips),
// ?mock=2 (moods, then tabs Sea · Land · Margins; &tab=1 or 2 opens another), ?mock=3 (the rose keeps the look,
// the chart's own controls move to the Charts drawer under This sheet). It rearranges the live drawer's own
// controls, so every chip still works. docs/mockups/drawers-reorg/README.md shows the renders.
function mock(cand) {
  const q = new URLSearchParams(location.search); window.__tab = Number(q.get('tab') ?? 0);
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (tag, cls, text) => Object.assign(document.createElement(tag), cls ? { className: cls } : {}, text ? { textContent: text } : {});
  const css = el('style');
  css.textContent = `
    .mk-famrow { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 6px; }
    .mk-fam { display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px 3px 4px; border-radius: 8px; font: 13px var(--serif); }
    .mk-fam img, .mk-fam svg { height: 26px; max-width: 40px; object-fit: contain; }
    .mk-fam b { font: 600 10px system-ui, sans-serif; padding: 1px 5px; border-radius: 8px; background: var(--sheet); color: var(--muted); }
    .mk-fam[data-state=all] { border: 1.5px solid var(--accent); }
    .mk-fam[data-state=all] b { background: var(--accent); color: #f4efe4; }
    .mk-fam[data-state=part] { border: 1.5px dashed var(--accent); }
    .mk-fam[data-state=none] { opacity: .55; border: 1px solid var(--rule); }
    .mk-fam.mk-open { box-shadow: 0 0 0 2px var(--panel), 0 0 0 3.5px var(--fg); }
    .mk-tray { background: var(--sheet); border-radius: 6px; padding: 6px; margin: 2px 0 8px; }
    .mk-tray .thumbs { margin: 0; }
    .mk-tabs { display: flex; gap: 0; margin: 12px 0 4px; border-bottom: 1px solid var(--rule); position: sticky; top: -14px; background: var(--panel); z-index: 1; padding-top: 4px; }
    .mk-tabs button { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 4px 7px; border: none; background: none; font: 16px var(--serif); color: var(--muted); border-bottom: 3px solid transparent; cursor: pointer; }
    .mk-tabs button svg { width: 34px; height: 22px; }
    .mk-tabs button[aria-selected=true] { color: var(--accent); border-bottom-color: var(--accent); }
    .mk-tabs small { font: 10px system-ui, sans-serif; color: var(--muted); }
    .mk-moodh { margin: 10px 0 4px; }
    .mk-note { font: italic 12px system-ui, sans-serif; color: var(--muted); margin: 2px 0 6px; }
    .mk-moved { border: 1.5px dashed var(--accent); border-radius: 8px; padding: 6px 10px; margin: 8px 0; font: 13px system-ui, sans-serif; color: var(--muted); }
    .mk-moved b { color: var(--accent); font-weight: 600; }
    .mk-compact .presets { display: flex; flex-wrap: wrap; gap: 4px; }
    .mk-compact .preset { flex: 1 1 auto; min-width: 0; padding: 4px 5px; align-items: center; text-align: center; }
    .mk-compact .preset small { display: none; }
    .mk-compact .preset b { font-size: 13px !important; }
    .mk-compact .preset .sample svg, .mk-compact .preset .sample img { max-width: 22px; }
    .mk-new { outline: 2px dashed var(--accent); outline-offset: 3px; }
  `;
  document.head.append(css);

  // grab the five mood chips from the existing Moods layout, then go back to Default
  $('#layout [data-layout=moods]').click();
  const moods = $('.presets.moods');
  $('#layout [data-layout=default]').click();
  const moodBlock = el('div');
  moodBlock.append(el('h3', 'mk-moodh', 'Mood'), el('p', 'mk-note', 'None lit is Default. A mood sets the whole look; every control below still moves.'), moods);

  // a family row becomes a chip: its first picture, its name, a count; one family open, its pictures in a tray
  const chipify = (open) => {
    for (const pick of $$('#pick-monster, #pick-ship, #pick-rose, #pick-town, #pick-relief')) {
      const fams = $$(':scope > .family', pick), row = el('div', 'mk-famrow'), tray = el('div', 'mk-tray');
      for (const f of fams) {
        const head = $('.fam', f), count = $('.count', head).textContent, name = [...head.childNodes].find((n) => n.nodeType === 3).textContent.trim();
        const [on, of] = count.split(' of ').map(Number);
        const chip = el('button', 'chip mk-fam');
        chip.dataset.state = on === 0 ? 'none' : on === of ? 'all' : 'part';
        const pic = $('.thumb img, .thumb svg', f);
        if (pic) chip.append(pic.cloneNode(true));
        chip.append(el('span', '', name), el('b', '', count.replace(' of ', '/')));
        row.append(chip);
        if (name === open) { chip.classList.add('mk-open'); tray.append($('.thumbs', f)); }
        f.hidden = true;
      }
      pick.prepend(row);
      if (tray.children.length) row.after(tray);
    }
  };
  const drawer = $('#drawer');
  $('#layout').remove(); // the layout chips retire with the reorg
  const share = $('#share');
  const ctl = (id) => $(`#drawer .ctl[data-ctl="${id}"]`), lead = (id) => $(`#drawer [data-lead-for="${id}"]`);

  if (cand === 1) {
    share.after(moodBlock);
    chipify('Pare · scan');
  }
  if (cand === 2) {
    moodBlock.classList.add('mk-compact');
    share.after(moodBlock);
    chipify('Pare · scan');
    const g = (d) => `<svg viewBox="0 0 34 22" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round">${d}</svg>`;
    const TABS = [
      ['Sea', 'figures in the water', g('<path d="M3 14q3-3 6 0t6 0 6 0 6 0 6 0M3 18q3-3 6 0t6 0 6 0"/><path d="M12 11q2-7 9-6-3 2-2 6Z" fill="currentColor" fill-opacity=".4"/>'), ['density', 'monsters', 'ships', 'placement']],
      ['Land', 'coast, relief, towns', g('<path d="M2 18l7-9 5 5 6-9 12 13Z" fill="currentColor" fill-opacity=".25"/><path d="M14 18v-4h3v4"/>'), ['continents', 'regions', 'land', 'colour', 'rivers', 'lakes', 'mountains', 'hills', 'trees', 'towns']],
      ['Margins', 'roses, lines, frame', g('<rect x="2" y="2" width="30" height="18"/><rect x="5" y="5" width="24" height="12" stroke-width=".6"/><circle cx="25" cy="9" r="3"/><path d="M25 4v10M20 9h10"/>'), ['roses', 'overlap', 'rhumb', 'names', 'projection', 'scale', 'cartouche', 'colours']],
    ];
    const tabs = el('div', 'mk-tabs');
    tabs.setAttribute('role', 'tablist');
    const panes = TABS.map(([name, sub, glyph, ids], i) => {
      const t = el('button'); t.setAttribute('role', 'tab'); t.setAttribute('aria-selected', String(i === (window.__tab ?? 0)));
      t.innerHTML = glyph; t.append(el('span', '', name), el('small', '', sub)); tabs.append(t);
      const pane = el('section'); for (const id of ids) pane.append(...[lead(id), ctl(id)].filter(Boolean));
      pane.hidden = i !== (window.__tab ?? 0); return pane;
    });
    [...tabs.children].forEach((t, i) => t.addEventListener('click', () => {
      [...tabs.children].forEach((u, j) => u.setAttribute('aria-selected', String(i === j)));
      panes.forEach((p, j) => { p.hidden = i !== j; });
    }));
    moodBlock.after(tabs, ...panes);
    for (const s of $$('#drawer section.home')) s.remove();
  }
  if (cand === 3) {
    // the rose keeps the look: mood, figures, land; the chart's own furniture moves to the charts drawer
    moodBlock.classList.add('mk-compact');
    share.after(moodBlock);
    chipify('Pare · scan');
    const toCharts = ['projection', 'names', 'rhumb', 'scale', 'overlap', 'cartouche', 'colours'];
    const sec = el('section', 'mk-new'), h = el('h2', '', 'This sheet');
    sec.append(h, el('p', 'mk-note', 'Moved here from the rose: how the chart itself is drawn, its frame, lines and inks.'));
    for (const id of toCharts) sec.append(...[lead(id), ctl(id)].filter(Boolean));
    const hood = $('#hood').closest('section');
    sec.append(hood);
    $('#chartsDrawer header').after(sec);
    const moved = el('div', 'mk-moved');
    moved.innerHTML = '<b>Projection, names, rhumb lines, scale bar, cartouche, overlap, ink and parchment</b> now live in the Charts drawer, under <i>This sheet</i>.';
    moodBlock.after(moved);
    // the rose's sections that emptied go; Map keeps the land's lines
    for (const s of $$('#drawer section.home')) if (!s.querySelector('.ctl')) s.remove();
    const mapH = $('#h-map'); if (mapH) mapH.textContent = 'Land lines';
  }
}


const cand = Number(new URLSearchParams(location.search).get('mock'));
// page.js builds the layout chips (and the moods with them) as it loads; wait for them
const ready = () => document.querySelector('#layout [data-layout=moods]') && document.querySelector('#pick-monster .family');
(function wait() { if (ready()) mock(cand); else setTimeout(wait, 100); })();
