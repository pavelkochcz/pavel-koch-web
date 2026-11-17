{
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Obrázky: na Netlify se zmenšují přes jejich Image CDN, jinde (náhled) se použije originál. */
const useCdn = !/localhost|127\.0|claude|usercontent|^$/.test(location.hostname) && location.protocol.startsWith('http');
const rel = src => String(src || '').replace(/^\//, '');
const img = (src, w) => useCdn && src.startsWith('/') ? `/.netlify/images?url=${encodeURIComponent(src)}&w=${w}&q=82` : rel(src);
const srcset = src => useCdn && src.startsWith('/') ? [500, 900, 1400, 2000].map(w => `${img(src, w)} ${w}w`).join(', ') : '';
const safeImg = (el, src, w, sizes) => {
  el.src = img(src, w);
  const ss = srcset(src); if (ss) { el.srcset = ss; el.sizes = sizes || '100vw'; }
  el.onerror = () => { if (el.dataset.fb) return; el.dataset.fb = 1; el.removeAttribute('srcset'); el.src = rel(src); };
};
const slugify = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'dilo';
const statusCls = s => ({'Rezervováno':'res','Prodáno':'sold','Soukromá sbírka':'priv'}[s] || '');
const dims = w => {
  const n = [w.width, w.height].map(Number);
  if (!n[0] || !n[1]) return '';
  const d = Number(w.depth);
  return `${n[0]} × ${n[1]}${d ? ' × ' + d : ''} cm`;
};
const ratio = w => (Number(w.width) && Number(w.height)) ? w.width / w.height : null;
const isFlat = w => !['Socha', 'Objekt', 'Keramika'].includes(w.category);

let SITE = {}, WORKS = [];

async function load() {
  const get = async p => { const r = await fetch(p, {cache: 'no-store'}); if (!r.ok) throw new Error(p); return r.json(); };
  try {
    [SITE, {works: WORKS}] = await Promise.all([get('content/site.json'), get('content/works.json')]);
  } catch (e) { console.error('Obsah se nenačetl', e); return; }
  const used = {};
  WORKS = (WORKS || []).filter(w => w && !w.hidden && w.title && w.images && w.images.length).map((w, i) => {
    let s = slugify(w.title); used[s] = (used[s] || 0) + 1; if (used[s] > 1) s += '-' + used[s];
    return {...w, slug: s, i, group: w.theme || w.series || w.category || 'Ostatní'};
  });
  fillSite(); buildWall(); buildSalon(); buildWalk(); buildProjects(); buildForm(); reveal(); scrollFx(); route(true); openFromHash();
}

function fillSite() {
  const S = SITE;
  $$('[data-name]').forEach(e => e.textContent = S.name || '');
  $$('[data-disciplines]').forEach(e => e.textContent = S.disciplines || '');
  const t = $('[data-titles]'); if (t) t.textContent = [S.titles, S.name].filter(Boolean).join(' ');
  if (S.name) document.title = `${S.name} – ${(S.disciplines || '').toLowerCase().replace(/ · /g, ', ')}`;
  if (S.statement) {
    const st = $('.statement'); st.hidden = false;
    $('[data-statement]').innerHTML = S.statement.split(/\s+/).map(w => `<span class="w">${esc(w)}</span>`).join(' ');
  }
  $('[data-bio]').innerHTML = (S.bio || '').split(/\n\s*\n/).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('');
  const q = $('[data-quote]'); if (S.quote) q.textContent = `„${S.quote}“`; else q.remove();
  $('.cv').innerHTML = (S.cv || []).map(c => {
    const [main, role] = String(c.text || '').split(' – ');
    return `<li>${c.year ? `<b>${esc(c.year)}</b> ` : ''}${esc(main)}${role ? ` <em>– ${esc(role)}</em>` : ''}</li>`;
  }).join('');
  const facts = $('.facts');
  [['film', 'Film'], ['education', 'Vzdělání']].forEach(([k]) => { const dd = $(`[data-${k}]`); if (S[k]) dd.textContent = S[k]; else { dd.previousElementSibling.remove(); dd.remove(); } });
  if (!facts.children.length) facts.remove();
  if (S.portrait) { const f = $('.portrait'); f.innerHTML = '<img alt="">'; safeImg($('img', f), S.portrait, 1000, '(max-width:800px) 90vw, 40vw'); $('img', f).alt = `${S.name}, portrét`; }
  const e = $('[data-email]'), p = $('[data-phone]'), ig = $('[data-instagram]');
  if (S.email) { e.textContent = S.email; e.href = 'mailto:' + S.email; } else e.remove();
  if (S.phone) { p.textContent = S.phone; p.href = 'tel:' + S.phone.replace(/\s/g, ''); } else p.remove();
  if (S.instagram) { const h = S.instagram.replace(/^@/, '').replace(/.*instagram\.com\//, '').replace(/\/$/, ''); ig.textContent = 'Instagram @' + h; ig.href = 'https://instagram.com/' + h; } else ig.remove();
  $('[data-location]').textContent = S.location || '';
  $('[data-year]').textContent = new Date().getFullYear();
}

/* ---------- Úvodní zeď: salonní zavěšení ve skutečném měřítku ---------- */
/* Rámeček: díla vyfocená bez rámu dostanou světlý dřevěný rám se stínovou spárou jako jeho skutečné rámy. */
const frameOf = (w, outerW, outerH) => {
  if (!w.frame) return 0;
  return Math.max(4, Math.min(outerW, outerH) * .065);
};
const applyFrame = (img, w, outerW, outerH) => {
  const t = frameOf(w, outerW, outerH);
  img.classList.toggle('fr', !!t);
  if (!t) { img.style.borderWidth = img.style.padding = ''; return; }
  img.style.borderWidth = t * .62 + 'px'; img.style.padding = t * .38 + 'px';
};
const arEff = (w, ar) => w.frame ? ar * .87 + .13 : ar;   // poměr stran včetně rámu
/* Náklon: některé obrazy autor věší úmyslně šikmo – na webu visí stejně. Vrací přidaný prostor nad a pod dílem. */
const tiltOf = w => Number(w && w.tilt) || 0;
const applyTilt = (el, w, pw, ph) => {
  const t = tiltOf(w); el.style.setProperty('--tilt', t + 'deg');
  if (!t) { el.style.paddingTop = el.style.paddingBottom = ''; return 0; }
  const r = Math.abs(t) * Math.PI / 180, extra = Math.max(0, (pw * Math.sin(r) + ph * Math.cos(r) - ph) / 2);
  el.style.paddingTop = el.style.paddingBottom = extra + 'px';
  return extra;
};

function buildWall() {
  const wall = $('.wall'), inner = $('.wall-in'), tip = $('.wall-tip');
  const pool = WORKS.filter(w => !w.project && isFlat(w)).slice(0, 16);
  if (!pool.length) { wall.remove(); $('.wall-note').remove(); return; }
  if (pool.some(w => !ratio(w))) $('.wall-note').hidden = true;   // „skutečný poměr“ jen když známe rozměry všech
  inner.innerHTML = pool.map(w => `<button class="hung is-flat" data-open="${w.slug}" aria-label="${esc(w.title)}"><img alt="${esc(w.title)}"></button>`).join('');
  const imgs = $$('.hung img', inner);
  const size = w => { if (ratio(w)) return [Number(w.width), Number(w.height)]; const ar = w._ar || 2; return ar >= 1 ? [32, 32 / ar] : [32 * ar, 32]; };
  const layout = () => {
    const W = wall.clientWidth, H = wall.clientHeight; if (!W || !H) return;
    const vertical = W / H < 0.9;
    const G = 5, LIM = vertical ? 92 : 68;
    const A = w => size(w)[vertical ? 1 : 0], B = w => size(w)[vertical ? 0 : 1];
    const groups = []; let g = null;
    pool.forEach(w => {
      const len = g ? g.len + G + B(w) : B(w);
      if (!g || len > LIM) { g = {items: [w], len: B(w), th: A(w)}; groups.push(g); }
      else { g.items.push(w); g.len = len; g.th = Math.max(g.th, A(w)); }
    });
    const total = groups.reduce((s, g) => s + g.th, 0) + G * 1.3 * (groups.length - 1);
    const maxLen = Math.max(...groups.map(g => g.len));
    const s = Math.min((vertical ? H : W) / total, (vertical ? W : H) / maxLen) * 0.94;
    let pos = (vertical ? H : W) / 2 - total * s / 2;
    groups.forEach(g => {
      let along = ((vertical ? W : H) - g.len * s) / 2;
      g.items.forEach(w => {
        const el = inner.querySelector(`[data-open="${w.slug}"]`);
        const a = A(w) * s, b = B(w) * s, off = (g.th * s - a) / 2;
        const x = vertical ? along : pos + off, y = vertical ? pos + off : along;
        const ew = vertical ? b : a, eh = vertical ? a : b;
        Object.assign(el.style, {left: x + 'px', top: y + 'px', width: ew + 'px', height: eh + 'px'});
        applyFrame($('img', el), w, ew, eh); el.style.setProperty('--tilt', tiltOf(w) + 'deg');
        along += b + G * s;
      });
      pos += g.th * s + G * 1.3 * s;
    });
  };
  let left = imgs.length;
  imgs.forEach((im, k) => {
    im.addEventListener('load', () => { pool[k]._ar = im.naturalWidth / im.naturalHeight; if (--left === 0) { layout(); show(); } }, {once: true});
    im.addEventListener('error', () => { if (--left === 0) { layout(); show(); } }, {once: true});
    safeImg(im, pool[k].images[0], 700, '20vw');
  });
  const show = () => $$('.hung', inner).forEach((b, k) => setTimeout(() => b.classList.add('in', 'lit'), reduced ? 0 : k * 45));
  new ResizeObserver(layout).observe(wall);
  setTimeout(() => { if (left > 0) { layout(); show(); } }, 3500);

  if (fine) {
    wall.addEventListener('mousemove', e => {
      const r = wall.getBoundingClientRect();
      if (!reduced) inner.style.transform = `translate(${((e.clientX - r.left) / r.width - .5) * -14}px, ${((e.clientY - r.top) / r.height - .5) * -10}px)`;
      const h = e.target.closest('[data-open]');
      if (h) {
        const w = WORKS.find(x => x.slug === h.dataset.open);
        tip.innerHTML = `<b>${esc(w.title)}</b>${[dims(w), w.year].filter(Boolean).map(esc).join(', ')}`;
        tip.style.transform = `translate(${Math.min(e.clientX + 22, innerWidth - tip.offsetWidth - 12)}px, ${e.clientY + 26}px)`;
        tip.classList.add('on');
      } else tip.classList.remove('on');
    });
    wall.addEventListener('mouseleave', () => { inner.style.transform = ''; tip.classList.remove('on'); });
  }
}

/* ---------- Díla ---------- */
function buildSalon() {
  const ART = WORKS.filter(w => !w.project);
  const groups = [...new Set(ART.map(w => w.group))];
  const f = $('.filters');
  f.innerHTML = [['*', 'Vše', ART.length], ...groups.map(g => [g, g, ART.filter(w => w.group === g).length])]
    .map(([k, l, n], i) => `<button role="tab" aria-selected="${i === 0}" data-f="${esc(k)}">${esc(l)}<sup>${n}</sup></button>`).join('');
  if (groups.length < 2) f.hidden = true;
  const sal = $('.salon');
  sal.innerHTML = ART.map(w => {
    const meta = [w.technique, dims(w)].filter(Boolean).map(esc).join(', ');
    return `<figure class="piece" data-g="${esc(w.group)}" data-k="${w.i}">
      <button class="hung ${isFlat(w) ? 'is-flat' : ''}" data-open="${w.slug}" aria-label="Otevřít: ${esc(w.title)}"><img alt="${esc(w.title)}" loading="lazy"></button>
      <figcaption class="label"><b>${esc(w.title)}</b>${w.year ? esc(w.year) + '<br>' : ''}${meta}${meta ? '<br>' : ''}${w.status ? `<span class="st"><i class="dot ${statusCls(w.status)}"></i>${esc(w.status)}</span>` : ''}</figcaption>
    </figure>`;
  }).join('');
  const AR = {};
  ART.forEach(w => { if (ratio(w)) AR[w.i] = ratio(w); });
  $$('.piece', sal).forEach(p => {
    const w = WORKS[p.dataset.k], im = $('img', p);
    safeImg(im, w.images[0], 1200, '(max-width:800px) 92vw, 40vw');
    im.addEventListener('load', () => { const a = im.naturalWidth / im.naturalHeight; if (!AR[w.i] || !isFlat(w) || !ratio(w)) { AR[w.i] = a; justify(); } });
  });
  /* zarovnané řady: každá řada stejně vysoká, díla v pravém poměru stran */
  const justify = () => {
    const W = sal.clientWidth; if (!W) return;
    const mobile = W < 560, gap = mobile ? 16 : Math.max(28, W * .035), target = mobile ? W * .46 : Math.min(290, Math.max(200, W * .19)), perRow = mobile ? 2 : 4;
    const items = $$('.piece', sal).filter(p => !p.classList.contains('gone'));
    let row = [], sum = 0;
    const flush = (last) => {
      if (!row.length) return;
      let h = (W - 2 - gap * (row.length - 1)) / sum;
      h = Math.min(h, target * (last ? 1.1 : 1.25));
      row.forEach(([p, ar]) => {
        const w = WORKS[p.dataset.k], im = $('img', p);
        const pw = ar * h, ph = h;
        p.style.width = pw + 'px'; im.style.height = ph + 'px';
        applyFrame(im, w, pw, ph); applyTilt($('.hung', p), w, pw, ph);
      });
      row = []; sum = 0;
    };
    items.forEach(p => {
      const w = WORKS[p.dataset.k], ar = arEff(w, AR[w.i] || .75);
      if (mobile && ar > 1.7) { flush(); row = [[p, ar]]; sum = ar; flush(); return; }
      row.push([p, ar]); sum += ar;
      if (sum * target + gap * (row.length - 1) >= W * .9 || row.length === perRow) flush();
    });
    flush(true);
  };
  justify(); new ResizeObserver(justify).observe(sal);
  sal._justify = justify;
  f.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('button', f).forEach(x => x.setAttribute('aria-selected', x === b));
    $$('.piece', sal).forEach(p => p.classList.toggle('gone', !(b.dataset.f === '*' || p.dataset.g === b.dataset.f)));
    sal._justify(); window._fx && window._fx();
  });
}

function fitViewer() {
  const w = WORKS[cur]; if (!w) return;
  if (!w.frame || !vimg.naturalWidth) { vimg.classList.remove('fr'); vimg.style.width = vimg.style.height = vimg.style.borderWidth = vimg.style.padding = ''; return; }
  const sw = stage.clientWidth, sh = stage.clientHeight, a = arEff(w, vimg.naturalWidth / vimg.naturalHeight);
  const H = Math.min(sh, sw / a) * .94, W = H * a;
  Object.assign(vimg.style, {width: W + 'px', height: H + 'px', maxWidth: 'none', maxHeight: 'none'});
  applyFrame(vimg, w, W, H);
}
addEventListener('resize', () => { if (!V.hidden) fitViewer(); });

/* ---------- Další tvorba ---------- */
function buildProjects() {
  const P = WORKS.filter(w => w.project), sec = $('.projects');
  if (!P.length) return;
  sec.hidden = false;
  $('.proj-grid', sec).innerHTML = P.map(w => `<figure class="proj">
    <button class="proj-img" data-open="${w.slug}" aria-label="Otevřít: ${esc(w.title)}"><img alt="${esc(w.title)}" loading="lazy"></button>
    <figcaption><b>${esc(w.title)}</b><span>${w.images.length} ${w.images.length > 4 ? 'fotografií' : w.images.length > 1 ? 'fotografie' : 'fotografie'}</span></figcaption></figure>`).join('');
  // náhled vždy celý, v jeho skutečném poměru stran (nic se neořezává)
  $$('.proj', sec).forEach((f, k) => {
    const im = $('img', f);
    im.addEventListener('load', () => f.style.setProperty('--r', (im.naturalWidth / im.naturalHeight).toFixed(3)), {once: true});
    safeImg(im, P[k].images[0], 900, '(max-width:800px) 60vw, 30vw');
  });
}

/* ---------- Detail díla ---------- */
const V = $('.viewer');
let cur = -1, imgIdx = 0, zoom = false, lastFocus = null;
const stage = $('.v-img', V), vimg = $('.v-img img', V), loupe = $('.loupe', V);

let flipFrom = null;
function openWork(slug, push = true, srcImg = null) {
  flipFrom = srcImg && !reduced && srcImg.complete && srcImg.naturalWidth ? {el: srcImg, r: srcImg.getBoundingClientRect(), src: srcImg.currentSrc || srcImg.src} : null;
  const k = WORKS.findIndex(w => w.slug === slug); if (k < 0) return;
  if (V.hidden) { lastFocus = document.activeElement; V.hidden = false; document.body.style.overflow = 'hidden'; requestAnimationFrame(() => V.classList.add('open')); }
  const cu = $('.cursor'); if (cu) cu.classList.remove('big');
  cur = k; imgIdx = 0; render();
  if (push && location.hash !== '#dilo-' + slug) history.replaceState(null, '', '#dilo-' + slug);
  V.focus({preventScroll: true});
}
function closeWork() {
  V.classList.remove('open'); hideScale();
  setTimeout(() => { V.hidden = true; document.body.style.overflow = ''; }, reduced ? 0 : 400);
  history.replaceState(null, '', location.pathname + location.search + (view !== 'home' ? '#' + view : ''));
  lastFocus && lastFocus.focus && lastFocus.focus({preventScroll: true});
}
function setZoom(on, e) {
  zoom = on; stage.classList.toggle('zoom', on); stage.classList.remove('lens');
  if (!on) { vimg.style.transform = ''; return; }
  pan(e);
}
let px = .5, py = .5;
function pan(e) {
  if (!zoom) return;
  if (e) { const r = stage.getBoundingClientRect(); px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)); }
  vimg.style.transform = `translate(${(.5 - px) * 150}%, ${(.5 - py) * 150}%) scale(2.6)`;
}
function showImg() {
  const w = WORKS[cur], src = w.images[imgIdx];
  setZoom(false); vimg.style.opacity = 0;
  const pre = new Image();
  const done = () => {
    safeImg(vimg, src, 2000, '(max-width:1000px) 100vw, 70vw'); vimg.alt = w.title;
    vimg.complete && vimg.naturalWidth ? fitViewer() : vimg.addEventListener('load', fitViewer, {once: true});
    const f = flipFrom; flipFrom = null;
    if (!f) { vimg.style.opacity = 1; return; }
    const go = () => requestAnimationFrame(() => {
      const t = vimg.getBoundingClientRect();
      if (!t.width) { vimg.style.opacity = 1; return; }
      const c = document.createElement('img'); c.src = f.src; c.className = 'flip';
      Object.assign(c.style, {position: 'fixed', left: t.left + 'px', top: t.top + 'px', width: t.width + 'px', height: t.height + 'px', zIndex: 50, objectFit: 'cover', boxShadow: '0 30px 60px -30px rgba(0,0,0,.45)'});
      document.body.appendChild(c); f.el.style.visibility = 'hidden';
      const sx = f.r.width / t.width, sy = f.r.height / t.height;
      const a = c.animate([{transformOrigin: '0 0', transform: `translate(${f.r.left - t.left}px, ${f.r.top - t.top}px) scale(${sx}, ${sy})`}, {transformOrigin: '0 0', transform: 'none'}], {duration: 850, easing: 'cubic-bezier(.65,0,.2,1)'});
      a.onfinish = () => { vimg.style.opacity = 1; vimg.style.transition = 'none'; requestAnimationFrame(() => { c.remove(); vimg.style.transition = ''; f.el.style.visibility = ''; }); };
    });
    vimg.complete && vimg.naturalWidth ? go() : vimg.addEventListener('load', go, {once: true});
  };
  pre.onload = pre.onerror = done; pre.src = img(src, 2000);
  loupe.style.backgroundImage = `url("${img(src, 2400)}"), url("${rel(src)}")`;
  $$('.v-thumbs button', V).forEach((b, i) => b.setAttribute('aria-current', i === imgIdx));
}
function render() {
  const w = WORKS[cur];
  $('.v-cat', V).textContent = [w.category, w.series].filter(Boolean).join(' · ');
  $('#v-title').textContent = w.title;
  const rows = [['Rok', w.year], ['Místo', w.place], ['Technika', w.technique], ['Rozměr', dims(w) && dims(w) + (w.depth ? ' (š × v × h)' : ' (š × v)')], ['Cena', w.price ? w.price : w.status === 'Dostupné' ? 'na dotaz' : '']];
  $('.v-meta', V).innerHTML = rows.filter(r => r[1]).map(([a, b]) => `<dt>${a}</dt><dd>${esc(b)}</dd>`).join('');
  $('.v-status', V).innerHTML = w.status ? `<i class="dot ${statusCls(w.status)}"></i>${esc(w.status)}` : '';
  $('.v-desc', V).textContent = w.description || '';
  const avail = w.status === 'Dostupné';
  $('[data-inquire]', V).textContent = avail ? 'Mám zájem o dílo' : 'Napsat autorovi';
  $('[data-scale]', V).hidden = !ratio(w);
  $('[data-3d]', V).hidden = !(ratio(w) && isFlat(w));
  $('[data-process]', V).hidden = !(w.process && w.process.length && w.process[0].image);
  B3.hidden = true; CMP.hidden = true; $$('.v-tools .chip', V).forEach(c => c.setAttribute('aria-pressed', false));
  $('.v-thumbs', V).innerHTML = w.images.length > 1 ? w.images.map((s, i) => `<button aria-label="Pohled ${i + 1}"><img alt="" src="${esc(img(s, 200))}" onerror="this.onerror=null;this.src='${esc(rel(s))}'"></button>`).join('') : '';
  { const L = peers(); $('.v-count', V).textContent = `${L.indexOf(w) + 1} / ${L.length}`; }
  $('.v-hint', V).hidden = !fine;
  showImg();
  if (!$('.scale', V).hidden) showScale();
}
const peers = () => WORKS.filter(x => !!x.project === !!WORKS[cur].project);
const step = d => { const L = peers(), k = L.indexOf(WORKS[cur]); openWork(L[(k + d + L.length) % L.length].slug); };

