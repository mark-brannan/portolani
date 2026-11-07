// A compass button that turns the chart: a drag round it turns by the angle swept (clockwise, the chart turns
// clockwise), a click or Enter or Space is the caller's (`click`), and the arrow keys turn by STEP degrees (`step`,
// given the bearing to turn to). The page's compass and the Signal K webapp's share it; each brings its own hooks:
// `bearing()` the bearing now, `grab()` on a press, `turn(b)` live while dragging, `release()` once a drag ends, and
// `drags()`, false where a drag does not turn it (a press is then only a click).
export const WOBBLE = 4, STEP = 15; // degrees a press may wobble and stay a click; degrees an arrow key turns

export const angleAbout = (el, e) => { const r = el.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI; };

export function compassTurn(el, { bearing, grab = () => {}, turn, release = () => {}, click, step, drags = () => true }) {
  let spin = null; // { a, bearing, moved } while held: the pointer's angle about the button and the bearing then
  el.addEventListener('pointerdown', (e) => {
    grab();
    try { el.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer has none to capture */ }
    spin = { a: angleAbout(el, e), bearing: bearing(), moved: false };
  });
  el.addEventListener('pointermove', (e) => {
    if (!spin || !drags()) return;
    const d = ((angleAbout(el, e) - spin.a + 540) % 360) - 180;
    if (!spin.moved && Math.abs(d) < WOBBLE) return; // a click's wobble
    spin.moved = true;
    turn(spin.bearing - d);
  });
  const letGo = (e) => {
    if (!spin) return;
    const { moved } = spin;
    spin = null;
    if (moved) release(); else if (e.type === 'pointerup') click();
  };
  el.addEventListener('click', (e) => { if (e.detail === 0) click(); }); // Enter or Space; a pointer's click came through letGo
  el.addEventListener('pointerup', letGo);
  el.addEventListener('pointercancel', letGo);
  el.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: STEP, ArrowRight: -STEP }[e.key];
    if (d == null) return;
    e.preventDefault();
    step(bearing() + d);
  });
}
