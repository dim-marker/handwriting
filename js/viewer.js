// Müasir şəkil izləyicisi: zoom (maus/toxunuş), sürüşdürmə, fırlatma, parlaqlıq/kontrast, tam ekran
const stage = document.getElementById('image-scroll-container');
const canvas = document.getElementById('viewer-canvas');
const img = document.getElementById('task-image');
const loader = document.getElementById('viewer-loader');
const zoomLabel = document.getElementById('zoom-level');
const hint = document.getElementById('viewer-hint');
const viewer = document.getElementById('viewer');
const adjustPanel = document.getElementById('viewer-adjust');

const MIN = 0.1, MAX = 8;
let s = 1, x = 0, y = 0, rot = 0;
let natW = 0, natH = 0;
let userMoved = false;

function apply(smooth = false) {
  canvas.classList.toggle('smooth', smooth);
  canvas.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
  zoomLabel.textContent = Math.round(s * 100) + '%';
}

function effSize() {
  return rot % 180 === 0 ? [natW, natH] : [natH, natW];
}

function fit(smooth = true) {
  if (!natW) return;
  const [w, h] = effSize();
  const r = stage.getBoundingClientRect();
  s = Math.min(r.width / w, r.height / h) * 0.94;
  s = Math.max(MIN, Math.min(MAX, s));
  x = r.width / 2 - (natW * s) / 2;
  y = r.height / 2 - (natH * s) / 2;
  userMoved = false;
  apply(smooth);
}

function zoomAt(px, py, factor, smooth = false) {
  const ns = Math.max(MIN, Math.min(MAX, s * factor));
  const k = ns / s;
  x = px - (px - x) * k;
  y = py - (py - y) * k;
  s = ns;
  userMoved = true;
  apply(smooth);
}

function zoomCenter(factor) {
  const r = stage.getBoundingClientRect();
  zoomAt(r.width / 2, r.height / 2, factor, true);
}

function actualSize() {
  const r = stage.getBoundingClientRect();
  zoomAt(r.width / 2, r.height / 2, 1 / s, true);
}

function rotate(delta) {
  rot = (rot + delta + 360) % 360;
  img.style.transform = `rotate(${rot}deg)`;
  fit(true);
}

// Şəkil yüklənəndə
function onLoad() {
  natW = img.naturalWidth;
  natH = img.naturalHeight;
  canvas.style.width = natW + 'px';
  canvas.style.height = natH + 'px';
  rot = 0;
  img.style.transform = '';
  img.classList.add('loaded');
  loader.classList.add('hidden');
  fit(false);
}

function onSrcChange() {
  img.classList.remove('loaded');
  loader.classList.remove('hidden');
  if (img.complete && img.naturalWidth) onLoad();
}

img.addEventListener('load', onLoad);
img.addEventListener('error', () => {
  loader.classList.remove('hidden');
  loader.querySelector('span').textContent = 'Şəkil yüklənmədi';
});
// app.js src dəyişəndə izləyicini sıfırlasın
new MutationObserver(onSrcChange).observe(img, { attributes: true, attributeFilter: ['src'] });
if (img.getAttribute('src')) onSrcChange();

// Maus təkəri ilə zoom
stage.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = stage.getBoundingClientRect();
  const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
  zoomAt(e.clientX - r.left, e.clientY - r.top, factor);
  hint.classList.add('faded');
}, { passive: false });

// Sürüşdürmə + iki barmaqla zoom (pointer events)
const pointers = new Map();
let lastDist = 0;

stage.addEventListener('pointerdown', (e) => {
  stage.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  stage.classList.add('dragging');
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    lastDist = Math.hypot(a.x - b.x, a.y - b.y);
  }
});

stage.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;

  if (pointers.size === 1) {
    x += dx; y += dy; userMoved = true;
    apply();
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const r = stage.getBoundingClientRect();
    const cx = (a.x + b.x) / 2 - r.left, cy = (a.y + b.y) / 2 - r.top;
    if (lastDist) zoomAt(cx, cy, dist / lastDist);
    lastDist = dist;
  }
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  lastDist = 0;
  if (!pointers.size) stage.classList.remove('dragging');
}
stage.addEventListener('pointerup', endPointer);
stage.addEventListener('pointercancel', endPointer);

// İki dəfə klik: sığdır ↔ 200%
stage.addEventListener('dblclick', (e) => {
  const r = stage.getBoundingClientRect();
  const fitScale = Math.min(r.width / effSize()[0], r.height / effSize()[1]) * 0.94;
  if (s > fitScale * 1.2) fit(true);
  else zoomAt(e.clientX - r.left, e.clientY - r.top, 2.2 / (s / fitScale), true);
});

// Düymələr
const $ = (id) => document.getElementById(id);
$('zoom-in').addEventListener('click', () => zoomCenter(1.3));
$('zoom-out').addEventListener('click', () => zoomCenter(1 / 1.3));
$('zoom-reset').addEventListener('click', () => fit(true));
$('zoom-actual').addEventListener('click', actualSize);
$('rotate-left').addEventListener('click', () => rotate(-90));
$('rotate-right').addEventListener('click', () => rotate(90));

$('fullscreen-btn').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else viewer.requestFullscreen?.();
});
document.addEventListener('fullscreenchange', () => setTimeout(() => fit(false), 60));

// Parlaqlıq / kontrast
const bri = $('adj-brightness'), con = $('adj-contrast');
function applyFilter() {
  img.style.filter = `brightness(${bri.value}%) contrast(${con.value}%)`;
  $('adj-brightness-val').textContent = bri.value + '%';
  $('adj-contrast-val').textContent = con.value + '%';
}
bri.addEventListener('input', applyFilter);
con.addEventListener('input', applyFilter);
$('adj-reset').addEventListener('click', () => { bri.value = 100; con.value = 100; applyFilter(); });
$('adjust-btn').addEventListener('click', (e) => {
  adjustPanel.classList.toggle('hidden');
  e.currentTarget.classList.toggle('active');
});

// Klaviatura qısayolları (yazı sahəsində yazarkən işləmir)
document.addEventListener('keydown', (e) => {
  if (['TEXTAREA', 'INPUT'].includes(document.activeElement?.tagName)) return;
  if (e.key === '+' || e.key === '=') zoomCenter(1.3);
  else if (e.key === '-') zoomCenter(1 / 1.3);
  else if (e.key === '0') fit(true);
  else if (e.key.toLowerCase() === 'r') rotate(e.shiftKey ? -90 : 90);
});

// Pəncərə ölçüsü dəyişəndə, istifadəçi sürüşdürməyibsə yenidən sığdır
new ResizeObserver(() => { if (!userMoved) fit(false); }).observe(stage);