document.addEventListener('click', e => {
  const o = e.target.closest('[data-open]'); if (o && o.dataset.open) { e.preventDefault(); openWork(o.dataset.open, true, o.querySelector('img')); }
});
$('.v-close', V).onclick = closeWork;
$('[data-prev]', V).onclick = () => step(-1);
$('[data-next]', V).onclick = () => step(1);
$('.v-thumbs', V).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; imgIdx = $$('.v-thumbs button', V).indexOf(b); showImg(); });
$('[data-inquire]', V).onclick = () => {
  const w = WORKS[cur]; closeWork();
  const sel = $('#f-dilo'); sel.value = w.title;
  const msg = $('#f-zprava'); if (!msg.value) msg.value = `Dobrý den, zajímá mě dílo „${w.title}“. `;
  setTimeout(() => { location.hash = 'kontakt'; setTimeout(() => $('#f-jmeno').focus({preventScroll: true}), 80); }, 420);
};
document.addEventListener('keydown', e => {
  if (V.hidden) return;
  if (e.key === 'Escape') { if (!$('.scale', V).hidden) hideScale(); else closeWork(); }
  if (e.key === 'ArrowRight') step(1);
  if (e.key === 'ArrowLeft') step(-1);
});
addEventListener('hashchange', () => { route(); openFromHash(); });
/* ---------- Stránky: hlavní stránka je jen galerie, ostatní se otevírají z menu ---------- */
const PAGES = ['tvorba', 'autor', 'kontakt'];
let view = 'home', homeY = 0;
function route(first) {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith('dilo-')) { if (first) document.body.dataset.view = view; return; }
  const next = PAGES.includes(h) ? h : 'home';
  const changed = next !== view || first;
  if (next !== view && view === 'home') homeY = scrollY;
  view = next; document.body.dataset.view = next;
  $$('.nav a, .mnav a').forEach(a => a.toggleAttribute('aria-current', a.getAttribute('href') === '#' + next || (next === 'home' && a.getAttribute('href') === '#dila' && h === 'dila')));
  if (next !== 'home') { if (changed) scrollTo({top: 0, behavior: 'instant'}); return; }
  if (changed) { const s = $('.salon'); s && s._justify && s._justify(); const w = $('.walk'); w && w._lay && w._lay(); window._fx && window._fx(); }
  const el = h && document.getElementById(h);
  if (el) requestAnimationFrame(() => el.scrollIntoView({behavior: changed || reduced ? 'instant' : 'smooth'}));
  else if (changed && !first) scrollTo({top: homeY, behavior: 'instant'});
}
function openFromHash() {
  const m = location.hash.match(/^#dilo-(.+)$/);
  if (m) openWork(decodeURIComponent(m[1]), false); else if (!V.hidden) closeWork();
}

/* lupa a přiblížení */
stage.addEventListener('mousemove', e => {
  if (!fine) return;
  if (zoom) return pan(e);
  const r = vimg.getBoundingClientRect(), s = stage.getBoundingClientRect();
  const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  stage.classList.toggle('lens', inside);
  if (!inside) return;
  const Z = 3, L = 220;
  loupe.style.transform = `translate(${e.clientX - s.left - L / 2}px, ${e.clientY - s.top - L / 2}px)`;
  loupe.style.backgroundSize = `${r.width * Z}px ${r.height * Z}px`;
  loupe.style.backgroundPosition = `${-(e.clientX - r.left) * Z + L / 2}px ${-(e.clientY - r.top) * Z + L / 2}px`;
});
stage.addEventListener('mouseleave', () => stage.classList.remove('lens'));
stage.addEventListener('click', e => { if (moved) return; setZoom(!zoom, e); });
/* dotyk: posun při přiblížení, jinak swipe mezi díly */
let sx = 0, sy = 0, moved = false, startPx = .5, startPy = .5;
stage.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; moved = false; startPx = px; startPy = py; });
stage.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse' || !(e.buttons || e.pressure)) return;
  const dx = e.clientX - sx, dy = e.clientY - sy;
  if (Math.abs(dx) + Math.abs(dy) > 8) moved = true;
  if (zoom) { const r = stage.getBoundingClientRect(); px = Math.min(1, Math.max(0, startPx - dx / r.width * .7)); py = Math.min(1, Math.max(0, startPy - dy / r.height * .7)); pan(); }
});
stage.addEventListener('pointerup', e => {
  const dx = e.clientX - sx;
  if (!zoom && e.pointerType !== 'mouse' && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(e.clientY - sy)) step(dx < 0 ? 1 : -1);
  setTimeout(() => moved = false, 0);
});

