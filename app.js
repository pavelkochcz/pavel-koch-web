{
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Obrázky: Netlify Image CDN jen na *.netlify.app; na GitHub Pages a v náhledu se použije originál. */
const useCdn = /\.netlify\.app$/.test(location.hostname);
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

let SITE = {}, WORKS = [], PROJ = [];
const setHash = h => { try { history.replaceState(null, '', location.pathname + location.search + h); } catch { if (location.hash !== h) location.hash = h || 'uvod'; } };
const CATS = ['Malba a socha', 'Výstavy a expozice', 'Scénografie a film', 'Restaurování', 'Ilustrace a návrhy'];
const catSlug = c => slugify(c);
/* řazení podle let: nejnovější nahoře, bez roku na konci, jinak původní pořadí */
const yr = x => { const m = String((x && x.year) ?? '').match(/\d{4}/); return m ? +m[0] : 0; };
const byYear = L => L.map((x, i) => [x, i]).sort((a, b) => (yr(b[0]) - yr(a[0])) || (a[1] - b[1])).map(a => a[0]);

async function load() {
  const get = async p => { const r = await fetch(p, {cache: 'no-store'}); if (!r.ok) throw new Error(p); return r.json(); };
  try {
    let P;
    [SITE, {works: WORKS}, P] = await Promise.all([get('content/site.json'), get('content/works.json'), get('content/projects.json').catch(() => ({projects: []}))]);
    PROJ = (P.projects || []).filter(p => p && p.title);
  } catch (e) { console.error('Obsah se nenačetl', e); return; }
  const used = {};
  WORKS = (WORKS || []).filter(w => w && !w.hidden && w.title && w.images && w.images.length).map((w, i) => {
    let s = slugify(w.title); used[s] = (used[s] || 0) + 1; if (used[s] > 1) s += '-' + used[s];
    return {...w, slug: s, i, group: w.theme || w.series || w.category || 'Ostatní'};
  });
  PROJ.forEach(p => { p.slug = slugify(p.title); const L = WORKS.filter(w => w.folder === p.title); p.cover = p.cover || (L[0] && L[0].images[0]) || ''; p.works = byYear(L); });
  // díla bez složky nebo se složkou, která v seznamu projektů chybí, se nikde neztratí
  const orphans = WORKS.filter(w => !PROJ.some(p => p.title === w.folder));
  if (orphans.length) PROJ.push({title: 'Další díla', slug: 'dalsi-dila', category: 'Malba a socha', works: byYear(orphans), cover: orphans[0].images[0]});
  fillSite(); buildNav(); buildIndex(); buildTime(); intro(); buildForm(); reveal(); scrollFx(); route(true); openFromHash();
}

function fillSite() {
  const S = SITE;
  $$('[data-name]').forEach(e => e.textContent = S.name || '');
  $$('[data-disciplines]').forEach(e => e.textContent = S.disciplines || '');
  $$('[data-titles]').forEach(t => t.textContent = [S.titles, S.name].filter(Boolean).join(' '));
  if (S.name) document.title = `${S.name} – ${(S.disciplines || '').toLowerCase().replace(/ · /g, ', ')}`;
  $('[data-bio]').innerHTML = (S.bio || '').split(/\n\s*\n/).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('');
  const q = $('[data-quote]'); if (q) { if (S.quote) q.textContent = `„${S.quote}“`; else q.remove(); }
  $('.cv').innerHTML = byYear(S.cv || []).map(c => {
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

/* ---------- Díla ---------- */
/* Zavěšení děl ve složce: zarovnané řady, díla ve skutečném poměru stran */
function hang(sal, ART) {
  sal.innerHTML = ART.map(w => {
    const meta = [w.technique, dims(w)].filter(Boolean).map(esc).join(', ');
    return `<figure class="piece" data-k="${w.i}">
      <button class="hung ${isFlat(w) ? 'is-flat' : ''}" data-open="${w.slug}" aria-label="Otevřít: ${esc(w.title)}"><img alt="${esc(w.title)}" loading="lazy"></button>
      <figcaption class="label"><b>${esc(w.title)}</b>${w.year ? esc(w.year) + '<br>' : ''}${meta}${meta ? '<br>' : ''}${w.status ? `<span class="st"><i class="dot ${statusCls(w.status)}"></i>${esc(w.status)}</span>` : ''}</figcaption>
    </figure>`;
  }).join('');
  const AR = {};
  ART.forEach(w => { if (ratio(w)) AR[w.i] = ratio(w); });
  const justify = () => {
    const W = sal.clientWidth; if (!W) return;
    const one = ART.length === 1, mobile = W < 560, gap = mobile ? 16 : Math.max(28, W * .035);
    const minW = mobile ? 0 : 150;
    const target = one ? Math.min(560, innerHeight * .62) : mobile ? W * .46 : Math.min(290, Math.max(200, W * .19)), perRow = mobile ? 2 : 4;
    let row = [], sum = 0;
    const flush = (last) => {
      if (!row.length) return;
      let h = (W - 2 - gap * (row.length - 1) - row.reduce((a, [, ar]) => a + Math.max(0, minW - ar * target), 0)) / sum;
      h = Math.min(h, target * (last ? 1.1 : 1.25));
      row.forEach(([p, ar]) => {
        const w = WORKS[p.dataset.k], im = $('img', p);
        const pw = ar * h, ph = h;
        p.style.width = Math.max(pw, minW) + 'px'; $('.hung', p).style.width = pw + 'px'; im.style.height = ph + 'px';
        applyFrame(im, w, pw, ph); applyTilt($('.hung', p), w, pw, ph);
      });
      row = []; sum = 0;
    };
    $$('.piece', sal).forEach(p => {
      const w = WORKS[p.dataset.k], ar = arEff(w, AR[w.i] || .75);
      if (mobile && ar > 1.7) { flush(); row = [[p, ar]]; sum = ar; flush(); return; }
      row.push([p, ar]); sum += ar;
      if (row.reduce((a, [, r]) => a + Math.max(r * target, minW), 0) + gap * (row.length - 1) >= W * .9 || row.length === perRow) flush();
    });
    flush(true);
  };
  $$('.piece', sal).forEach(p => {
    const w = WORKS[p.dataset.k], im = $('img', p);
    safeImg(im, w.images[0], 1200, '(max-width:800px) 92vw, 40vw');
    im.addEventListener('load', () => { const a = im.naturalWidth / im.naturalHeight; if (!AR[w.i] || !isFlat(w) || !ratio(w)) { AR[w.i] = a; justify(); window._fx && window._fx(); } });
  });
  justify();
  if (sal._ro) sal._ro.disconnect();
  sal._ro = new ResizeObserver(justify); sal._ro.observe(sal);
}

/* ---------- Lišta a rozcestník ---------- */
const catsUsed = () => CATS.filter(c => PROJ.some(p => p.category === c));
const tiles = p => !!(p.works.length || p.video);
function buildNav() {
  const links = catsUsed().map(c => `<a href="#kat-${catSlug(c)}">${esc(c)}</a>`).join('') + '<a href="#cas">Časová osa</a><a href="#autor">O autorovi</a><a href="#kontakt">Kontakt</a>';
  $$('[data-catnav]').forEach(n => n.innerHTML = links);
}
function buildIndex() {
  $('[data-index]').innerHTML = catsUsed().map((c, k) => {
    const L = PROJ.filter(p => p.category === c), withImg = L.filter(p => p.cover);
    const n = L.length, word = n === 1 ? 'projekt' : n < 5 ? 'projekty' : 'projektů';
    return `<li><a href="#kat-${catSlug(c)}"><span class="ix-n">${String(k + 1).padStart(2, '0')}</span><span class="ix-t">${esc(c)}</span><span class="ix-c">${n} ${word}</span>
      <span class="ix-peek" aria-hidden="true">${withImg.slice(0, 3).map(p => `<img alt="" loading="lazy" data-src="${esc(p.cover)}">`).join('')}</span></a></li>`;
  }).join('');
  $$('[data-index] img').forEach(im => safeImg(im, im.dataset.src, 500, '160px'));
}

/* ---------- Kategorie: mřížka projektů (složek), pod ní realizace bez fotek ---------- */
function showCat(slug) {
  const c = CATS.find(x => catSlug(x) === slug); if (!c) return false;
  const sec = $('.cat'), L = PROJ.filter(p => p.category === c), T = byYear(L.filter(tiles)), R = byYear(L.filter(p => !tiles(p)));
  $('.crumb', sec).innerHTML = `<a href="#uvod">Úvod</a> / ${esc(c)}`;
  $('.cat-title', sec).textContent = c;
  const g = $('.cat-grid', sec);
  g.hidden = !T.length;
  g.innerHTML = T.map(p => {
    const n = p.works.length, cnt = p.video && !n ? 'video' : `${n} ${n === 1 ? 'dílo' : n < 5 ? 'díla' : 'děl'}`;
    return `<a class="tile" href="#projekt-${p.slug}"><span class="tile-img">${p.cover ? '<img alt="" loading="lazy">' : ''}${p.video ? '<i class="tile-play" aria-hidden="true"></i>' : ''}</span>
      <span class="tile-cap"><span class="tile-n">${String(T.indexOf(p) + 1).padStart(2, '0')}</span><span class="tile-t">${esc(p.title)}</span><span class="tile-m">${esc([p.year, cnt].filter(Boolean).join(' · '))}</span></span></a>`;
  }).join('');
  $$('.tile', g).forEach((t, k) => { const im = $('img', t); if (im) safeImg(im, T[k].cover, 900, '(max-width:800px) 92vw, 30vw'); });
  const more = $('.cat-more', sec);
  more.hidden = !R.length;
  $('.cat-more-h', sec).textContent = T.length ? 'Další realizace' : 'Realizace';
  $('.cat-list', sec).innerHTML = R.map(p => `<li><b>${esc(p.title)}</b><span>${esc([p.year, p.place, p.role].filter(Boolean).join(' · '))}</span>${p.link ? `<a href="${esc(p.link)}" target="_blank" rel="noopener">web výstavy ↗</a>` : ''}</li>`).join('');
  return true;
}

/* ---------- Složka projektu ---------- */
let curProj = null;
function showProject(slug) {
  const p = PROJ.find(x => x.slug === slug); if (!p) return false;
  curProj = p;
  const sec = $('.folder');
  $('.crumb', sec).innerHTML = `<a href="#uvod">Úvod</a> / <a href="#kat-${catSlug(p.category)}">${esc(p.category)}</a>`;
  $('.fold-title', sec).textContent = p.title;
  $('.fold-meta', sec).innerHTML = [['Rok', p.year], ['Místo', p.place], ['Role', p.role]].filter(r => r[1]).map(([a, b]) => `<dt>${a}</dt><dd>${esc(b)}</dd>`).join('');
  const tx = $('.fold-text', sec); tx.textContent = p.text || ''; tx.hidden = !p.text;
  const ln = $('.fold-link', sec); ln.hidden = !p.link; if (p.link) { ln.href = p.link; ln.textContent = 'Web výstavy ↗'; }
  const fv = $('.fold-video', sec), v = $('video', fv);
  fv.hidden = !p.video;
  if (p.video) { if (v.dataset.src !== p.video) { v.dataset.src = p.video; v.src = rel(p.video); v.poster = p.cover ? rel(p.cover) : ''; } v.play().catch(() => {}); } else { v.pause(); }
  const sal = $('.salon', sec); sal.hidden = !p.works.length;
  hang(sal, p.works);
  const sib = PROJ.filter(x => x.category === p.category && tiles(x)), k = sib.indexOf(p);
  const nx = sib.length > 1 ? sib[(k + 1) % sib.length] : null;
  $('.fold-nav', sec).innerHTML = `<a class="back" href="#kat-${catSlug(p.category)}">← ${esc(p.category)}</a>${nx ? `<a class="fold-next" href="#projekt-${nx.slug}"><small>Další složka</small>${esc(nx.title)} →</a>` : ''}`;
  return true;
}

/* ---------- Časová osa: tvorba rok po roku (rail nahoře, roky se rozbalují) ---------- */
function buildTime() {
const sec = $('.time'); if (!sec) return;
const Y = {};
const slot = y => Y[y] = Y[y] || {items: [], works: []};
const span = s => /\d{4}\D+\d{4}|dosud/.test(String(s || '')) ? String(s) : '';
PROJ.forEach(p => { const y = yr(p); if (!y || p.slug === 'dalsi-dila') return;
slot(y).items.push({kind: p.category, title: p.title, sub: [span(p.year), p.place, p.role].filter(Boolean).join(' · '), href: tiles(p) ? '#projekt-' + p.slug : '#kat-' + catSlug(p.category)}); });
(SITE.milestones || []).forEach(m => { const y = yr(m); if (y) slot(y).items.push({kind: m.kind || 'Působení', title: m.text, sub: span(m.year)}); });
WORKS.forEach(w => { const y = yr(w); if (y) slot(y).works.push(w); });
const years = Object.keys(Y).map(Number).sort((a, b) => b - a);
if (!years.length) return;
const now = new Date().getFullYear(), a0 = Math.floor(Math.min(...years) / 10) * 10, a1 = Math.max(now, ...years), len = a1 - a0 || 1;
let marks = '';
for (let y = a0; y <= a1; y++) {
const d = Y[y], x = ((y - a0) / len * 100).toFixed(2) + '%';
marks += d ? `<button class="tr-dot" data-y="${y}" style="--x:${x};--n:${Math.min(6, d.items.length + Math.ceil(d.works.length / 4))}" aria-label="Rok ${y}"><span>${y}</span></button>`
: `<i class="${y % 10 ? 'tr-tick' : 'tr-dec'}" style="--x:${x}">${y % 10 ? '' : '<span>' + y + '</span>'}</i>`;
}
const rail = $('.time-rail', sec), list = $('.time-list', sec);
rail.innerHTML = `<div class="tr-line">${marks}</div>`;
const word = n => n === 1 ? 'obraz' : n < 5 ? 'obrazy' : 'obrazů';
list.innerHTML = years.map(y => {
const d = Y[y], n = d.works.length, t = d.items.map(i => i.title);
const sum = [t.slice(0, 2).join(' · ') + (t.length > 2 ? ' a další' : ''), n ? n + ' ' + word(n) : ''].filter(Boolean).join(' — ');
return `<li class="ty" id="rok-${y}" data-y="${y}"><button class="ty-h" aria-expanded="false"><span class="ty-y">${y}</span><span class="ty-s">${esc(sum)}</span><i class="ty-i" aria-hidden="true"></i></button>
<div class="ty-b"><div class="ty-in"><div class="ty-c">
${d.items.length ? `<ul class="ty-items">${d.items.map(i => `<li><small>${esc(i.kind)}</small>${i.href ? `<a href="${i.href}">${esc(i.title)}</a>` : `<b>${esc(i.title)}</b>`}${i.sub ? `<span>${esc(i.sub)}</span>` : ''}</li>`).join('')}</ul>` : ''}
${n ? `<div class="ty-works">${d.works.map((w, k) => `<button class="ty-w" data-open="${w.slug}" style="--t:${tiltOf(w)}deg;--k:${k}" aria-label="Otevřít: ${esc(w.title)}"><img alt="" data-src="${esc(w.images[0])}"><span>${esc(w.title)}</span></button>`).join('')}</div>` : ''}
</div></div></div></li>`;
}).join('');
const sync = () => $$('.tr-dot', rail).forEach(b => b.classList.toggle('on', !!$('#rok-' + b.dataset.y + '.open', list)));
const toggle = (li, on) => {
on = on ?? !li.classList.contains('open');
li.classList.toggle('open', on); $('.ty-h', li).setAttribute('aria-expanded', on);
if (on) $$('img[data-src]', li).forEach(im => { safeImg(im, im.dataset.src, 500, '190px'); im.removeAttribute('data-src'); });
sync();
};
list.addEventListener('click', e => { const h = e.target.closest('.ty-h'); if (h) toggle(h.parentElement); });
rail.addEventListener('click', e => {
const b = e.target.closest('.tr-dot'); if (!b) return;
const li = $('#rok-' + b.dataset.y, list); toggle(li, true);
li.scrollIntoView({behavior: reduced ? 'auto' : 'smooth', block: 'start'});
});
toggle($('.ty', list).find(li => $('.ty-works', li)) || $('.ty', list), true); // otevřený je nejnovější rok s obrazy
// rok, který je právě na obrazovce, se na ose zvýrazní
const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; $$('.tr-dot', rail).forEach(b => b.classList.toggle('cur', b.dataset.y === e.target.dataset.y)); const c = $('.tr-dot.cur', rail); if (c && rail.scrollWidth > rail.clientWidth) rail.scrollTo({left: c.offsetLeft - rail.clientWidth / 2, behavior: 'smooth'}); }), {rootMargin: '-45% 0px -50% 0px'});
$$('.ty', list).forEach(li => io.observe(li));
}

/* ---------- Úvod: video uvnitř loga, posunem se logo rozevře ---------- */
function intro() {
  const sec = $('.intro'), veil = $('.intro-veil'), vid = $('.intro-vid');
  if (!sec) return;
  vid.play && vid.play().catch(() => {});
  const lay = () => {
    const vw = innerWidth, vh = innerHeight;
    const L = Math.min(vw * (vw < 700 ? .9 : .84), 1500), H = L * 218 / 791;
    sec.style.setProperty('--lw', L + 'px');
    // bod uprostřed loga (uvnitř písmene, nejtlustší místo) – kolem něj se logo zvětšuje, až otevře celé video
    veil.style.transformOrigin = `${(vw - L) / 2 + L * .4861}px ${(vh - H) / 2 + H * .4839}px`;
  };
  const run = () => {
    if (view !== 'home') return;
    const r = sec.getBoundingClientRect(), span = sec.offsetHeight - innerHeight;
    const p = reduced ? 0 : clamp(-r.top / Math.max(1, span));
    const op = 1 - clamp((p - .55) / .3);
    veil.style.transform = p > 0 ? `scale(${(1 + 13 * p * p).toFixed(3)})` : '';
    veil.style.opacity = op.toFixed(3);
    veil.style.visibility = op <= 0 ? 'hidden' : '';
    sec.style.setProperty('--p', p.toFixed(3)); sec.classList.toggle('end', p > .85);
    top.classList.toggle('over', r.bottom > 60); top.classList.toggle('vid', op < .5);
    if (r.bottom < 0) { if (!vid.paused) vid.pause(); } else if (vid.paused) vid.play().catch(() => {});
  };
  lay(); run();
  addEventListener('resize', () => { lay(); run(); });
  addEventListener('scroll', run, {passive: true});
  sec._run = run;
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
  if (push && location.hash !== '#dilo-' + slug) setHash('#dilo-' + slug);
  V.focus({preventScroll: true});
}
function closeWork() {
  V.classList.remove('open'); hideScale();
  setTimeout(() => { V.hidden = true; document.body.style.overflow = ''; }, reduced ? 0 : 400);
  setHash(view !== 'home' ? '#' + view : '');
  if (view.startsWith('projekt-')) document.title = `${curProj ? curProj.title + ' – ' : ''}${SITE.name || ''}`;
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
  $('.v-cat', V).textContent = [w.folder || w.category].filter(Boolean).join(' · ');
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
const peers = () => { const f = WORKS[cur].folder; const L = byYear(WORKS.filter(x => x.folder === f)); return L.length ? L : WORKS; };
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
function goHome() {
  homeY = 0;
  if (view !== 'home' || location.hash) { if (location.hash === '#uvod') route(); else location.hash = 'uvod'; }
  scrollTo({top: 0, behavior: 'instant'});
  requestAnimationFrame(() => scrollTo({top: 0, behavior: 'instant'}));
}
addEventListener('hashchange', () => { if (location.hash === '#uvod' || location.hash === '#top') homeY = 0; route(); openFromHash(); });
/* ---------- Stránky: úvod, kategorie (#kat-…), složka projektu (#projekt-…), autor, kontakt ---------- */
let view = 'home', homeY = 0;
function route(first) {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith('dilo-')) {
    // dílo otevřené odkazem: pod něj otevřít jeho složku
    if (first) { const w = WORKS.find(x => 'dilo-' + x.slug === h), p = w && PROJ.find(x => x.title === w.folder); if (p && showProject(p.slug)) { view = 'projekt-' + p.slug; document.body.dataset.view = 'projekt'; } else document.body.dataset.view = view; }
    return;
  }
  let next = 'home', kind = 'home';
  if (h === 'autor' || h === 'kontakt' || h === 'cas') { next = kind = h; }
  else if (h.startsWith('kat-') && showCat(h.slice(4))) { next = h; kind = 'kategorie'; }
  else if (h.startsWith('projekt-') && showProject(h.slice(8))) { next = h; kind = 'projekt'; }
  const changed = next !== view || first;
  if (next !== view && view === 'home') homeY = scrollY;
  view = next; document.body.dataset.view = kind;
  if (kind !== 'projekt') { const v = $('.fold-video video'); v && v.pause(); }
  const cat = kind === 'kategorie' ? h.slice(4) : kind === 'projekt' && curProj ? catSlug(curProj.category) : '';
  $$('.nav a, .mnav a').forEach(a => a.toggleAttribute('aria-current', a.getAttribute('href') === '#' + next || (cat && a.getAttribute('href') === '#kat-' + cat)));
  const nm = SITE.name || 'Pavel Koch';
  document.title = kind === 'kategorie' ? `${$('.cat-title').textContent} – ${nm}` : kind === 'projekt' ? `${curProj.title} – ${nm}` : kind === 'autor' ? `O autorovi – ${nm}` : kind === 'kontakt' ? `Kontakt – ${nm}` : kind === 'cas' ? `Časová osa – ${nm}` : `${nm} – malba, výstavní architektura, scénografie`;
  if (next !== 'home') { top.classList.remove('over'); if (changed) scrollTo({top: 0, behavior: 'instant'}); window._fx && window._fx(); return; }
  if (changed && !first) scrollTo({top: homeY, behavior: 'instant'});
  const s = $('.intro'); s && s._run && s._run();
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
    const dilo = $('#f-dilo').value, zprava = $('#f-zprava').value.trim();
    const subject = dilo ? `Zájem o dílo: ${dilo}` : 'Dotaz z webu pavelkoch.cz';
    const body = [zprava, '', `${n.value.trim()}`, em.value.trim()].join('\n');
    location.href = `mailto:${SITE.email || 'pavelkoch@seznam.cz'}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    msg.textContent = `Otevírá se váš e-mail s připravenou zprávou. Pokud se neotevřel, napište prosím na ${SITE.email || 'pavelkoch@seznam.cz'}.`;
  });
}

/* ---------- Pohyb a navigace ---------- */
function reveal() {
  $$('.author h2, .contact h2, .index-h').forEach(h => {
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
  goHome();
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
    c.classList.toggle('big', show && !!t.closest('.hung'));
    c.classList.toggle('lt', !!t.closest('.intro'));
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
  FX.push(() => {
    if (document.body.dataset.view !== 'projekt') return;
    $$('.folder .piece').forEach(p => {
      const h = $('.hung', p), im = $('img', h), lab = $('.label', p);
      const r = p.getBoundingClientRect(), vh = innerHeight;
      const lag = (r.left / innerWidth) * 60;
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

/* ---------- Jen světlý režim (dřívější noční volba se maže) ---------- */
try { localStorage.removeItem('mode'); } catch {}

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
