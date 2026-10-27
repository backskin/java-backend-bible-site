window.__cc=function(){return (() => {
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const blend = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  function bgOf(el) {
    const layers = []; let img = null;
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.backgroundImage && s.backgroundImage !== 'none' && !img) img = e;
      const c = parse(s.backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) base = blend(layers[i], base);
    return { bg: base, img };
  }
  const out = []; const seen = new Set();
  document.querySelectorAll('body *').forEach(el => {
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim())) return;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    const s = getComputedStyle(el); if (s.visibility === 'hidden' || +s.opacity === 0) return;
    let fg = parse(s.color); if (!fg) return;
    const { bg, img } = bgOf(el);
    if (fg.a < 1) fg = blend(fg, bg);
    const L1 = lum(fg), L2 = lum(bg); const cr = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
    const size = parseFloat(s.fontSize), bold = +s.fontWeight >= 700;
    const need = (size >= 24 || (bold && size >= 18.6)) ? 3 : 4.5;
    if (cr < need) {
      const key = el.tagName + '.' + el.className + '|' + s.color;
      if (seen.has(key)) return; seen.add(key);
      out.push({ cr: +cr.toFixed(2), need, el: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''), text: el.textContent.trim().slice(0, 40), onImage: img ? (img.className || img.tagName) : '' });
    }
  });
  return out.sort((a, b) => a.cr - b.cr).slice(0, 40);
})()};