/* velikost v prostoru */
const SC = $('.scale', V);
$('[data-scale]', V).onclick = showScale;
$('.scale-back', V).onclick = hideScale;
function hideScale() { SC.hidden = true; }
function showScale() {
  const w = WORKS[cur]; if (!ratio(w)) return;
  SC.hidden = false;
  const room = $('.scale-room', SC), art = $('.scale-art', SC), pl = $('.scale-plinth', SC), per = $('.scale-person', SC);
  const R = {width: room.clientWidth, height: room.clientHeight}, floorY = R.height * .86;
  const wallCm = 280, k = floorY / wallCm;
  const ww = w.width * k, hh = w.height * k;
  const flat = isFlat(w);
  art.src = img(w.images[0], 1000); art.onerror = () => { art.onerror = null; art.src = rel(w.images[0]); };
  art.className = 'scale-art' + (flat ? ' flat' : '');
  const cx = R.width * .58;
  let bottom;
  if (flat) { bottom = floorY - (150 * k + hh / 2); pl.hidden = true; }
  else {
    const ph = w.height > 120 ? 0 : 95 * k; pl.hidden = !ph;
    Object.assign(pl.style, {width: Math.max(ww * 1.25, 40 * k) + 'px', height: ph + 'px', left: cx - Math.max(ww * 1.25, 40 * k) / 2 + 'px', top: floorY - ph + 'px'});
    bottom = floorY - ph - hh;
  }
  Object.assign(art.style, {width: ww + 'px', height: hh + 'px', left: cx - ww / 2 + 'px', top: bottom + 'px', bottom: 'auto', objectFit: flat ? 'cover' : 'contain'});
  const pw = 60 * k * (175 / 175), ph2 = 175 * k;
  Object.assign(per.style, {height: ph2 + 'px', width: ph2 * 60 / 175 + 'px', left: Math.max(8, cx - ww / 2 - ph2 * .62) + 'px', top: floorY - ph2 + 'px'});
  $('.scale-cap', SC).textContent = `${w.title}: ${dims(w)} vedle postavy vysoké 175 cm.` + (flat ? ' Střed díla ve výšce 150 cm, jak se věší v galerii.' : '');
}
addEventListener('resize', () => { if (!SC.hidden) showScale(); });

