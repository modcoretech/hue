(function () {
      'use strict';

      lucide.createIcons();

      // ── DOM ─────────────────────────────────────────────────
      const canvas              = document.getElementById('imageCanvas');
      const ctx                 = canvas.getContext('2d', { willReadFrequently: true });
      const placeholder         = document.getElementById('canvasPlaceholder');
      const resolutionEl        = document.getElementById('canvasResolution');
      const hintText            = document.getElementById('hintText');
      const colorHeroEl         = document.getElementById('colorHero');
      const headerSwatch        = document.getElementById('headerSwatch');
      const dynamicFavicon      = document.getElementById('dynamicFavicon');
      const nativeColorPicker   = document.getElementById('nativeColorPicker');
      const hexValueEl          = document.getElementById('hexValue');
      const rgbValueEl          = document.getElementById('rgbValue');
      const hslValueEl          = document.getElementById('hslValue');
      const oklchValueEl        = document.getElementById('oklchValue');
      const cssVarValueEl       = document.getElementById('cssVarValue');
      const shadesStrip         = document.getElementById('shadesStrip');
      const harmonicsRow        = document.getElementById('harmonicsRow');
      const miniPaletteRow      = document.getElementById('miniPaletteRow');
      const openPaletteModalBtn = document.getElementById('openPaletteModalBtn');
      const recentColorsDiv     = document.getElementById('recentColors');
      const fileInput           = document.getElementById('fileInput');
      const urlInput            = document.getElementById('urlInput');
      const loadUrlBtn          = document.getElementById('loadUrlBtn');
      const pasteClipBtn        = document.getElementById('pasteClipBtn');
      const eyedropperBtn       = document.getElementById('eyedropperBtn');
      const extractBtn          = document.getElementById('extractPaletteBtn');
      const clearRecentBtn      = document.getElementById('clearRecentBtn');
      const uploadMenuBtn       = document.getElementById('uploadMenuBtn');
      const uploadMenu          = document.getElementById('uploadMenu');
      const uploadMenuChevron   = document.getElementById('uploadMenuChevron');
      const dragOverlay         = document.getElementById('dragOverlay');
      const magnifier           = document.getElementById('magnifier');
      const magCanvas           = document.getElementById('magCanvas');
      const magCtx              = magCanvas.getContext('2d');
      const magHex              = document.getElementById('magHex');
      const toggleMagBtn        = document.getElementById('toggleMagBtn');
      const helpBtn             = document.getElementById('helpBtn');
      const helpModal           = document.getElementById('helpModal');
      const helpModalClose      = document.getElementById('helpModalClose');
      const paletteModal        = document.getElementById('paletteModal');
      const paletteModalClose   = document.getElementById('paletteModalClose');
      const paletteModalContent = document.getElementById('paletteModalContent');
      const paletteCount        = document.getElementById('paletteCount');
      const paletteCopyAllBtn   = document.getElementById('paletteCopyAllBtn');
      const paletteViewBtns     = document.querySelectorAll('.palette-view-btn');

      // ── State ───────────────────────────────────────────────
      let currentImage  = null;
      let imageData     = null;
      let currentColor  = { r: 30, g: 95, b: 255 };
      let recentColors  = [];
      let paletteColors = [];
      let paletteView   = 'list';
      let magEnabled    = true;
      let isPicking     = false;
      let rafId         = null;
      let lastMove      = null;
      let hintTimer     = null;
      let shadesKey     = '';
      let harmKey       = '';
      const colorThief  = new ColorThief();

      const DEFAULT_HINT = 'Click or drag on image';

      try {
        const stored = JSON.parse(localStorage.getItem('hue_recent') || '[]');
        if (Array.isArray(stored)) recentColors = stored.filter(h => /^#[0-9A-F]{6}$/i.test(h));
      } catch {}

      // ── Color math ─────────────────────────────────────────
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

      // ── Feedback (no toasts) ────────────────────────────────
      function flashHint(text, isError = false) {
        hintText.textContent = text;
        hintText.style.color = isError ? 'var(--danger)' : 'var(--accent)';
        clearTimeout(hintTimer);
        hintTimer = setTimeout(() => {
          hintText.textContent = DEFAULT_HINT;
          hintText.style.color = 'var(--muted)';
        }, 1800);
      }

      function flashCopied(btn) {
        btn.classList.add('copied');
        setTimeout(() => btn.classList.remove('copied'), 500);
      }

      function flashHero() {
        colorHeroEl.classList.remove('hero-flash');
        void colorHeroEl.offsetWidth;
        colorHeroEl.classList.add('hero-flash');
      }

      function flashError(el) {
        el.classList.add('error');
        setTimeout(() => el.classList.remove('error'), 900);
      }

      async function copyText(text) {
        try {
          if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('unavailable');
          await navigator.clipboard.writeText(text);
          return true;
        } catch {
          flashHint('Copy failed', true);
          return false;
        }
      }

      // ── Favicon ─────────────────────────────────────────────
      function updateFavicon(hexColor) {
        const enc = encodeURIComponent(hexColor);
        dynamicFavicon.href = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='14' fill='${enc}'/></svg>`;
      }

      // ── Render shades / harmonics (cached) ──────────────────
      function renderShades(hsl) {
        const key = `${hsl.h}|${hsl.s}`;
        if (key === shadesKey) return;
        shadesKey = key;

        const frag = document.createDocumentFragment();
        for (const l of [5, 15, 25, 35, 45, 55, 65, 75, 85, 95]) {
          const { r, g, b } = hslToRgb(hsl.h, hsl.s, l);
          const hex = rgbToHex(r, g, b);
          const el = document.createElement('button');
          el.className = 'flex-1 h-full';
          el.style.cssText = `background:${hex};border:none;cursor:pointer;padding:0;transition:transform 0.12s`;
          el.title = hex;
          el.setAttribute('aria-label', `Shade ${hex}`);
          el.addEventListener('click', () => {
            updateColorDisplay(r, g, b);
            addRecentColor(r, g, b);
          });
          el.addEventListener('mouseenter', () => el.style.transform = 'scaleY(1.15)');
          el.addEventListener('mouseleave', () => el.style.transform = 'scaleY(1)');
          frag.appendChild(el);
        }
        shadesStrip.replaceChildren(frag);
      }

      function renderHarmonics(hsl) {
        const key = `${hsl.h}|${hsl.s}|${hsl.l}`;
        if (key === harmKey) return;
        harmKey = key;

        const angles = [180, 120, 240, 30, 330];
        const labels = ['comp', 'tri1', 'tri2', 'ana1', 'ana2'];
        const frag = document.createDocumentFragment();
        angles.forEach((angle, i) => {
          const hh = (hsl.h + angle) % 360;
          const { r, g, b } = hslToRgb(hh, hsl.s, hsl.l);
          const hex = rgbToHex(r, g, b);
          const el = document.createElement('button');
          el.className = 'swatch';
          el.style.cssText = `background:${hex};width:28px;height:28px`;
          el.title = `${labels[i]}: ${hex}`;
          el.setAttribute('aria-label', `${labels[i]} harmonic ${hex}`);
          el.addEventListener('click', () => {
            updateColorDisplay(r, g, b);
            addRecentColor(r, g, b);
          });
          frag.appendChild(el);
        });
        harmonicsRow.replaceChildren(frag);
      }

      // ── Color display ───────────────────────────────────────
      function updateColorDisplay(r, g, b) {
        currentColor = { r, g, b };
        const hex = rgbToHex(r, g, b);
        const hsl = rgbToHsl(r, g, b);
        const ok  = rgbToOklch(r, g, b);

        colorHeroEl.style.background = hex;
        headerSwatch.style.background = hex;
        nativeColorPicker.value = hex;
        updateFavicon(hex);

        hexValueEl.textContent    = hex;
        rgbValueEl.textContent    = `${r}, ${g}, ${b}`;
        hslValueEl.textContent    = `${hsl.h}° ${hsl.s}% ${hsl.l}%`;
        oklchValueEl.textContent  = `oklch(${ok.L} ${ok.C} ${ok.H}°)`;
        cssVarValueEl.textContent = `--color: ${hex};`;

        renderShades(hsl);
        renderHarmonics(hsl);

        const title = `${hex} · hue`;
        if (document.title !== title) document.title = title;
      }

      // ── Native picker ───────────────────────────────────────
      nativeColorPicker.addEventListener('input', e => {
        const hex = e.target.value;
        updateColorDisplay(
          parseInt(hex.slice(1, 3), 16),
          parseInt(hex.slice(3, 5), 16),
          parseInt(hex.slice(5, 7), 16)
        );
      });
      nativeColorPicker.addEventListener('change', () => {
        addRecentColor(currentColor.r, currentColor.g, currentColor.b);
      });

      // ── Copy buttons ────────────────────────────────────────
      document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const ok = doCopy(btn.dataset.copy);
          if (ok !== false) flashCopied(btn);
        });
      });

      function doCopy(type) {
        const { r, g, b } = currentColor;
        const hex = rgbToHex(r, g, b);
        const hsl = rgbToHsl(r, g, b);
        const ok  = rgbToOklch(r, g, b);
        const map = {
          hex:   hex,
          rgb:   `rgb(${r}, ${g}, ${b})`,
          hsl:   `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
          oklch: `oklch(${ok.L} ${ok.C} ${ok.H}deg)`,
          css:   `--color: ${hex};`,
        };
        const value = map[type];
        if (!value) return false;
        copyText(value);
        return true;
      }

      colorHeroEl.addEventListener('click', async () => {
        const ok = await copyText(rgbToHex(currentColor.r, currentColor.g, currentColor.b));
        if (ok) flashHero();
      });

      // ── Hex inline edit ─────────────────────────────────────
      function startHexEdit() {
        if (hexValueEl.dataset.editing === '1') return;
        hexValueEl.dataset.editing = '1';

        const input = document.createElement('input');
        input.type = 'text';
        input.value = hexValueEl.textContent;
        input.spellcheck = false;
        input.maxLength = 7;
        input.className = 'font-mono text-xs flex-1 min-w-0 num';
        input.style.cssText = 'background:transparent;border:none;outline:none;color:var(--text);padding:0;box-shadow:0 2px 0 var(--accent)';

        hexValueEl.replaceWith(input);
        input.focus();
        input.select();

        let done = false;
        const finish = (commit) => {
          if (done) return;
          done = true;
          const raw = input.value.trim();
          input.replaceWith(hexValueEl);
          delete hexValueEl.dataset.editing;

          if (!commit) return;
          const m = raw.match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
          if (!m) return;
          let h = m[1];
          if (h.length === 3) h = h.split('').map(c => c + c).join('');
          const r = parseInt(h.slice(0, 2), 16);
          const g = parseInt(h.slice(2, 4), 16);
          const b = parseInt(h.slice(4, 6), 16);
          updateColorDisplay(r, g, b);
          addRecentColor(r, g, b);
        };

        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); finish(true); }
          else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        });
        input.addEventListener('blur', () => finish(true));
      }

      hexValueEl.addEventListener('click', startHexEdit);
      hexValueEl.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startHexEdit(); }
      });

      // ── Recent ──────────────────────────────────────────────
      function addRecentColor(r, g, b) {
        const hex = rgbToHex(r, g, b);
        recentColors = recentColors.filter(c => c !== hex);
        recentColors.unshift(hex);
        if (recentColors.length > 24) recentColors.length = 24;
        try { localStorage.setItem('hue_recent', JSON.stringify(recentColors)); } catch {}
        renderRecent();
      }

      function renderRecent() {
        if (!recentColors.length) {
          const p = document.createElement('p');
          p.className = 'text-[10px] font-mono';
          p.style.color = 'var(--muted)';
          p.textContent = 'No picks yet';
          recentColorsDiv.replaceChildren(p);
          return;
        }
        const frag = document.createDocumentFragment();
        for (const hex of recentColors) {
          const btn = document.createElement('button');
          btn.className = 'swatch';
          btn.style.cssText = `background:${hex};width:24px;height:24px`;
          btn.title = hex;
          btn.setAttribute('aria-label', `Select ${hex}`);
          btn.addEventListener('click', () => {
            updateColorDisplay(
              parseInt(hex.slice(1, 3), 16),
              parseInt(hex.slice(3, 5), 16),
              parseInt(hex.slice(5, 7), 16)
            );
            addRecentColor(
              parseInt(hex.slice(1, 3), 16),
              parseInt(hex.slice(3, 5), 16),
              parseInt(hex.slice(5, 7), 16)
            );
          });
          frag.appendChild(btn);
        }
        recentColorsDiv.replaceChildren(frag);
      }

      clearRecentBtn.addEventListener('click', () => {
        recentColors = [];
        try { localStorage.removeItem('hue_recent'); } catch {}
        renderRecent();
      });

      // ── Palette ─────────────────────────────────────────────
      extractBtn.addEventListener('click', () => {
        if (!currentImage) { flashHint('Load an image first', true); return; }
        try {
          const raw = colorThief.getPalette(currentImage, 10);
          paletteColors = raw.map(([r, g, b]) => ({ r, g, b }));
          renderMiniPalette();
          renderPaletteModal();
          openPaletteModalBtn.classList.remove('hidden');
          paletteCount.textContent = `${paletteColors.length} colors`;
          flashHint(`Extracted ${paletteColors.length} colors`);
        } catch {
          flashHint('Extraction failed', true);
        }
      });

      function renderMiniPalette() {
        const frag = document.createDocumentFragment();
        for (const { r, g, b } of paletteColors) {
          const hex = rgbToHex(r, g, b);
          const el = document.createElement('button');
          el.className = 'swatch';
          el.style.cssText = `background:${hex};width:24px;height:24px`;
          el.title = hex;
          el.setAttribute('aria-label', `Select palette color ${hex}`);
          el.addEventListener('click', () => {
            updateColorDisplay(r, g, b);
            addRecentColor(r, g, b);
          });
          frag.appendChild(el);
        }
        miniPaletteRow.replaceChildren(frag);
      }

      openPaletteModalBtn.addEventListener('click', openPaletteModal);

      function openPaletteModal() {
        paletteModal.classList.add('open');
        paletteModalClose.focus();
      }
      function closePaletteModal() {
        paletteModal.classList.remove('open');
        openPaletteModalBtn.focus();
      }
      paletteModalClose.addEventListener('click', closePaletteModal);
      paletteModal.addEventListener('click', e => { if (e.target === paletteModal) closePaletteModal(); });

      paletteViewBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          paletteView = btn.dataset.view;
          paletteViewBtns.forEach(b => {
            const active = b === btn;
            b.classList.toggle('btn-soft', active);
            b.classList.toggle('btn-ghost', !active);
          });
          renderPaletteModal();
        });
      });

      function renderPaletteModal() {
        paletteModalContent.replaceChildren();
        if (!paletteColors.length) return;

        if (paletteView === 'strip') {
          const wrap = document.createElement('div');
          wrap.className = 'flex rounded-[24px] overflow-hidden';
          wrap.style.height = '112px';
          for (const { r, g, b } of paletteColors) {
            const hex = rgbToHex(r, g, b);
            const el = document.createElement('button');
            el.style.cssText = `flex:1;background:${hex};border:none;cursor:pointer;position:relative;padding:0`;
            el.title = hex;
            el.setAttribute('aria-label', `Select ${hex}`);
            el.addEventListener('click', () => {
              updateColorDisplay(r, g, b);
              addRecentColor(r, g, b);
              closePaletteModal();
            });
            wrap.appendChild(el);
          }
          paletteModalContent.appendChild(wrap);
          return;
        }

        if (paletteView === 'grid') {
          const grid = document.createElement('div');
          grid.className = 'grid grid-cols-4 gap-3';
          for (const { r, g, b } of paletteColors) {
            const hex = rgbToHex(r, g, b);
            const card = document.createElement('button');
            card.style.cssText = `aspect-ratio:1;background:${hex};border:none;border-radius:24px;cursor:pointer;transition:transform 0.12s`;
            card.title = hex;
            card.setAttribute('aria-label', `Select ${hex}`);
            card.addEventListener('mouseenter', () => card.style.transform = 'scale(1.05)');
            card.addEventListener('mouseleave', () => card.style.transform = 'scale(1)');
            card.addEventListener('click', () => {
              updateColorDisplay(r, g, b);
              addRecentColor(r, g, b);
              closePaletteModal();
            });
            grid.appendChild(card);
          }
          paletteModalContent.appendChild(grid);
          return;
        }

        // List
        const list = document.createElement('div');
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.gap = '2px';
        for (const { r, g, b } of paletteColors) {
          const hex = rgbToHex(r, g, b);
          const hsl = rgbToHsl(r, g, b);

          const row = document.createElement('button');
          row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:8px 12px;background:transparent;border:none;border-radius:18px;cursor:pointer;font-family:inherit;text-align:left;color:inherit;transition:background 0.12s;width:100%';
          row.setAttribute('aria-label', `Select palette color ${hex}`);
          row.addEventListener('mouseenter', () => row.style.background = 'var(--surface-hover)');
          row.addEventListener('mouseleave', () => row.style.background = 'transparent');

          const sw = document.createElement('div');
          sw.style.cssText = `width:36px;height:36px;border-radius:18px;flex-shrink:0;background:${hex}`;

          const info = document.createElement('div');
          info.style.cssText = 'flex:1;min-width:0;text-align:left';

          const hexSpan = document.createElement('span');
          hexSpan.style.cssText = 'font-family:ui-monospace,monospace;font-size:12px;display:block';
          hexSpan.textContent = hex;

          const subSpan = document.createElement('span');
          subSpan.style.cssText = 'font-family:ui-monospace,monospace;font-size:10px;display:block;color:var(--muted)';
          subSpan.textContent = `rgb(${r}, ${g}, ${b}) · ${hsl.h}° ${hsl.s}% ${hsl.l}%`;

          info.append(hexSpan, subSpan);
          row.append(sw, info);
          row.addEventListener('click', () => {
            updateColorDisplay(r, g, b);
            addRecentColor(r, g, b);
            closePaletteModal();
          });
          list.appendChild(row);
        }
        paletteModalContent.appendChild(list);
      }

      paletteCopyAllBtn.addEventListener('click', async () => {
        const arr = paletteColors.map(({ r, g, b }) => `"${rgbToHex(r, g, b)}"`).join(', ');
        const ok = await copyText(`[${arr}]`);
        if (ok) flashCopied(paletteCopyAllBtn);
      });

      // ── Canvas: pick color (using cached ImageData) ─────────
      function getCanvasCoords(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        return {
          x: Math.floor((clientX - rect.left) * (canvas.width  / rect.width)),
          y: Math.floor((clientY - rect.top)  * (canvas.height / rect.height)),
        };
      }

      function pickColorAt(clientX, clientY, commit) {
        if (!currentImage || !imageData) return;
        const { x, y } = getCanvasCoords(clientX, clientY);
        if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;

        const data = imageData.data;
        const W = imageData.width, H = imageData.height;
        let tR = 0, tG = 0, tB = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const px = x + dx, py = y + dy;
            if (px < 0 || py < 0 || px >= W || py >= H) continue;
            const i = (py * W + px) * 4;
            tR += data[i]; tG += data[i + 1]; tB += data[i + 2];
            n++;
          }
        }
        if (!n) return;
        const r = Math.round(tR / n);
        const g = Math.round(tG / n);
        const b = Math.round(tB / n);
        updateColorDisplay(r, g, b);
        if (commit) addRecentColor(r, g, b);
      }

      // ── Magnifier ───────────────────────────────────────────
      function scheduleMagnifier(e) {
        lastMove = e;
        if (!rafId) rafId = requestAnimationFrame(onRaf);
      }

      function onRaf() {
        rafId = null;
        if (!lastMove || !currentImage) return;
        updateMagnifier(lastMove.clientX, lastMove.clientY);
      }

      function updateMagnifier(clientX, clientY) {
        if (!imageData) return;
        const { x, y } = getCanvasCoords(clientX, clientY);
        if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
          magnifier.style.display = 'none';
          return;
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

        const i = (y * imageData.width + x) * 4;
        magHex.textContent = rgbToHex(imageData.data[i], imageData.data[i + 1], imageData.data[i + 2]);

        const wrapRect = canvas.parentElement.getBoundingClientRect();
        let left = clientX - wrapRect.left + 16;
        let top  = clientY - wrapRect.top  - 116;
        if (top < 6)                         top  = clientY - wrapRect.top + 16;
        if (left + 108 > wrapRect.width)     left = clientX - wrapRect.left - 112;
        magnifier.style.left = left + 'px';
        magnifier.style.top  = top  + 'px';
        magnifier.style.display = 'block';
      }

      // ── Canvas events (pointer events; drag-to-pick) ────────
      canvas.addEventListener('pointerdown', e => {
        isPicking = true;
        canvas.setPointerCapture(e.pointerId);
        pickColorAt(e.clientX, e.clientY, false);
      });

      canvas.addEventListener('pointermove', e => {
        if (magEnabled) scheduleMagnifier(e);
        if (isPicking) pickColorAt(e.clientX, e.clientY, false);
      });

      canvas.addEventListener('pointerup', e => {
        if (!isPicking) return;
        isPicking = false;
        try { canvas.releasePointerCapture(e.pointerId); } catch {}
        addRecentColor(currentColor.r, currentColor.g, currentColor.b);
      });

      canvas.addEventListener('pointercancel', () => { isPicking = false; });
      canvas.addEventListener('pointerleave', () => {
        if (!isPicking) magnifier.style.display = 'none';
        lastMove = null;
      });

      // ── Toggles ─────────────────────────────────────────────
      function setMag(on) {
        magEnabled = on;
        toggleMagBtn.setAttribute('aria-pressed', String(on));
        toggleMagBtn.classList.toggle('btn-soft', on);
        toggleMagBtn.classList.toggle('btn-ghost', !on);
        if (!on) magnifier.style.display = 'none';
      }
      toggleMagBtn.addEventListener('click', () => setMag(!magEnabled));

      // ── Load image ──────────────────────────────────────────
      function loadImageToCanvas(img) {
        const maxW = 1200, maxH = 800;
        let w = img.naturalWidth  || img.width;
        let h = img.naturalHeight || img.height;
        if (w > maxW) { h = Math.round((maxW / w) * h); w = maxW; }
        if (h > maxH) { w = Math.round((maxH / h) * w); h = maxH; }
        canvas.width = w;
        canvas.height = h;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        // Cache pixels once for O(1) picking
        try {
          imageData = ctx.getImageData(0, 0, w, h);
        } catch {
          imageData = null;
          flashHint('Canvas tainted — use a CORS-friendly image', true);
        }

        currentImage = img;
        canvas.style.display = 'block';
        placeholder.classList.add('hidden');
        resolutionEl.textContent = `${img.naturalWidth || img.width}×${img.naturalHeight || img.height}`;
        paletteColors = [];
        miniPaletteRow.replaceChildren();
        openPaletteModalBtn.classList.add('hidden');
        shadesKey = ''; harmKey = '';
      }

      function handleSource(source, isUrl = false) {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          loadImageToCanvas(img);
          if (!isUrl) URL.revokeObjectURL(img.src);
        };
        img.onerror = () => {
          if (!isUrl) URL.revokeObjectURL(img.src);
          flashHint('Failed to load image', true);
        };
        img.src = isUrl ? source : URL.createObjectURL(source);
      }

      // ── Input handlers ──────────────────────────────────────
      fileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) handleSource(file);
        e.target.value = '';
      });

      loadUrlBtn.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (!url) { flashError(loadUrlBtn); return; }
        handleSource(url, true);
        urlInput.value = '';
        closeMenu();
      });

      urlInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') loadUrlBtn.click();
      });

      pasteClipBtn.addEventListener('click', async () => {
        closeMenu();
        try {
          const items = await navigator.clipboard.read();
          for (const item of items) {
            for (const type of item.types) {
              if (type.startsWith('image/')) {
                handleSource(await item.getType(type));
                return;
              }
            }
          }
          flashHint('No image in clipboard', true);
        } catch {
          flashHint('Clipboard denied — use Ctrl+V', true);
        }
      });

      document.addEventListener('paste', e => {
        if (document.activeElement === urlInput) return;
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            handleSource(item.getAsFile());
            e.preventDefault();
            break;
          }
        }
      });

      // ── Drag & drop ─────────────────────────────────────────
      let dragCounter = 0;
      document.addEventListener('dragenter', e => {
        e.preventDefault();
        dragCounter++;
        if (dragCounter === 1) {
          dragOverlay.classList.remove('hidden');
          dragOverlay.classList.add('flex');
        }
      });
      document.addEventListener('dragleave', () => {
        dragCounter--;
        if (dragCounter <= 0) {
          dragCounter = 0;
          dragOverlay.classList.add('hidden');
          dragOverlay.classList.remove('flex');
        }
      });
      document.addEventListener('dragover', e => e.preventDefault());
      document.addEventListener('drop', e => {
        e.preventDefault();
        dragCounter = 0;
        dragOverlay.classList.add('hidden');
        dragOverlay.classList.remove('flex');
        const file = e.dataTransfer.files[0];
        if (file?.type.startsWith('image/')) handleSource(file);
      });

      // ── Eyedropper ──────────────────────────────────────────
      if (!window.EyeDropper) {
        eyedropperBtn.disabled = true;
        eyedropperBtn.title = 'EyeDropper requires Chrome or Edge';
      } else {
        eyedropperBtn.addEventListener('click', async () => {
          try {
            const { sRGBHex } = await new EyeDropper().open();
            const r = parseInt(sRGBHex.slice(1, 3), 16);
            const g = parseInt(sRGBHex.slice(3, 5), 16);
            const b = parseInt(sRGBHex.slice(5, 7), 16);
            updateColorDisplay(r, g, b);
            addRecentColor(r, g, b);
          } catch {}
        });
      }

      // ── Upload menu ─────────────────────────────────────────
      function openMenu() {
        uploadMenu.classList.remove('hidden');
        uploadMenuBtn.setAttribute('aria-expanded', 'true');
        uploadMenuChevron.style.transform = 'rotate(180deg)';
        requestAnimationFrame(() => urlInput.focus());
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

      // ── Modals ──────────────────────────────────────────────
      function openHelpModal() {
        helpModal.classList.add('open');
        helpModalClose.focus();
      }
      function closeHelpModal() {
        helpModal.classList.remove('open');
        helpBtn.focus();
      }
      helpBtn.addEventListener('click', openHelpModal);
      helpModalClose.addEventListener('click', closeHelpModal);
      helpModal.addEventListener('click', e => { if (e.target === helpModal) closeHelpModal(); });

      function trapFocus(modal, e) {
        if (e.key !== 'Tab') return;
        const focusable = modal.querySelectorAll('button:not([disabled]), input, [tabindex]:not([tabindex="-1"])');
        if (!focusable.length) return;
        const first = focusable[0];
        const last  = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }

      helpModal.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeHelpModal(); return; }
        trapFocus(helpModal, e);
      });
      paletteModal.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closePaletteModal(); return; }
        trapFocus(paletteModal, e);
      });

      // ── Keyboard shortcuts ──────────────────────────────────
      document.addEventListener('keydown', e => {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        const anyModalOpen = helpModal.classList.contains('open') || paletteModal.classList.contains('open');
        if (anyModalOpen) return;

        switch (e.key) {
          case '?':           e.preventDefault(); openHelpModal(); break;
          case 'Escape':      closeMenu(); break;
          case 'h': case 'H': e.preventDefault(); doCopy('hex');   flashHint('Copied HEX');   break;
          case 'r': case 'R': e.preventDefault(); doCopy('rgb');   flashHint('Copied RGB');   break;
          case 's': case 'S': e.preventDefault(); doCopy('hsl');   flashHint('Copied HSL');   break;
          case 'o': case 'O': e.preventDefault(); doCopy('oklch'); flashHint('Copied OKLCH'); break;
          case 'c': case 'C': e.preventDefault(); doCopy('css');   flashHint('Copied CSS');   break;
          case 'e': case 'E': e.preventDefault(); if (!eyedropperBtn.disabled) eyedropperBtn.click(); break;
          case 'u': case 'U': e.preventDefault(); fileInput.click(); break;
          case 'p': case 'P': e.preventDefault(); extractBtn.click(); break;
          case 'm': case 'M': e.preventDefault(); setMag(!magEnabled); break;
          case 'Delete':      e.preventDefault(); clearRecentBtn.click(); break;
        }
      });

      // ── Init ────────────────────────────────────────────────
      updateColorDisplay(30, 95, 255);
      renderRecent();

      const demo = new Image();
      demo.crossOrigin = 'Anonymous';
      demo.src = 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=900';
      demo.onload = () => loadImageToCanvas(demo);

    })();
