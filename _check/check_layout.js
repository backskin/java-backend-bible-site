/* Проверка вёрстки страницы сайта: вызывается в окне страницы (window.__layout()) или из tools/check_site.html.
   Ищет: 1) прокрутку страницы вбок; 2) значки, налезающие на текст; 3) текст, вылезающий за свой блок
   (обрезан или наезжает на соседа); 4) кнопки и ссылки меньше 24 px по высоте на телефоне;
   5) слабый контраст текста (WCAG: 4,5, крупный — 3). Возвращает список замечаний. */
window.__layout = function () {
  const out = [], W = document.documentElement.clientWidth;
  const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const name = e => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).join('.') : '');
  // 1. прокрутка вбок
  const sw = document.documentElement.scrollWidth;
  if (sw > W + 1) {
    const wide = [...document.body.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(); return r.right > W + 1 && vis(e) && !e.closest('pre,table,.hl,.results,.side,[aria-hidden="true"]'); })
      .slice(0, 4).map(name);
    out.push(`прокрутка вбок: ширина ${sw} при окне ${W}; виноваты: ${wide.join(', ')}`);
  }
  // 2. значки и картинки поверх текста
  const textRects = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: n => n.nodeValue.trim() ? 1 : 2 });
  let n; while ((n = tw.nextNode())) { const el = n.parentElement; if (!el || !vis(el) || el.closest('svg,script,style,.side:not(.open)')) continue;
    const rg = document.createRange(); rg.selectNodeContents(n); for (const r of rg.getClientRects()) if (r.width > 2) textRects.push([r, el]); }
  document.querySelectorAll('img.xp-ic,img.xp-ic-h,.prose img').forEach(img => {
    if (!vis(img) || img.closest('.side:not(.open)')) return; const a = img.getBoundingClientRect();
    for (const [r, el] of textRects) { if (img.contains(el)) continue;
      const ix = Math.min(a.right, r.right) - Math.max(a.left, r.left), iy = Math.min(a.bottom, r.bottom) - Math.max(a.top, r.top);
      if (ix > 2 && iy > 2) { out.push(`значок ${img.getAttribute('src')} налезает на текст «${el.textContent.trim().slice(0, 30)}» (${name(el)})`); break; } }
  });
  // 3. текст шире своего блока (обрезан overflow или торчит)
  document.querySelectorAll('.prose p,.prose li,.prose h1,.prose h2,.prose h3,.toc a,.side a,.btn,.nav a,.chap a,.route,.go-main,.xp-status div,.meta span,.topbar-in>*').forEach(e => {
    if (!vis(e) || e.closest('.side:not(.open)')) return;
    if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX !== 'auto' && getComputedStyle(e).textOverflow !== 'ellipsis' && !e.querySelector('pre,table,code'))
      out.push(`текст шире блока: ${name(e)} «${e.textContent.trim().slice(0, 30)}» (${e.scrollWidth} > ${e.clientWidth})`);
  });
  // 4. мелкие цели нажатия на телефоне
  if (W <= 640) document.querySelectorAll('.topbar button,.topbar a,.btn,.toc-toggle,.nav a,.go-main').forEach(e => {
    if (!vis(e)) return; const r = e.getBoundingClientRect(); if (r.height < 24) out.push(`мелкая кнопка: ${name(e)} «${e.textContent.trim().slice(0, 20)}» высота ${Math.round(r.height)}`); });
  // 5. контраст
  const parse = c => {
    const s = c.match(/color\(srgb ([^)]+)\)/);   // color-mix() браузер отдаёт как color(srgb r g b / a), доли 0..1
    if (s) { const p = s[1].split(/[ \/]+/).filter(Boolean).map(Number); return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 }; }
    const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const blend = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
  const bgOf = el => { const L = []; let grad = false; for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e);
      if (/gradient/.test(s.backgroundImage)) grad = true; const c = parse(s.backgroundColor); if (c && c.a > 0) { L.push(c); if (c.a >= 1) break; } }
    let b = { r: 255, g: 255, b: 255, a: 1 }; for (let i = L.length - 1; i >= 0; i--) b = blend(L[i], b); return { b, grad }; };
  const seen = new Set();
  document.querySelectorAll('body *').forEach(el => {
    if (![...el.childNodes].some(x => x.nodeType === 3 && x.nodeValue.trim())) return; if (!vis(el) || el.closest('.side:not(.open),[aria-hidden="true"]')) return;
    const s = getComputedStyle(el); if (+s.opacity === 0) return; let fg = parse(s.color); if (!fg || fg.a === 0) return;
    const { b, grad } = bgOf(el); if (grad) return; if (fg.a < 1) fg = blend(fg, b);
    const L1 = lum(fg), L2 = lum(b), cr = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
    const big = parseFloat(s.fontSize) >= 24 || (+s.fontWeight >= 700 && parseFloat(s.fontSize) >= 18.6);
    if (cr < (big ? 3 : 4.5)) { const k = name(el) + s.color; if (seen.has(k)) return; seen.add(k);
      out.push(`контраст ${cr.toFixed(2)}: ${name(el)} «${el.textContent.trim().slice(0, 30)}»`); }
  });
  return out;
};