/* ---------- Formulář ---------- */
function buildForm() {
  const sel = $('#f-dilo');
  sel.insertAdjacentHTML('beforeend', WORKS.filter(w => !w.project).map(w => `<option>${esc(w.title)}</option>`).join(''));
  const form = $('.form'), msg = $('.form-msg');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const n = $('#f-jmeno'), em = $('#f-email');
    if (!n.value.trim() || !/^\S+@\S+\.\S+$/.test(em.value)) { msg.textContent = 'Vyplňte prosím jméno a platný e-mail.'; (!n.value.trim() ? n : em).focus(); return; }
    const btn = $('button[type=submit]', form); btn.disabled = true; msg.textContent = 'Odesílám…';
    try {
      const r = await fetch('/', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams(new FormData(form)).toString()});
      if (!r.ok) throw 0;
      form.reset(); msg.textContent = 'Děkujeme, zpráva dorazila. Ozveme se co nejdřív.';
    } catch { msg.textContent = `Zprávu se nepodařilo odeslat. Napište prosím přímo na ${SITE.email || 'e-mail níže'}.`; }
    btn.disabled = false;
  });
}

/* ---------- Pohyb a navigace ---------- */
function reveal() {
  $$('.works-head h2, .author h2, .contact h2, .outro h2').forEach(h => {
    h.innerHTML = h.innerHTML.split(/<br\s*\/?>/).map(l => `<span class="mask"><span>${l}</span></span>`).join('');
    if (h.closest('.hero')) setTimeout(() => $$('.mask', h).forEach(m => m.classList.add('in')), reduced ? 0 : 200);
    else h.classList.add('rv');
  });
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), {rootMargin: '0px 0px -8% 0px'});
  $$('.rv').forEach(el => io.observe(el));
  const words = $$('.statement .w');
  if (words.length) addEventListener('scroll', () => {
    const r = $('.statement').getBoundingClientRect(), p = Math.min(1, Math.max(0, (innerHeight * .85 - r.top) / (r.height * .8)));
    words.forEach((w, i) => w.classList.toggle('on', i / words.length < p));
  }, {passive: true});
}
const top = $('.top'); let ly = 0;
addEventListener('scroll', () => {
  const y = scrollY;
  top.classList.toggle('scrolled', y > 40);
  top.classList.toggle('hide', y > 300 && y > ly && $('.mnav').hidden);
  ly = y;
}, {passive: true});
$('.brand').addEventListener('click', e => {
  e.preventDefault(); if (!V.hidden) closeWork();
  if (view !== 'home') { history.pushState(null, '', location.pathname + location.search); route(); }
  scrollTo({top: 0, behavior: reduced ? 'auto' : 'smooth'});
});
const mb = $('.menu-btn'), mn = $('.mnav');
mb.onclick = () => { const o = mn.hidden; mn.hidden = !o; mb.setAttribute('aria-expanded', o); mb.textContent = o ? 'Zavřít' : 'Menu'; document.body.style.overflow = o ? 'hidden' : ''; };
mn.addEventListener('click', e => { if (e.target.tagName === 'A') mb.click(); });

