(function () {
  'use strict';

  // ── Icons ─────────────────────────────────────────────────────────────────
  lucide.createIcons();

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const canvas            = document.getElementById('imageCanvas');
  const ctx               = canvas.getContext('2d', { willReadFrequently: true });
  const crosshairCanvas   = document.getElementById('crosshairCanvas');
  const crossCtx          = crosshairCanvas.getContext('2d');
  const placeholder       = document.getElementById('canvasPlaceholder');
  const resolution        = document.getElementById('canvasResolution');
  const colorHeroEl       = document.getElementById('colorHero');
  const headerSwatch      = document.getElementById('headerSwatch');
  const dynamicFavicon    = document.getElementById('dynamicFavicon');
  const nativeColorPicker = document.getElementById('nativeColorPicker');
  const hexValueEl        = document.getElementById('hexValue');
  const rgbValueEl        = document.getElementById('rgbValue');
  const hslValueEl        = document.getElementById('hslValue');
  const oklchValueEl      = document.getElementById('oklchValue');
  const cssVarValueEl     = document.getElementById('cssVarValue');
  const contrastWhiteEl   = document.getElementById('contrastWhite');
  const contrastBlackEl   = document.getElementById('contrastBlack');
  const shadesStrip       = document.getElementById('shadesStrip');
  const harmonicsRow      = document.getElementById('harmonicsRow');
  const miniPaletteRow    = document.getElementById('miniPaletteRow');
  const openPaletteModalBtn = document.getElementById('openPaletteModalBtn');
  const recentColorsDiv   = document.getElementById('recentColors');
  const fileInput         = document.getElementById('fileInput');
  const urlInput          = document.getElementById('urlInput');
  const loadUrlBtn        = document.getElementById('loadUrlBtn');
  const pasteClipBtn      = document.getElementById('pasteClipBtn');
  const eyedropperBtn     = document.getElementById('eyedropperBtn');
  const extractBtn        = document.getElementById('extractPaletteBtn');
  const clearRecentBtn    = document.getElementById('clearRecentBtn');
  const uploadMenuBtn     = document.getElementById('uploadMenuBtn');
  const uploadMenu        = document.getElementById('uploadMenu');
  const uploadMenuChevron = document.getElementById('uploadMenuChevron');
  const dragOverlay       = document.getElementById('dragOverlay');
  const toast             = document.getElementById('toast');
  const toastMsg          = document.getElementById('toast-msg');
  const toastIcon         = document.getElementById('toastIcon');
  const magnifier         = document.getElementById('magnifier');
  const magCanvas         = document.getElementById('magCanvas');
  const magCtx            = magCanvas.getContext('2d');
  const magHex            = document.getElementById('magHex');
  const srAnnounce        = document.getElementById('srAnnounce');
  const toggleMagBtn      = document.getElementById('toggleMagBtn');
  const toggleCrosshairBtn= document.getElementById('toggleCrosshairBtn');
  const helpBtn           = document.getElementById('helpBtn');
  const helpModal         = document.getElementById('helpModal');
  const helpModalClose    = document.getElementById('helpModalClose');
  const paletteModal      = document.getElementById('paletteModal');
  const paletteModalClose = document.getElementById('paletteModalClose');
  const paletteModalContent = document.getElementById('paletteModalContent');
  const paletteCount      = document.getElementById('paletteCount');
  const paletteCopyAllBtn = document.getElementById('paletteCopyAllBtn');
  const paletteViewBtns   = document.querySelectorAll('.palette-view-btn');

  // ── State ─────────────────────────────────────────────────────────────────
  let currentImage    = null;
  let currentColor    = { r: 59, g: 130, b: 246 };
  let recentColors    = [];
  let paletteColors   = [];
  let paletteView     = 'list';
  let magEnabled      = true;
  let crosshairEnabled= false;
  let crosshairPos    = null;
  let rafId           = null;
  let lastMoveEvent   = null;
  const colorThief    = new ColorThief();

  try { recentColors = JSON.parse(localStorage.getItem('hue_recent') || '[]'); } catch {}

  // ── Color math ────────────────────────────────────────────────────────────
  const rgbToHex = (r, g, b) =>
    '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('').toUpperCase();

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  function hslToRgb(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
  }

  // Enhanced OKLCH conversion precision
  function rgbToOklch(r, g, b) {
    const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const rl = lin(r), gl = lin(g), bl = lin(b);
    const l_ = Math.cbrt(0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl);
    const m_ = Math.cbrt(0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl);
    const s_ = Math.cbrt(0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl);
    const L  = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
    const a  = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
    const bv = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
    const C  = Math.sqrt(a * a + bv * bv);
    let H = Math.round(Math.atan2(bv, a) * 180 / Math.PI);
    if (H < 0) H += 360;
    return { L: L.toFixed(2), C: C.toFixed(2), H };
  }

  function relativeLuminance(r, g, b) {
    const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  function contrastRatio(l1, l2) {
    const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
    return +((hi + 0.05) / (lo + 0.05)).toFixed(2);
  }

  function wcagGrade(ratio) {
    if (ratio >= 7)   return 'AAA';
    if (ratio >= 4.5) return 'AA';
    if (ratio >= 3)   return 'AA lg';
    return 'Fail';
  }

  // ── Toast System (Zero Window Alerts) ──────────────────────────────────
  function showToast(message, isError = false) {
    if (!toast || !toastMsg || !toastIcon) return;

    toastMsg.textContent = message;

    if (isError) {
      toast.classList.add('border-red-500/50');
      toastIcon.classList.replace('text-emerald-400', 'text-red-400');
    } else {
      toast.classList.remove('border-red-500/50');
      toastIcon.classList.replace('text-red-400', 'text-emerald-400');
    }

    toast.classList.remove('hidden', 'translate-y-full', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    if (window.toastTimer) clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => {
      toast.classList.add('translate-y-full', 'opacity-0');
      setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3000);
  }

  function announce(msg) {
    srAnnounce.textContent = '';
    requestAnimationFrame(() => { srAnnounce.textContent = msg; });
  }

  function copyText(text, label) {
    navigator.clipboard?.writeText(text)
      .then(() => { showToast(`Copied ${label}`); announce(`Copied ${label}: ${text}`); })
      .catch(() => showToast('Copy failed', true));
  }

  // Dynamic Favicon Updating Feature
  function updateFavicon(hexColor) {
    const encodedHex = encodeURIComponent(hexColor);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='14' fill='${encodedHex}'/></svg>`;
    dynamicFavicon.href = `data:image/svg+xml,${svg}`;
  }

  // ── Color display update ───────────────────────────────────────────────────
  function updateColorDisplay(r, g, b) {
    currentColor = { r, g, b };
    const hex  = rgbToHex(r, g, b);
    const hsl  = rgbToHsl(r, g, b);
    const ok   = rgbToOklch(r, g, b);
    const lumC = relativeLuminance(r, g, b);
    const crW  = contrastRatio(1.0, lumC);
    const crB  = contrastRatio(0.0, lumC);

    colorHeroEl.style.background = hex;
    headerSwatch.style.background = hex;
    nativeColorPicker.value = hex;
    updateFavicon(hex);

    hexValueEl.textContent    = hex;
    rgbValueEl.textContent    = `${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`;
    hslValueEl.textContent    = `${hsl.h}° ${hsl.s}% ${hsl.l}%`;
    oklchValueEl.textContent  = `oklch(${ok.L} ${ok.C} ${ok.H}°)`;
    cssVarValueEl.textContent = `--color: ${hex};`;

    contrastWhiteEl.textContent = `on ☀ ${crW}:1 ${wcagGrade(crW)}`;
    contrastBlackEl.textContent = `on ☾ ${crB}:1 ${wcagGrade(crB)}`;

    shadesStrip.innerHTML = '';
    [5, 15, 25, 35, 45, 55, 65, 75, 85, 95].forEach(l => {
      const { r: sr, g: sg, b: sb } = hslToRgb(hsl.h, hsl.s, l);
      const sh = rgbToHex(sr, sg, sb);
      const el = document.createElement('div');
      el.role = 'listitem';
      el.className = 'flex-1 h-full cursor-pointer hover:brightness-125 transition-all';
      el.style.background = sh;
      el.title = sh;
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', `Shade ${sh}`);
      el.addEventListener('click', () => { updateColorDisplay(sr, sg, sb); addRecentColor(sr, sg, sb); });
      shadesStrip.appendChild(el);
    });

    harmonicsRow.innerHTML = '';
    const harmAngles = [
      { angle: 180, label: 'comp' },
      { angle: 120, label: 'tri1' },
      { angle: 240, label: 'tri2' },
      { angle:  30, label: 'ana1' },
      { angle: 330, label: 'ana2' },
    ];
    harmAngles.forEach(({ angle, label }) => {
      const hh = (hsl.h + angle) % 360;
      const { r: hr, g: hg, b: hb } = hslToRgb(hh, hsl.s, hsl.l);
      const hHex = rgbToHex(hr, hg, hb);
      const el = document.createElement('button');
      el.role = 'listitem';
      el.className = 'w-6 h-6 rounded-md border border-neutral-700/60 cursor-pointer hover:scale-110 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
      el.style.background = hHex;
      el.title = `${label}: ${hHex}`;
      el.setAttribute('aria-label', `${label} harmonic ${hHex}`);
      el.addEventListener('click', () => { updateColorDisplay(hr, hg, hb); addRecentColor(hr, hg, hb); });
      harmonicsRow.appendChild(el);
    });

    document.title = `${hex} · hue`;
  }

  // Native input fine tuning
  nativeColorPicker.addEventListener('input', (e) => {
    const hex = e.target.value;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    updateColorDisplay(r, g, b);
  });

  nativeColorPicker.addEventListener('change', (e) => {
    const hex = e.target.value;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    addRecentColor(r, g, b);
  });

  // ── Copy buttons ──────────────────────────────────────────────────────────
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => doCopy(btn.dataset.copy));
  });

  function doCopy(type) {
    const { r, g, b } = currentColor;
    const hex  = rgbToHex(r, g, b);
    const hsl  = rgbToHsl(r, g, b);
    const ok   = rgbToOklch(r, g, b);
    const map  = {
      hex:   [hex,                                   'HEX'],
      rgb:   [`rgb(${r}, ${g}, ${b})`,               'RGB'],
      hsl:   [`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`, 'HSL'],
      oklch: [`oklch(${ok.L} ${ok.C} ${ok.H}deg)`,   'OKLCH'],
      css:   [`--color: ${hex};`,                    'CSS var'],
    };
    const entry = map[type];
    if (entry) copyText(...entry);
  }

  colorHeroEl.addEventListener('click', () => doCopy('hex'));

  // ── Recent colors ─────────────────────────────────────────────────────────
  function addRecentColor(r, g, b) {
    const hex = rgbToHex(r, g, b);
    recentColors = recentColors.filter(c => c !== hex);
    recentColors.unshift(hex);
    if (recentColors.length > 24) recentColors.pop();
    try { localStorage.setItem('hue_recent', JSON.stringify(recentColors)); } catch {}
    renderRecent();
  }

  function renderRecent() {
    recentColorsDiv.innerHTML = '';
    if (!recentColors.length) {
      const p = document.createElement('p');
      p.className = 'text-[10px] font-mono text-neutral-700';
      p.textContent = 'No picks yet';
      recentColorsDiv.appendChild(p);
      return;
    }
    recentColors.forEach(hex => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const btn = document.createElement('button');
      btn.role = 'listitem';
      btn.className = 'w-5 h-5 rounded border border-neutral-700/60 hover:scale-110 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-transform flex-shrink-0';
      btn.style.background = hex;
      btn.title = hex;
      btn.setAttribute('aria-label', `Select ${hex}`);
      btn.addEventListener('click', () => { updateColorDisplay(r, g, b); addRecentColor(r, g, b); });
      recentColorsDiv.appendChild(btn);
    });
  }

  clearRecentBtn.addEventListener('click', () => {
    recentColors = [];
    try { localStorage.removeItem('hue_recent'); } catch {}
    renderRecent();
    announce('Recent colors cleared');
  });

  // ── Palette extraction ────────────────────────────────────────────────────
  extractBtn.addEventListener('click', () => {
    if (!currentImage) { showToast('Load an image first', true); return; }
    try {
      const raw = colorThief.getPalette(currentImage, 10);
      paletteColors = raw.map(([r, g, b]) => ({ r, g, b }));
      renderMiniPalette();
      renderPaletteModal();
      openPaletteModalBtn.classList.remove('hidden');
      paletteCount.textContent = `${paletteColors.length} colors`;
      showToast(`Extracted ${paletteColors.length} colors`);
      announce(`Extracted ${paletteColors.length} colors from image`);
    } catch {
      showToast('Extraction failed — try another image', true);
    }
  });

  function renderMiniPalette() {
    miniPaletteRow.innerHTML = '';
    paletteColors.forEach(({ r, g, b }) => {
      const hex = rgbToHex(r, g, b);
      const el = document.createElement('button');
      el.className = 'w-5 h-5 rounded border border-neutral-700/60 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-transform flex-shrink-0';
      el.style.background = hex;
      el.title = hex;
      el.setAttribute('aria-label', `Select palette color ${hex}`);
      el.addEventListener('click', () => { updateColorDisplay(r, g, b); addRecentColor(r, g, b); });
      miniPaletteRow.appendChild(el);
    });
  }

  openPaletteModalBtn.addEventListener('click', () => openPaletteModal());

  function openPaletteModal() {
    paletteModal.classList.remove('hidden');
    paletteModal.classList.add('flex');
    document.body.style.overflow = 'hidden';
    paletteModalClose.focus();
  }

  function closePaletteModal() {
    paletteModal.classList.add('hidden');
    paletteModal.classList.remove('flex');
    document.body.style.overflow = '';
    openPaletteModalBtn.focus();
  }

  paletteModalClose.addEventListener('click', closePaletteModal);
  paletteModal.addEventListener('click', e => { if (e.target === paletteModal) closePaletteModal(); });

  paletteViewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      paletteView = btn.dataset.view;
      paletteViewBtns.forEach(b => {
        b.classList.toggle('bg-neutral-800', b === btn);
        b.classList.toggle('text-neutral-200', b === btn);
        b.classList.toggle('text-neutral-600', b !== btn);
        b.classList.toggle('hover:text-neutral-400', b !== btn);
      });
      renderPaletteModal();
    });
  });

  function renderPaletteModal() {
    paletteModalContent.innerHTML = '';
    if (!paletteColors.length) return;

    if (paletteView === 'strip') {
      const wrap = document.createElement('div');
      wrap.className = 'flex h-24 rounded-xl overflow-hidden';
      paletteColors.forEach(({ r, g, b }) => {
        const hex = rgbToHex(r, g, b);
        const el = document.createElement('button');
        el.className = 'flex-1 transition-transform hover:scale-y-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 relative group';
        el.style.background = hex;
        el.title = hex;
        el.setAttribute('aria-label', `Select ${hex}`);
        const lbl = document.createElement('span');
        lbl.className = 'absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-mono opacity-0 group-hover:opacity-100 transition whitespace-nowrap bg-black/40 backdrop-blur-sm text-white rounded px-1 py-0.5';
        lbl.textContent = hex;
        el.appendChild(lbl);
        el.addEventListener('click', () => { updateColorDisplay(r, g, b); addRecentColor(r, g, b); closePaletteModal(); });
        wrap.appendChild(el);
      });
      paletteModalContent.appendChild(wrap);
      return;
    }

    if (paletteView === 'grid') {
      const grid = document.createElement('div');
      grid.className = 'grid grid-cols-4 gap-2';
      paletteColors.forEach(({ r, g, b }) => {
        const hex = rgbToHex(r, g, b);
        const fg  = relativeLuminance(r, g, b) > 0.3 ? '#111' : '#eee';
        const card = document.createElement('button');
        card.className = 'aspect-square rounded-xl border border-neutral-700/60 flex flex-col items-end justify-end p-1.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 overflow-hidden transition hover:scale-105';
        card.style.background = hex;
        card.title = hex;
        card.setAttribute('aria-label', `Select ${hex}`);
        const lbl = document.createElement('span');
        lbl.className = 'text-[9px] font-mono opacity-0 group-hover:opacity-100 transition';
        lbl.style.color = fg;
        lbl.textContent = hex;
        card.appendChild(lbl);
        card.addEventListener('click', () => { updateColorDisplay(r, g, b); addRecentColor(r, g, b); closePaletteModal(); });
        grid.appendChild(card);
      });
      paletteModalContent.appendChild(grid);
      return;
    }

    const list = document.createElement('div');
    list.className = 'space-y-0.5';
    paletteColors.forEach(({ r, g, b }) => {
      const hex = rgbToHex(r, g, b);
      const hsl = rgbToHsl(r, g, b);

      const row = document.createElement('button');
      row.className = 'w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-neutral-800/60 transition group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
      row.setAttribute('aria-label', `Select palette color ${hex}`);

      const swatch = document.createElement('div');
      swatch.className = 'w-8 h-8 rounded-lg flex-shrink-0 border border-neutral-700/60';
      swatch.style.background = hex;

      const info = document.createElement('div');
      info.className = 'flex-1 min-w-0 text-left';

      const hexSpan = document.createElement('span');
      hexSpan.className = 'font-mono text-xs text-neutral-200 block';
      hexSpan.textContent = hex;

      const subSpan = document.createElement('span');
      subSpan.className = 'font-mono text-[10px] text-neutral-600 block';
      subSpan.textContent = `rgb(${r}, ${g}, ${b}) · ${hsl.h}° ${hsl.s}% ${hsl.l}%`;

      const copyLbl = document.createElement('span');
      copyLbl.className = 'text-[10px] font-mono text-neutral-600 opacity-0 group-hover:opacity-100 transition flex-shrink-0';
      copyLbl.textContent = 'copy hex';

      info.appendChild(hexSpan);
      info.appendChild(subSpan);
      row.appendChild(swatch);
      row.appendChild(info);
      row.appendChild(copyLbl);

      row.addEventListener('click', () => {
        updateColorDisplay(r, g, b);
        addRecentColor(r, g, b);
        doCopy('hex');
        closePaletteModal();
      });

      list.appendChild(row);
    });
    paletteModalContent.appendChild(list);
  }

  paletteCopyAllBtn.addEventListener('click', () => {
    const arr = paletteColors.map(({ r, g, b }) => `"${rgbToHex(r, g, b)}"`).join(', ');
    copyText(`[${arr}]`, 'palette array');
  });

  // ── Canvas interaction & Color Sampling Precision ─────────────
  function getCanvasCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.floor((clientX - rect.left) * (canvas.width  / rect.width)),
      y: Math.floor((clientY - rect.top)  * (canvas.height / rect.height)),
    };
  }

  // Pixel Area Sampling for High Precision Tone Averaging
  function pickColorAt(clientX, clientY) {
    if (!currentImage) return;
    const { x, y } = getCanvasCoords(clientX, clientY);
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
    
    const sampleWidth = Math.min(3, canvas.width - x);
    const sampleHeight = Math.min(3, canvas.height - y);
    const imgData = ctx.getImageData(x, y, sampleWidth, sampleHeight).data;
    
    let totalR = 0, totalG = 0, totalB = 0, count = 0;
    for (let i = 0; i < imgData.length; i += 4) {
      totalR += imgData[i];
      totalG += imgData[i + 1];
      totalB += imgData[i + 2];
      count++;
    }

    const r = Math.round(totalR / count);
    const g = Math.round(totalG / count);
    const b = Math.round(totalB / count);

    updateColorDisplay(r, g, b);
    addRecentColor(r, g, b);
    
    if (crosshairEnabled) {
      crosshairPos = { x, y };
      drawCrosshair();
    }
  }

  canvas.addEventListener('mousemove', e => {
    lastMoveEvent = e;
    if (!rafId) rafId = requestAnimationFrame(onRaf);
  });

  function onRaf() {
    rafId = null;
    if (!lastMoveEvent || !currentImage) return;
    const e = lastMoveEvent;
    if (magEnabled) updateMagnifier(e.clientX, e.clientY);
    if (crosshairEnabled && crosshairPos !== null) drawCrosshair();
  }

  function updateMagnifier(clientX, clientY) {
    const { x, y } = getCanvasCoords(clientX, clientY);
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
      magnifier.style.display = 'none'; return;
    }
    const cx = Math.max(8, Math.min(canvas.width  - 8, x));
    const cy = Math.max(8, Math.min(canvas.height - 8, y));

    magCtx.imageSmoothingEnabled = false;
    magCtx.clearRect(0, 0, 88, 88);
    magCtx.drawImage(canvas, cx - 8, cy - 8, 16, 16, 0, 0, 88, 88);

    magCtx.strokeStyle = 'rgba(255,255,255,0.6)';
    magCtx.lineWidth = 1;
    magCtx.beginPath(); magCtx.moveTo(44, 0); magCtx.lineTo(44, 88); magCtx.stroke();
    magCtx.beginPath(); magCtx.moveTo(0, 44); magCtx.lineTo(88, 44); magCtx.stroke();
    
    magCtx.strokeStyle = 'rgba(255,255,255,0.9)';
    magCtx.strokeRect(38.5, 38.5, 11, 11);

    const px = ctx.getImageData(x, y, 1, 1).data;
    magHex.textContent = rgbToHex(px[0], px[1], px[2]);

    const parentRect = canvas.parentElement.getBoundingClientRect();
    let left = clientX - parentRect.left + 16;
    let top  = clientY - parentRect.top  - 108;
    if (top < 6)                             top  = clientY - parentRect.top + 16;
    if (left + 104 > parentRect.width)       left = clientX - parentRect.left - 108;
    magnifier.style.left = left + 'px';
    magnifier.style.top  = top  + 'px';
    magnifier.style.display = 'block';
  }

  function drawCrosshair() {
    if (!currentImage || !crosshairPos) return;
    const rect   = canvas.getBoundingClientRect();
    const scaleX = rect.width  / canvas.width;
    const scaleY = rect.height / canvas.height;
    const px     = crosshairPos.x * scaleX;
    const py     = crosshairPos.y * scaleY;
    crosshairCanvas.width  = rect.width;
    crosshairCanvas.height = rect.height;
    crossCtx.clearRect(0, 0, rect.width, rect.height);
    crossCtx.strokeStyle = 'rgba(255,255,255,0.5)';
    crossCtx.lineWidth = 1;
    crossCtx.setLineDash([4, 4]);
    crossCtx.beginPath(); crossCtx.moveTo(px, 0); crossCtx.lineTo(px, rect.height); crossCtx.stroke();
    crossCtx.beginPath(); crossCtx.moveTo(0, py); crossCtx.lineTo(rect.width, py);  crossCtx.stroke();
    crossCtx.setLineDash([]);
  }

  canvas.addEventListener('mouseleave', () => {
    magnifier.style.display = 'none';
    lastMoveEvent = null;
  });

  canvas.addEventListener('click', e => pickColorAt(e.clientX, e.clientY));

  canvas.addEventListener('keydown', e => {
    if (!currentImage) return;
    if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    if (!crosshairPos) crosshairPos = { x: Math.floor(canvas.width/2), y: Math.floor(canvas.height/2) };
    const step = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft')  crosshairPos.x = Math.max(0, crosshairPos.x - step);
    if (e.key === 'ArrowRight') crosshairPos.x = Math.min(canvas.width  - 1, crosshairPos.x + step);
    if (e.key === 'ArrowUp')    crosshairPos.y = Math.max(0, crosshairPos.y - step);
    if (e.key === 'ArrowDown')  crosshairPos.y = Math.min(canvas.height - 1, crosshairPos.y + step);
    const px = ctx.getImageData(crosshairPos.x, crosshairPos.y, 1, 1).data;
    updateColorDisplay(px[0], px[1], px[2]);
    crosshairEnabled = true; crosshairCanvas.style.display = 'block';
    drawCrosshair();
  });

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.touches[0];
    pickColorAt(t.clientX, t.clientY);
  }, { passive: false });

  function setMag(on) {
    magEnabled = on;
    toggleMagBtn.setAttribute('aria-pressed', String(on));
    toggleMagBtn.classList.toggle('text-neutral-300', on);
    toggleMagBtn.classList.toggle('border-neutral-600', on);
    toggleMagBtn.classList.toggle('text-neutral-500', !on);
    if (!on) magnifier.style.display = 'none';
    announce(`Magnifier ${on ? 'on' : 'off'}`);
  }
  toggleMagBtn.addEventListener('click', () => setMag(!magEnabled));

  function setCrosshair(on) {
    crosshairEnabled = on;
    toggleCrosshairBtn.setAttribute('aria-pressed', String(on));
    toggleCrosshairBtn.classList.toggle('text-neutral-300', on);
    toggleCrosshairBtn.classList.toggle('border-neutral-600', on);
    toggleCrosshairBtn.classList.toggle('text-neutral-500', !on);
    crosshairCanvas.style.display = on ? 'block' : 'none';
    if (!on) { crossCtx.clearRect(0, 0, crosshairCanvas.width, crosshairCanvas.height); }
    announce(`Crosshair ${on ? 'on' : 'off'}`);
  }
  toggleCrosshairBtn.addEventListener('click', () => setCrosshair(!crosshairEnabled));

  // ── Load image ─────────────────────────────────────────────────────────────
  function loadImageToCanvas(img) {
    const maxW = 1200, maxH = 800;
    let w = img.naturalWidth  || img.width;
    let h = img.naturalHeight || img.height;
    if (w > maxW) { h = Math.round((maxW / w) * h); w = maxW; }
    if (h > maxH) { w = Math.round((maxH / h) * w); h = maxH; }
    canvas.width = w; canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    currentImage = img;
    canvas.style.display = 'block';
    placeholder.classList.add('hidden');
    resolution.textContent = `${img.naturalWidth || img.width}×${img.naturalHeight || img.height}`;
    paletteColors = [];
    miniPaletteRow.innerHTML = '';
    openPaletteModalBtn.classList.add('hidden');
    crosshairPos = null;
    if (crosshairEnabled) crossCtx.clearRect(0, 0, crosshairCanvas.width, crosshairCanvas.height);
    announce('Image loaded — click canvas to pick a color');
  }

  function handleSource(source, isUrl = false) {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      loadImageToCanvas(img);
      if (!isUrl) URL.revokeObjectURL(img.src);
    };
    img.onerror = () => showToast('Failed to load image', true);
    img.src = isUrl ? source : URL.createObjectURL(source);
  }

  // ── Input handlers ────────────────────────────────────────────────────────
  fileInput.addEventListener('change', e => {
    if (e.target.files[0]) handleSource(e.target.files[0]);
    e.target.value = '';
  });

  loadUrlBtn.addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (!url) { showToast('Enter an image URL', true); return; }
    handleSource(url, true);
    urlInput.value = '';
    closeMenu();
  });

  urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') loadUrlBtn.click(); });

  pasteClipBtn.addEventListener('click', async () => {
    closeMenu();
    try {
      const items = await navigator.clipboard.read();
      let found = false;
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            handleSource(await item.getType(type));
            found = true; break;
          }
        }
        if (found) break;
      }
      if (!found) showToast('No image in clipboard', true);
    } catch { showToast('Clipboard access denied — use Ctrl+V', true); }
  });

  document.addEventListener('paste', e => {
    if (document.activeElement === urlInput) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        handleSource(item.getAsFile());
        e.preventDefault(); break;
      }
    }
  });

  // ── Drag & Drop ────────────────────────────────────────────────────────────
  let dragCounter = 0;
  document.addEventListener('dragenter', e => {
    e.preventDefault(); dragCounter++;
    if (dragCounter === 1) { dragOverlay.classList.remove('hidden'); dragOverlay.classList.add('flex'); }
  });
  document.addEventListener('dragleave', () => {
    dragCounter--;
    if (dragCounter <= 0) { dragCounter = 0; dragOverlay.classList.add('hidden'); dragOverlay.classList.remove('flex'); }
  });
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => {
    e.preventDefault(); dragCounter = 0;
    dragOverlay.classList.add('hidden'); dragOverlay.classList.remove('flex');
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) handleSource(file);
  });

  // ── Eyedropper ─────────────────────────────────────────────────────────────
  if (!window.EyeDropper) {
    eyedropperBtn.disabled = true;
    eyedropperBtn.title = 'EyeDropper not supported — use Chrome or Edge';
    eyedropperBtn.classList.add('opacity-40', 'cursor-not-allowed');
  }
  eyedropperBtn.addEventListener('click', async () => {
    if (!window.EyeDropper) return;
    try {
      const result = await new EyeDropper().open();
      const h = result.sRGBHex;
      const r = parseInt(h.slice(1, 3), 16);
      const g = parseInt(h.slice(3, 5), 16);
      const b = parseInt(h.slice(5, 7), 16);
      updateColorDisplay(r, g, b);
      addRecentColor(r, g, b);
    } catch {}
  });

  // ── Menu Options ────────────────────────────────────────────────────────
  function openMenu() {
    uploadMenu.classList.remove('hidden');
    uploadMenuBtn.setAttribute('aria-expanded', 'true');
    uploadMenuChevron.style.transform = 'rotate(180deg)';
    setTimeout(() => urlInput.focus(), 50);
  }
  function closeMenu() {
    uploadMenu.classList.add('hidden');
    uploadMenuBtn.setAttribute('aria-expanded', 'false');
    uploadMenuChevron.style.transform = 'rotate(0deg)';
  }
  uploadMenuBtn.addEventListener('click', e => {
    e.stopPropagation();
    uploadMenu.classList.contains('hidden') ? openMenu() : closeMenu();
  });
  document.addEventListener('click', e => {
    if (!document.getElementById('uploadGroup').contains(e.target)) closeMenu();
  });

  // ── Modals ─────────────────────────────────────────────────────────────────
  function openHelpModal() {
    helpModal.classList.remove('hidden');
    helpModal.classList.add('flex');
    helpModalClose.focus();
  }
  function closeHelpModal() {
    helpModal.classList.add('hidden');
    helpModal.classList.remove('flex');
    helpBtn.focus();
  }
  helpBtn.addEventListener('click', openHelpModal);
  helpModalClose.addEventListener('click', closeHelpModal);
  helpModal.addEventListener('click', e => { if (e.target === helpModal) closeHelpModal(); });

  function trapFocus(modal, e) {
    const focusable = modal.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  helpModal.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeHelpModal(); return; }
    trapFocus(helpModal, e);
  });
  paletteModal.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closePaletteModal(); return; }
    trapFocus(paletteModal, e);
  });

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const anyModal = !helpModal.classList.contains('hidden') || !paletteModal.classList.contains('hidden');
    if (anyModal) return;

    switch (e.key) {
      case '?':           e.preventDefault(); openHelpModal(); break;
      case 'Escape':      closeMenu(); break;
      case 'h': case 'H': e.preventDefault(); doCopy('hex');   break;
      case 'r': case 'R': e.preventDefault(); doCopy('rgb');   break;
      case 's': case 'S': e.preventDefault(); doCopy('hsl');   break;
      case 'o': case 'O': e.preventDefault(); doCopy('oklch'); break;
      case 'c': case 'C': e.preventDefault(); doCopy('css');   break;
      case 'e': case 'E': e.preventDefault(); eyedropperBtn.click(); break;
      case 'u': case 'U': e.preventDefault(); fileInput.click(); break;
      case 'p': case 'P': e.preventDefault(); extractBtn.click(); break;
      case 'm': case 'M': e.preventDefault(); setMag(!magEnabled); break;
      case 'x': case 'X': e.preventDefault(); setCrosshair(!crosshairEnabled); break;
      case 'Delete':      e.preventDefault(); clearRecentBtn.click(); break;
    }
  });

  // ── Init ───────────────────────────────────────────────────────────────────
  updateColorDisplay(59, 130, 246);
  renderRecent();

  const demo = new Image();
  demo.crossOrigin = 'Anonymous';
  demo.src = 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=900';
  demo.onload = () => loadImageToCanvas(demo);
  demo.onerror = () => {};

})();