if (fine) {
  const c = $('.cursor'); let mx = -100, my = -100, cx = -100, cy = -100, run = false;
  const loop = () => { cx += (mx - cx) * .28; cy += (my - cy) * .28; c.style.transform = `translate3d(${cx}px, ${cy}px, 0)`; run = Math.abs(mx - cx) + Math.abs(my - cy) > .2; if (run) requestAnimationFrame(loop); else { cx = mx; cy = my; c.style.transform = `translate3d(${cx}px, ${cy}px, 0)`; } };
  addEventListener('mousemove', e => {
    if (cx < -50) { cx = e.clientX; cy = e.clientY; }
    mx = e.clientX; my = e.clientY;
    const t = e.target, show = V.hidden && !t.closest('input, textarea, select');
    c.classList.toggle('on', show);
    c.classList.toggle('big', show && !!t.closest('.hung, .proj-img') && !t.closest('.wall'));
    c.classList.toggle('lt', !!t.closest('.walk'));
    if (!run) { run = true; requestAnimationFrame(loop); }
  }, {passive: true});
  document.addEventListener('mouseleave', () => c.classList.remove('on'));
  addEventListener('blur', () => c.classList.remove('on'));
}

/* ---------- Scrollem řízené efekty (jako ve Frameru: pohyb je svázaný s posunem stránky) ---------- */
const ease = t => 1 - Math.pow(1 - t, 3);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const FX = [];
function scrollFx() {
  $$('.salon .piece').forEach(p => {
    const h = $('.hung', p), im = $('img', h), lab = $('.label', p);
    FX.push(() => {
      if (p.classList.contains('gone')) return;
      const r = p.getBoundingClientRect(), vh = innerHeight;
      const lag = (r.left / innerWidth) * 60;                       // vpravo o kousek později = vlna přes řadu
      const e = reduced ? 1 : ease(clamp((vh - r.top - lag) / (vh * .55)));
      const k = 1 - e;
      h.style.clipPath = k < .001 ? 'none' : `inset(${k * 18}% ${k * 10}% ${k * 18}% ${k * 10}%)`;
      im.style.transform = k < .001 ? '' : `scale(${1 + k * .18})`;
      lab.style.opacity = clamp(e * 1.6 - .6);
      lab.style.transform = `translateY(${k * 24}px)`;
    });
  });
  let tick = false;
  const run = () => { tick = false; FX.forEach(f => f()); };
  const req = () => { if (!tick) { tick = true; requestAnimationFrame(run); } };
  addEventListener('scroll', req, {passive: true}); addEventListener('resize', req); run();
  window._fx = run;
}

/* ---------- Noční procházka cyklem ---------- */
function buildWalk() {
  const cfg = SITE.walk || {}, sec = $('.walk');
  const list = WORKS.filter(w => !w.project && isFlat(w) && ((cfg.series || []).includes(w.series) || (cfg.series || []).includes(w.theme)));
  if (list.length < 2) return;
  sec.hidden = false;
  $('.walk-title', sec).textContent = cfg.title || '';
  $('.walk-text', sec).textContent = cfg.text || '';
  $('.walk-track', sec).innerHTML = list.map(w => `<figure class="wk"><i class="lamp"></i>
    <button class="hung" data-open="${w.slug}" aria-label="${esc(w.title)}"><img alt="${esc(w.title)}" draggable="false"></button>
    <figcaption class="cap"><b>${esc(w.title)}</b>${[w.place, w.year, dims(w)].filter(Boolean).map(esc).join(' · ')}</figcaption></figure>`).join('');
  const wimgs = $$('.wk img', sec);
  wimgs.forEach((im, k) => {
    const w = list[k];
    im.addEventListener('load', () => {
      if (w.frame) { const h = im.clientHeight, W = arEff(w, im.naturalWidth / im.naturalHeight) * h; im.style.width = W + 'px'; applyFrame(im, w, W, h); }
      applyTilt(im.parentElement, w, im.offsetWidth, im.offsetHeight);
      sec._lay && sec._lay();
    });
  });
  // obrázky cyklu se načtou, až se k sekci přiblížíte (rychlejší start stránky)
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); wimgs.forEach((im, k) => safeImg(im, list[k].images[0], 1000, '60vw')); } }, {rootMargin: '900px 0px'});
  io.observe(sec);
  walkCarousel(sec);
}

/* Karusel: vodorovný posun (šipky, tažení myší, swipe, klávesy); stránka se dál scrolluje normálně */
function walkCarousel(sec) {
  const T = $('.walk-track', sec), items = $$('.wk', sec), bar = $('.walk-bar', sec), cnt = $('.walk-count', sec);
  const prev = $('.walk-btn.prev', sec), next = $('.walk-btn.next', sec);
  const center = it => it.offsetLeft + it.offsetWidth / 2 - T.clientWidth / 2;
  let active = 0;
  const update = () => {
    const max = T.scrollWidth - T.clientWidth, mid = T.scrollLeft + T.clientWidth / 2;
    bar.style.setProperty('--p', max > 0 ? clamp(T.scrollLeft / max) : 0);
    let best = 0, bd = 1e9;
    items.forEach((it, k) => {
      const d = Math.abs(it.offsetLeft + it.offsetWidth / 2 - mid);
      if (d < bd) { bd = d; best = k; }
      it.style.setProperty('--l', reduced ? 1 : (1 - clamp(d / (T.clientWidth * .45))) ** 1.6);
    });
    active = best;
    cnt.textContent = `${best + 1} / ${items.length}`;
    prev.disabled = T.scrollLeft < 4; next.disabled = T.scrollLeft > max - 4;
  };
  const lay = () => {
    const W = T.clientWidth, f = items[0], l = items[items.length - 1];
    T.style.paddingLeft = Math.max(0, (W - f.offsetWidth) / 2) + 'px';
    T.style.paddingRight = Math.max(0, (W - l.offsetWidth) / 2) + 'px';
    if (!T._init) { T._init = true; T.scrollLeft = 0; }
    update();
  };
  sec._lay = lay;
  const go = k => { k = clamp(k, 0, items.length - 1); T.scrollTo({left: center(items[k]), behavior: reduced ? 'auto' : 'smooth'}); };
  prev.onclick = () => go(active - 1);
  next.onclick = () => go(active + 1);
  T.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); go(active + (e.key === 'ArrowRight' ? 1 : -1)); } });
  let tick = false;
  T.addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(() => { tick = false; update(); }); } }, {passive: true});
  addEventListener('resize', lay);
  // tažení myší (dotyk a trackpad posouvají nativně)
  let d = null, moved = false;
  T.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    d = {x: e.clientX, s: T.scrollLeft, t: performance.now(), v: 0}; moved = false;
  });
  addEventListener('pointermove', e => {
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!moved && Math.abs(dx) > 5) { moved = true; T.classList.add('drag'); }
    if (!moved) return;
    const now = performance.now(), nl = d.s - dx;
    d.v = (nl - T.scrollLeft) / Math.max(1, now - d.t); d.t = now;
    T.scrollLeft = nl;
  });
  const end = () => {
    if (!d) return;
    const v = d.v; d = null;
    if (!moved) return;
    T.classList.remove('drag');
    // dojezd na nejbližší obraz ve směru pohybu
    const mid = T.scrollLeft + T.clientWidth / 2 + v * 180;
    let best = 0, bd = 1e9;
    items.forEach((it, k) => { const dd = Math.abs(it.offsetLeft + it.offsetWidth / 2 - mid); if (dd < bd) { bd = dd; best = k; } });
    go(best);
    setTimeout(() => { moved = false; }, 50);
  };
  addEventListener('pointerup', end); addEventListener('pointercancel', end);
  T.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
  T.addEventListener('dragstart', e => e.preventDefault());
  lay();
}

/* ---------- Den / Noc ---------- */
{
  const btn = $('.mode');
  const set = on => { document.body.classList.toggle('dark', on); btn.setAttribute('aria-pressed', on); $('span', btn).textContent = on ? 'Den' : 'Noc'; btn.setAttribute('aria-label', on ? 'Denní prohlídka' : 'Noční prohlídka'); try { localStorage.setItem('mode', on ? 'dark' : 'light'); } catch {} };
  let saved = null; try { saved = localStorage.getItem('mode'); } catch {}
  if (saved === 'dark') set(true);
  btn.onclick = () => set(!document.body.classList.contains('dark'));
}

/* ---------- 3D deska ---------- */
const B3 = $('.box3d', V), cube = $('.cube', B3);
let rx = -6, ry = -32;
const rot = () => cube.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
function show3d(on) {
  const w = WORKS[cur]; B3.hidden = !on; $('[data-3d]', V).setAttribute('aria-pressed', on);
  if (!on) return;
  showCompare(false);
  const st = $('.v-img', V).getBoundingClientRect();
  const ar = ratio(w), fw = Math.min(st.width * .62, st.height * .62 * ar), fh = fw / ar;
  const k = fw / w.width, D = Math.max(6, (Number(w.depth) || 2.5) * k);
  const faces = {front: [fw, fh, `translateZ(${D / 2}px)`], back: [fw, fh, `rotateY(180deg) translateZ(${D / 2}px)`],
    left: [D, fh, `rotateY(-90deg) translateZ(${fw / 2}px)`], right: [D, fh, `rotateY(90deg) translateZ(${fw / 2}px)`],
    top: [fw, D, `rotateX(90deg) translateZ(${fh / 2}px)`], bottom: [fw, D, `rotateX(-90deg) translateZ(${fh / 2}px)`]};
  Object.entries(faces).forEach(([n, [a, b, t]]) => Object.assign($('.' + n, cube).style, {width: a + 'px', height: b + 'px', marginLeft: -a / 2 + 'px', marginTop: -b / 2 + 'px', transform: t}));
  $('.front', cube).classList.toggle('fr', !!w.frame); $('.front', cube).style.setProperty('--fw', Math.max(5, Math.min(fw, fh) * .05) + 'px');
  $('.front', cube).style.backgroundImage = `url("${img(w.images[0], 1600)}"), url("${rel(w.images[0])}")`;
  rx = 0; ry = 0; cube.classList.remove('drag'); rot();
  requestAnimationFrame(() => requestAnimationFrame(() => { rx = -8; ry = -34; rot(); }));
}
{
  let d = null;
  B3.addEventListener('pointerdown', e => { d = {x: e.clientX, y: e.clientY, rx, ry}; cube.classList.add('drag'); B3.setPointerCapture(e.pointerId); });
  B3.addEventListener('pointermove', e => { if (!d) return; ry = clamp(d.ry + (e.clientX - d.x) * .35, -75, 75); rx = clamp(d.rx - (e.clientY - d.y) * .25, -45, 45); rot(); });
  const up = () => { if (!d) return; d = null; cube.classList.remove('drag'); };
  B3.addEventListener('pointerup', up); B3.addEventListener('pointercancel', up);
  $('[data-3d]', V).onclick = () => show3d(B3.hidden);
}

/* ---------- Jak vznikalo: posuvné srovnání ---------- */
const CMP = $('.compare', V);
function showCompare(on) {
  const w = WORKS[cur]; CMP.hidden = !on; $('[data-process]', V).setAttribute('aria-pressed', on);
  if (!on) return;
  B3.hidden = true; $('[data-3d]', V).setAttribute('aria-pressed', false);
  const pr = (w.process || [])[0];
  $('.c-before', CMP).src = img(pr.image, 1600); $('.c-before', CMP).onerror = function () { this.onerror = null; this.src = rel(pr.image); };
  const a = $('.c-after img', CMP); a.src = img(w.images[0], 1600); a.onerror = function () { this.onerror = null; this.src = rel(w.images[0]); };
  $('.c-lab.l', CMP).textContent = pr.label || 'Skica';
  setX(reduced ? 50 : 92); if (!reduced) setTimeout(() => { CMP.style.transition = '--x 0s'; animX(92, 50); }, 300);
}
const setX = v => { CMP.style.setProperty('--x', v + '%'); $('.c-handle', CMP).setAttribute('aria-valuenow', Math.round(v)); };
function animX(from, to) { const t0 = performance.now(); const f = t => { const p = clamp((t - t0) / 1100); setX(from + (to - from) * ease(p)); if (p < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); }
{
  let on = false;
  const move = e => { const r = CMP.getBoundingClientRect(); setX(clamp((e.clientX - r.left) / r.width, .02, .98) * 100); };
  CMP.addEventListener('pointerdown', e => { on = true; CMP.setPointerCapture(e.pointerId); move(e); });
  CMP.addEventListener('pointermove', e => on && move(e));
  CMP.addEventListener('pointerup', () => on = false);
  $('.c-handle', CMP).addEventListener('keydown', e => { const v = parseFloat(CMP.style.getPropertyValue('--x')) || 50; if (e.key === 'ArrowLeft') setX(Math.max(2, v - 5)); if (e.key === 'ArrowRight') setX(Math.min(98, v + 5)); });
  $('[data-process]', V).onclick = () => showCompare(CMP.hidden);
}
load();
}
