/* DexDuet project page: interactive figures. All numbers are those of the paper (Tables 1-3). */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, parent, text) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  };
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Show the cell (x, y, w, h) of a W x H image in an element.
  const sprite = (node, src, W, H, x, y, w, h) => {
    node.style.aspectRatio = `${w} / ${h}`;
    node.style.backgroundImage = `url(${src})`;
    node.style.backgroundSize = `${(100 * W / w).toFixed(3)}% ${(100 * H / h).toFixed(3)}%`;
    node.style.backgroundPosition = `${(100 * x / (W - w)).toFixed(3)}% ${(100 * y / (H - h)).toFixed(3)}%`;
  };
  const tabs = (root, names, onPick) => {
    const box = $('.tabs', root);
    const btns = names.map((n, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tab'; b.textContent = n;
      b.addEventListener('click', () => pick(i)); box.appendChild(b); return b;
    });
    const pick = (i) => { btns.forEach((b, j) => b.setAttribute('aria-pressed', j === i)); onPick(i); };
    return pick;
  };
  // A row of buttons that replaces the figure's control bar; nothing plays by itself.
  const steps = (root, items, onPick, cls = '') => {
    const box = $('.ctrl', root); box.className = 'steps ' + cls; box.innerHTML = '';
    const btns = items.map((html, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.innerHTML = html; b.addEventListener('click', () => pick(i)); box.appendChild(b); return b;
    });
    const pick = (i) => { btns.forEach((b, j) => b.setAttribute('aria-pressed', j === i)); onPick(i); };
    return { pick, btns };
  };

  /* ---- Problem: matched pairs (Fig. S4) ---- */
  if ($('#matched')) {
    const root = $('#matched'), W = 1375, H = 964, xs = [160, 405, 649, 894, 1139], cw = 236, ch = 140;
    const CASES = [
      { name: 'Mixer-170 · Inspire', rows: [28, 172, 338], scores: ['ADD-AUC 95.0 · Contact-AUC 67.2', 'ADD-AUC 94.4 · Contact-AUC 91.5'],
        flags: ['', 'fingers slide', 'hand leaves the part', 'fingers slide', ''] },
      { name: 'Notebook-300 · Inspire', rows: [520, 664, 824], scores: ['ADD-AUC 89.9 · Contact-AUC 52.7', 'ADD-AUC 90.9 · Contact-AUC 82.4'],
        flags: ['fingers slide, hand leaves the part', '', 'hand leaves the part', 'hand leaves the part', ''] },
    ];
    let c = CASES[0];
    const sprites = $$('.sprite', root), flags = $$('.flag', root);
    const draw = (f) => {
      sprites.forEach((s, r) => sprite(s, 'assets/fig/matched_pairs.png', W, H, xs[f], c.rows[r], cw, ch));
      flags[1].textContent = c.flags[f] ? '✕ ' + c.flags[f] : '';
      flags[2].textContent = c.flags[f] ? '✓ contact preserved' : '';
    };
    const st = steps(root, [1, 2, 3, 4, 5].map((n) => `<i></i>Frame ${n}`), draw);
    tabs(root, CASES.map((x) => x.name), (i) => {
      c = CASES[i];
      $$('[data-score]', root).forEach((s) => { s.textContent = c.scores[+s.dataset.score]; });
      st.btns.forEach((b, f) => { b.classList.toggle('warn', !!c.flags[f]); b.title = c.flags[f] ? 'DexMachina: ' + c.flags[f] : ''; });
      st.pick(1);
    })(0);
  }

  /* ---- Method: A-RSI illustration ---- */
  {
    const root = $('#arsi'), svg = $('svg', root), B = 12, HARD = 7;
    const sim = (u) => {
      const ceil = u < 0.7 ? 1 - 0.5 * (u / 0.7) : Math.max(0, 0.5 * (1 - (u - 0.7) / 0.25));
      const h = [], f = [];
      for (let b = 0; b < B; b++) {
        if (b === HARD) {
          const v = u < 0.3 ? 1 : u < 0.42 ? lerp(1, 0.5, (u - 0.3) / 0.12) : u < 0.52 ? lerp(0.5, 0.62, (u - 0.42) / 0.1) : lerp(0.62, 0, (u - 0.52) / 0.4);
          h.push(clamp(Math.min(v, ceil)));
          f.push(u < 0.42 ? lerp(0.55, 0.9, u / 0.42) : lerp(0.9, 0.05, clamp((u - 0.42) / 0.5)));
        } else {
          h.push(Math.min(clamp(1 - (u - (0.1 + 0.05 * ((b * 5) % 7))) / 0.35), ceil));
          f.push((b === HARD - 1 ? 0.24 : 0.07) * (1 - 0.7 * u) + 0.02);
        }
      }
      const F = f.map((_, b) => { let s = 0; for (let k = 0; b + k < B; k++) s += Math.pow(0.5, k) * f[b + k]; return s; });
      const sum = F.reduce((a, x) => a + x, 0);
      return { h, f, p: F.map((x) => 0.3 / B + 0.7 * x / sum), ceil };
    };
    // Three lanes over the same twelve segments. Each bar sits on a faint track that marks its full range.
    // Drawn for the width the figure gets: a phone gets a narrower drawing with shorter labels, so the lettering keeps its size.
    const MUTED = '#6b6e85';
    const rows = {
      f: { y: 156, H: 56, c: '#e5484d', t: 'Failure rate', d: 'how often the policy fails in each segment', n: 'how often each segment fails', s: 1 },
      h: { y: 266, H: 62, c: '#6a4fe0', t: 'Assistance', d: 'support given to the object', n: 'support given to the object', s: 1 },
      p: { y: 376, H: 62, c: '#12a594', t: 'Start probability', d: 'where training episodes begin', n: 'where episodes begin', s: 0.4 },
    };
    let bars = {}, ceilLine, ceilTxt, slim = null;
    const layout = (narrow) => {
      slim = narrow; root.dataset.layout = narrow ? 'slim' : 'wide'; svg.textContent = '';
      const W = narrow ? 340 : 560, X0 = narrow ? 2 : 16, X1 = W - X0, cw = (X1 - X0) / B, bw = cw * 0.46, fs = narrow ? 12.5 : 12, rx = narrow ? 4 : 5;
      svg.setAttribute('viewBox', `0 0 ${W} 400`);
      el('rect', { x: X0 + HARD * cw + (narrow ? 1 : 2), y: 30, width: cw - (narrow ? 2 : 4), height: 356, rx: narrow ? 7 : 10, fill: 'rgba(229,72,77,.07)' }, svg);
      el('text', { x: X0, y: 20, 'font-size': 11, 'font-weight': 600, 'letter-spacing': '.1em', fill: MUTED }, svg, narrow ? 'DEMONSTRATION' : 'DEMONSTRATION, IN SEGMENTS');
      el('text', { x: X0 + (HARD + 0.5) * cw, y: 20, 'text-anchor': 'middle', 'font-size': fs, 'font-weight': 600, fill: '#e5484d' }, svg, 'hard phase');
      for (let b = 0; b < B; b++) el('rect', { x: X0 + b * cw + (narrow ? 2 : 3), y: 38, width: cw - (narrow ? 4 : 6), height: 8, rx: 4, fill: b === HARD ? '#e5484d' : '#d6d9e4' }, svg);
      for (const r in rows) {
        const R = rows[r];
        const lab = el('text', { x: X0, y: R.y - R.H - 12, 'font-size': narrow ? 14 : 13.5, 'font-weight': 650, fill: R.c }, svg, R.t);
        el('tspan', { dx: narrow ? 7 : 8, 'font-size': fs, 'font-weight': 400, fill: MUTED }, lab, narrow ? R.n : R.d);
        bars[r] = Array.from({ length: B }, (_, b) => {
          const x = X0 + b * cw + (cw - bw) / 2;
          el('rect', { x, y: R.y - R.H, width: bw, height: R.H, rx, fill: '#f1f2f8' }, svg);
          return el('rect', { x, width: bw, rx, fill: R.c }, svg);
        });
      }
      ceilLine = el('line', { x1: X0, x2: X1, stroke: '#4a36b8', 'stroke-width': 1.5, 'stroke-dasharray': '2 5', 'stroke-linecap': 'round' }, svg);
      ceilTxt = el('text', { x: X1, 'text-anchor': 'end', 'font-size': fs, 'font-weight': 600, fill: '#4a36b8' }, svg, 'ceiling');
      const uy = rows.p.y - rows.p.H * (1 / B) / rows.p.s;
      el('line', { x1: X0, x2: X1, y1: uy, y2: uy, stroke: MUTED, 'stroke-width': 1.2, 'stroke-dasharray': '2 5', 'stroke-linecap': 'round' }, svg);
      el('text', { x: X1, y: uy - 5, 'text-anchor': 'end', 'font-size': fs, fill: MUTED }, svg, 'uniform');
    };
    layout(false);
    const phase = document.createElement('p'); phase.className = 'phase'; phase.setAttribute('aria-live', 'polite');
    $('.ctrl', root).before(phase);
    const PHASES = [[0.1, 'Every segment starts fully assisted.'], [0.42, 'Assistance is withdrawn where the policy succeeds.'],
      [0.55, 'The hard phase keeps failing, so its assistance is restored.'], [0.93, 'Episodes start more often just before the hard phase, and the ceiling lowers.'],
      [2, 'No assistance is left: the policy runs on its own.']];
    const draw = (u) => {
      if (!Number.isFinite(u)) return;
      const a = sim(u);
      for (const r in rows) a[r].forEach((x, b) => {
        const hh = Math.max(3, rows[r].H * Math.min(1, x / rows[r].s));
        bars[r][b].setAttribute('y', rows[r].y - hh); bars[r][b].setAttribute('height', hh);
      });
      const cy = rows.h.y - rows.h.H * a.ceil;
      ceilLine.setAttribute('y1', cy); ceilLine.setAttribute('y2', cy); ceilTxt.setAttribute('y', cy - 5);
      ceilLine.style.opacity = ceilTxt.style.opacity = a.ceil > 0.01 ? 1 : 0;
      phase.textContent = (PHASES.find((x) => u < x[0]) || PHASES[PHASES.length - 1])[1];
    };
    // Five moments of training; choosing one moves the bars there.
    const STAGES = [['Start', 0.02], ['Withdraw', 0.3], ['Restore', 0.5], ['Refocus', 0.75], ['Unassisted', 1]];
    // Training progress follows the scroll position: the bars play as the figure moves up the window.
    // A click on a moment moves only the figure, and the figure then stays there until it has left the window.
    const TOP = 0.3, BOTTOM = 0.8;                       // figure centre, as a share of the window height, at the end and the start
    const place = () => (root.getBoundingClientRect().top + root.getBoundingClientRect().height / 2) / innerHeight;
    let u = STAGES[0][1], manual = false, raf = null, timer = null;
    const ctl = steps(root, STAGES.map(([n], i) => `<b>${i + 1}</b>${n}`), (i) => {
      manual = true;
      const from = u, to = STAGES[i][1], t0 = performance.now(), dur = still ? 1 : 500 + 900 * Math.abs(to - from);
      cancelAnimationFrame(raf); clearTimeout(timer);
      const tick = (ts) => {
        const k = clamp((ts - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k);
        u = lerp(from, to, e); draw(u);
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      timer = setTimeout(() => { cancelAnimationFrame(raf); u = to; draw(u); }, dur + 300); // lands even where frames are paused
    });
    const follow = () => {
      if (manual || !innerHeight) return;                // a window without a height (a pane still in the background) has no position to follow
      u = lerp(STAGES[0][1], 1, clamp((BOTTOM - place()) / (BOTTOM - TOP)));
      draw(u);
      let near = 0;
      STAGES.forEach((x, i) => { if (Math.abs(x[1] - u) < Math.abs(STAGES[near][1] - u)) near = i; });
      ctl.btns.forEach((x, i) => x.setAttribute('aria-pressed', i === near));
    };
    new IntersectionObserver((es) => { if (!es[0].isIntersecting && manual) { manual = false; follow(); } }).observe(root);
    addEventListener('scroll', follow, { passive: true });
    addEventListener('resize', follow);
    follow();
    new ResizeObserver(() => { const w = root.clientWidth; if (w && (w < 500) !== slim) { layout(w < 500); draw(u); } }).observe(root);
  }

  /* ---- Results: chart (Table 1) ---- */
  {
    const root = $('#chart'), svg = $('svg', root), wrap = $('.chartwrap', root);
    const GROUPS = ['Inspire', 'Allegro', 'XHand', 'Schunk', 'Inspire', 'Inspire', 'G1 + Dex3'];
    const BASES = ['DexMachina', 'DexMachina', 'DexMachina', 'DexMachina', 'SPIDER', 'ManipTrans', 'CHORD (PPO)'];
    const SUITES = [['DexMachina suite', 0, 3], ['SPIDER suite', 4, 4], ['ManipTrans suite', 5, 5], ['V2D challenge', 6, 6]];
    const M = [
      ['ADD-AUC', [52.5, 65.8, 60.7, 73.7, 47.5, 87.0, 39.8], [88.7, 94.8, 93.6, 94.1, 88.5, 98.4, 77.4]],
      ['SP-SR', [53.7, 67.9, 62.3, 79.2, 34.3, 87.1, 53.3], [94.3, 100.0, 100.0, 100.0, 97.1, 99.9, 85.0]],
      ['MP-SR', [53.7, 67.9, 62.2, 76.4, 31.4, 84.9, 15.8], [94.3, 100.0, 97.1, 100.0, 94.3, 99.9, 75.8]],
      ['MPPE', [40.7, 23.4, 28.7, 12.1, 44.33, 4.68, 14.85], [1.50, 1.02, 1.09, 1.06, 3.61, 0.44, 12.19], 50],   // cm, lower is better, axis up to 50
      ['Contact-AUC', [33.6, 35.8, 38.2, 45.2, 36.5, 72.6, 16.0], [79.6, 68.0, 79.5, 80.4, 76.9, 82.7, 72.6]],
    ];
    const top = (k) => M[k][3] || 100, cm = (k) => M[k][0] === 'MPPE';
    const fmt = (k, v) => (cm(k) && v < 10 ? v.toFixed(2) : v.toFixed(1)), signed = (k, v) => (v < 0 ? '−' : '+') + fmt(k, Math.abs(v));
    const INK = '#151623', MUTED = '#6b6e85';
    const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; wrap.appendChild(tip);
    const stat = document.createElement('p'); stat.className = 'stat'; stat.innerHTML = '<b></b><span></span>'; wrap.after(stat);
    let k0 = 0, cur = { b: M[0][1].slice(), d: M[0][2].slice() }, raf = null, gain = 0;
    let bars = [], ticks = [], paint = () => {}, layout = '';

    // The chart is drawn for the width it gets, so it never has to be scrolled sideways:
    // columns with room to spare, tighter columns on a tablet, and rows of horizontal bars on a phone.
    const columns = (W, X0, GW, bw, suiteSize) => {
      const Y0 = 330, H = 270;
      svg.setAttribute('viewBox', `0 28 ${W} 402`);
      for (const v of [0, 25, 50, 75, 100]) {
        el('line', { x1: X0 - 8, x2: X0 + 7 * GW, y1: Y0 - H * v / 100, y2: Y0 - H * v / 100, stroke: v ? '#eff0f8' : '#b4b8c5', 'stroke-width': v ? 1 : 1.5 }, svg);
        ticks.push([v, el('text', { x: X0 - 14, y: Y0 - H * v / 100 + 4, 'text-anchor': 'end', 'font-size': 12, fill: MUTED }, svg, v)]);
      }
      bars = GROUPS.map((name, i) => {
        const cx = X0 + i * GW + GW / 2;
        el('text', { x: cx, y: Y0 + 22, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 650, fill: INK }, svg, name);
        el('text', { x: cx, y: Y0 + 40, 'text-anchor': 'middle', 'font-size': 11.5, fill: MUTED }, svg, 'vs. ' + BASES[i]);
        return {
          b: el('rect', { x: cx - bw - 3, width: bw, rx: 5, fill: '#b4b8c5' }, svg), d: el('rect', { x: cx + 3, width: bw, rx: 5, fill: 'url(#gd)' }, svg),
          bt: el('text', { x: cx - bw / 2 - 3, 'text-anchor': 'middle', 'font-size': 12.5, fill: MUTED }, svg),
          dt: el('text', { x: cx + bw / 2 + 3, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700, fill: '#4a36b8' }, svg),
        };
      });
      SUITES.forEach(([name, a, b]) => {
        const x1 = X0 + a * GW + 12, x2 = X0 + (b + 1) * GW - 12;
        el('line', { x1, x2, y1: Y0 + 54, y2: Y0 + 54, stroke: INK, 'stroke-width': 1.5 }, svg);
        el('text', { x: (x1 + x2) / 2, y: Y0 + 74, 'text-anchor': 'middle', 'font-size': suiteSize, 'font-weight': 650, fill: INK }, svg, name);
      });
      // hover: one invisible column per setting; the others fade and a read-out names the two values and the gap
      bars.forEach((gr, i) => {
        const hit = el('rect', { x: X0 + i * GW, y: Y0 - H - 24, width: GW, height: H + 70, fill: 'transparent' }, svg);
        hit.addEventListener('pointerenter', () => {
          const b = M[k0][1][i], d = M[k0][2][i];
          bars.forEach((o, j) => ['b', 'd', 'bt', 'dt'].forEach((w) => o[w].setAttribute('opacity', j === i ? 1 : 0.3)));
          tip.innerHTML = `<b>${GROUPS[i]}</b> · ${M[k0][0]}<br>${BASES[i]} ${fmt(k0, b)} → DexDuet ${fmt(k0, d)}${cm(k0) ? ' cm' : ''} <em>${signed(k0, d - b)}</em>`;
          tip.hidden = false;
          // centred over the setting, but kept inside the chart so the first and last settings are not cut off
          const w = svg.getBoundingClientRect().width, half = tip.offsetWidth / 2 + 4;
          tip.style.left = `${Math.min(w - half, Math.max(half, w * (X0 + i * GW + GW / 2) / W))}px`;
        });
        hit.addEventListener('pointerleave', () => { tip.hidden = true; bars.forEach((o) => ['b', 'd', 'bt', 'dt'].forEach((w) => o[w].removeAttribute('opacity'))); });
      });
      paint = (v) => bars.forEach((gr, i) => ['b', 'd'].forEach((w) => {
        const hh = H * Math.min(1, v[w][i] / top(k0));
        gr[w].setAttribute('y', Y0 - hh); gr[w].setAttribute('height', hh);
        gr[w + 't'].setAttribute('y', Y0 - hh - 7); gr[w + 't'].textContent = fmt(k0, v[w][i]);
      }));
    };
    const rows = () => {
      const W = 320, BW = W - 46;                       // the longest bar leaves room for its number
      let y = 2;
      bars = [];
      SUITES.forEach(([name, a, b]) => {
        el('text', { x: 0, y: y + 12, 'font-size': 11.5, 'font-weight': 700, 'letter-spacing': '.07em', fill: MUTED }, svg, name.toUpperCase());
        el('line', { x1: 0, x2: W, y1: y + 19, y2: y + 19, stroke: '#e4e6f0', 'stroke-width': 1 }, svg);
        y += 26;
        for (let i = a; i <= b; i++) {
          const lab = el('text', { x: 0, y: y + 13, 'font-size': 13.5, 'font-weight': 650, fill: INK }, svg, GROUPS[i]);
          el('tspan', { dx: 6, 'font-size': 12.5, 'font-weight': 400, fill: MUTED }, lab, 'vs. ' + BASES[i]);
          bars[i] = {
            b: el('rect', { x: 0, y: y + 21, height: 11, rx: 5.5, fill: '#b4b8c5' }, svg), d: el('rect', { x: 0, y: y + 36, height: 13, rx: 6.5, fill: 'url(#gh)' }, svg),
            bt: el('text', { y: y + 31, 'font-size': 12, fill: MUTED }, svg), dt: el('text', { y: y + 47.5, 'font-size': 13.5, 'font-weight': 700, fill: '#4a36b8' }, svg),
          };
          y += 62;
        }
        y += 4;
      });
      svg.setAttribute('viewBox', `0 0 ${W} ${y - 8}`);
      paint = (v) => bars.forEach((gr, i) => ['b', 'd'].forEach((w) => {
        const ww = Math.max(3, BW * Math.min(1, v[w][i] / top(k0)));
        gr[w].setAttribute('width', ww); gr[w + 't'].setAttribute('x', ww + 6); gr[w + 't'].textContent = fmt(k0, v[w][i]);
      }));
    };
    const build = (name) => {
      layout = name; wrap.dataset.layout = name; tip.hidden = true;
      svg.textContent = ''; ticks = [];
      const defs = el('defs', {}, svg);
      [['gd', 0, 1, 0, 0], ['gh', 0, 0, 1, 0]].forEach(([id, x1, y1, x2, y2]) => {
        const g = el('linearGradient', { id, x1, y1, x2, y2 }, defs);
        el('stop', { offset: 0, 'stop-color': '#12a594' }, g); el('stop', { offset: 1, 'stop-color': '#7a5cf0' }, g);
      });
      if (name === 'rows') rows(); else if (name === 'mid') columns(770, 46, 102, 34, 11.5); else columns(1000, 60, 132, 44, 12.5);
      ticks.forEach(([v, t]) => { t.textContent = v * top(k0) / 100; });
      paint(cur);
    };
    const fit = () => {
      const w = wrap.clientWidth; if (!w) return;        // hidden behind another tab: keep the last layout
      const name = w >= 880 ? 'wide' : w >= 680 ? 'mid' : 'rows';
      if (name !== layout) build(name);
    };
    const headline = (k, g) => {
      const ds = M[k][2].map((d, i) => d - M[k][1][i]);
      stat.firstChild.textContent = (g < 0 ? '−' : '+') + Math.abs(g).toFixed(1);
      stat.lastChild.innerHTML = cm(k)
        ? `cm of MPPE below the baseline (lower is better), <br>mean of the seven settings, from −${Math.min(...ds.map(Math.abs)).toFixed(1)} to −${Math.max(...ds.map(Math.abs)).toFixed(1)} cm`
        : `points of ${M[k][0]} over the baseline, <br>mean of the seven settings, from +${Math.min(...ds).toFixed(1)} to +${Math.max(...ds).toFixed(1)}`;
    };
    // bars move to metric k; with `grow` they first drop to zero and rise one setting after the other
    const run = (k, grow) => {
      const to = { b: M[k][1], d: M[k][2] }, t0 = performance.now(), g1 = to.d.reduce((a, d, i) => a + d - to.b[i], 0) / 7, g0 = grow ? 0 : gain;
      let from = cur, zeroed = false; k0 = k;
      ticks.forEach(([v, t]) => { t.textContent = v * top(k) / 100; });
      cancelAnimationFrame(raf);
      const tick = (ts) => {
        if (grow && !zeroed) { from = { b: to.b.map(() => 0), d: to.d.map(() => 0) }; zeroed = true; }
        const ease = (i) => { const p = still ? 1 : clamp((ts - t0 - (grow ? i * 70 : 0)) / (grow ? 800 : 600)); return 1 - Math.pow(1 - p, 3); };
        cur = { b: from.b.map((x, i) => lerp(x, to.b[i], ease(i))), d: from.d.map((x, i) => lerp(x, to.d[i], ease(i))) };
        paint(cur); gain = lerp(g0, g1, ease(0)); headline(k, gain);
        if (ease(6) < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    build('wide'); fit();
    new ResizeObserver(fit).observe(wrap);
    tabs(root, M.map((m) => m[0] + (m[0] === 'MPPE' ? ' ↓' : ' ↑')), (k) => run(k, false))(0);
    paint(cur);                                          // correct even where animation frames are paused
    gain = M[0][2].reduce((a, d, i) => a + d - M[0][1][i], 0) / 7; headline(0, gain);
    // the bars grow once, the first time the chart is seen; scrolling back to it finds the numbers in place
    const first = new IntersectionObserver((es) => { if (es[0].isIntersecting) { first.disconnect(); run(k0, true); } }, { threshold: 0.35 });
    first.observe(svg);
  }

  /* ---- Results: matched pairs and hold rate (Table 2) ---- */
  $('#pairs').innerHTML = [['Inspire', 28, 28, '+22.4'], ['Allegro', 41, 42, '+20.0'], ['XHand', 19, 20, '+12.4'], ['Schunk', 29, 32, '+16.8']]
    .map(([n, a, b, gain]) => `<div class="hand"><b>${n}</b><div class="dots">${Array.from({ length: b }, (_, i) => `<i class="${i < a ? '' : 'no'}" style="--i:${i}"></i>`).join('')}</div><span><b>${a}</b> vs ${b - a}<small>${gain} Contact-AUC</small></span></div>`).join('')
    + '<p class="sum"><b>117 vs 5</b><span>Of 122 pairs, DexDuet has the higher Contact-AUC in 117 and DexMachina in 5; the median gain is <b>17.9 points</b>.</span></p>';
  $('#hold').innerHTML = [['Inspire', 17.0, 37.1], ['Allegro', 14.1, 22.9], ['XHand', 5.7, 25.7], ['Schunk', 25.5, 42.9], ['All', 15.6, 32.1]]
    .map(([n, b, d]) => `<div class="hbar"><b>${n}</b><div style="width:${b * 1.6}%" data-v="${b.toFixed(1)}"></div><span></span><div class="d" style="width:${d * 1.6}%" data-v="${d.toFixed(1)}"></div></div>`).join('');

  // entry animation of the dots and bars: the class is set while the block is on screen, so it replays on return
  $$('#pairs, #hold').forEach((box) => {                // dots and bars fill in once, the first time they are seen
    box.classList.add('anim');
    const first = new IntersectionObserver((es) => { if (es[0].isIntersecting) { first.disconnect(); box.classList.add('in'); } }, { threshold: 0.3 });
    first.observe(box);
  });

  /* ---- Results: where the hands touch (Fig. 3) ---- */
  if ($('#cases')) {
    const root = $('#cases'), imgs = $$('.panel img', root), base = $('[data-base]', root);
    const CASES = [['Box-200 · Inspire', 'DexMachina'], ['Ketchup-100 · XHand', 'DexMachina'], ['Mixer-170 · Allegro', 'DexMachina'], ['Notebook-300 · Schunk', 'DexMachina'], ['Spray bottle · G1 + Dex3', 'CHORD'], ['Basket · G1 + Dex3', 'CHORD']];
    tabs(root, CASES.map((c) => c[0]), (i) => {
      ['h', 'b', 'd'].forEach((k, j) => { imgs[j].src = `assets/fig/cmp_${k}${i + 1}.png`; });
      base.textContent = CASES[i][1];
    })(2);
  }

  /* ---- Results: ablations (Table 3) and all metrics (Table 1) ---- */
  {
    // [row, what it changes, per-hand, A-RSI, hand graph, contact, ADD-AUC, Contact-AUC, updates]
    const ABL = [
      ['(a)', 'DexDuet, all components', 1, 1, 1, 1, 89.7, 80.5, '5,524'],
      ['(b)', 'without the hand graph reward', 1, 1, 0, 1, 87.5, 71.5, '6,721'],
      ['(c)', 'without the hand-object contact reward', 1, 1, 1, 0, 86.4, 65.4, '5,836'],
      ['(d)', 'without both interaction rewards', 1, 1, 0, 0, 76.7, 49.0, '6,745'],
      ['(e)', 'one unified policy instead of the per-hand policy', 0, 1, 1, 1, 74.1, 62.1, '6,255'],
      ['(f)', 'without both interaction rewards and <span class="nb">A-RSI</span>', 1, 0, 0, 0, 79.4, 47.6, '6,845'],
      ['(g)', 'a single-level curriculum instead of <span class="nb">A-RSI</span>', 1, 0, 1, 1, 88.4, 74.2, '6,608'],
    ];
    const metric = (v, ref) => `<td class="m"><span class="bar"><i style="width:${v}%"></i></span><b>${v.toFixed(1)}</b>`
      + `<small>${v === ref ? '' : '&minus;' + (ref - v).toFixed(1)}</small></td>`;
    $('#abl tbody').innerHTML = ABL.map((r, i) => `<tr class="${i ? '' : 'ours'}"><td><span class="row">${r[0]}</span><span class="nm">${r[1]}</span></td>`
      + r.slice(2, 6).map((x) => `<td class="c">${x ? '<span class="dot-on" title="kept"></span>' : '<span class="dot-off" title="removed or replaced"></span>'}</td>`).join('')
      + metric(r[6], ABL[0][6]) + metric(r[7], ABL[0][7]) + `<td class="u">${r[8]}</td></tr>`).join('');
  }
  {
    const ROWS = [
      ['DexMachina suite'],
      ['Inspire', 'DexMachina', 52.5, 53.7, 53.7, '40.7', 33.6], ['Inspire', 'DexDuet', 88.7, 94.3, 94.3, '1.50', 79.6],
      ['Allegro', 'DexMachina', 65.8, 67.9, 67.9, '23.4', 35.8], ['Allegro', 'DexDuet', 94.8, 100.0, 100.0, '1.02', 68.0],
      ['XHand', 'DexMachina', 60.7, 62.3, 62.2, '28.7', 38.2], ['XHand', 'DexDuet', 93.6, 100.0, 97.1, '1.09', 79.5],
      ['Schunk', 'DexMachina', 73.7, 79.2, 76.4, '12.1', 45.2], ['Schunk', 'DexDuet', 94.1, 100.0, 100.0, '1.06', 80.4],
      ['SPIDER suite'],
      ['Inspire', 'SPIDER', 47.5, 34.3, 31.4, '44.33', 36.5], ['Inspire', 'DexDuet', 88.5, 97.1, 94.3, '3.61', 76.9],
      ['ManipTrans suite'],
      ['Inspire', 'ManipTrans', 87.0, 87.1, 84.9, '4.68', 72.6], ['Inspire', 'DexDuet', 98.4, 99.9, 99.9, '0.44', 82.7],
      ['V2D challenge'],
      ['G1 + Dex3', 'CHORD (PPO)', 39.8, 53.3, 15.8, '14.85', 16.0], ['G1 + Dex3', 'CHORD (FlashSAC)', 32.0, 35.0, 12.5, '37.77', 13.0], ['G1 + Dex3', 'DexDuet', 77.4, 85.0, 75.8, '12.19', 72.6],
    ];
    const groups = []; ROWS.forEach((r) => (r.length === 1 ? groups.push([r]) : groups[groups.length - 1].push(r)));
    const html = [];
    for (const gr of groups) {
      html.push(`<tr class="suite"><td colspan="7">${gr[0][0]}</td></tr>`);
      const rows = gr.slice(1);
      for (const r of rows) {
        const cells = r.slice(2).map((v, j) => {
          const col = rows.map((x) => Number(x[j + 2])), lo = Math.min(...col), hi = Math.max(...col);
          let k = hi > lo ? (Number(v) - lo) / (hi - lo) : 0; if (j === 3) k = 1 - k; // MPPE: lower is better
          return `<td class="shade" style="--a:${(0.02 + 0.16 * k).toFixed(2)}">${typeof v === 'string' ? v : v.toFixed(1)}</td>`;
        }).join('');
        html.push(`<tr class="${r[1] === 'DexDuet' ? 'ours' : ''}"><td>${r[0]}</td><td data-robot="${r[0]}">${r[1]}</td>${cells}</tr>`);
      }
    }
    $('#tbl tbody').innerHTML = html.join('');
  }

  /* ---- Real robots: frame-by-frame replays (Figs. S7, S8) ---- */
  if ($('#flip')) {
    const root = $('#flip'), node = $('.sprite', root), W = 1375;
    const TASKS = [['Box placement · G1', 'rollout_box', 605], ['Bag placement · G1', 'rollout_bag', 605], ['Chair pushing · G1', 'rollout_chair', 605],
      ['Bottle reorientation · Franka + Allegro', 'rollout_table', 343], ['Gamepad placement · Franka + Allegro', 'rollout_place', 343]];
    let t = TASKS[0];
    const put = (el, f) => {
      const cw = W / 6, chh = t[2] / 2;
      sprite(el, `assets/fig/${t[1]}.png`, W, t[2], (f % 6) * cw + 2, Math.floor(f / 6) * chh + 2, cw - 5, chh - 6);
    };
    // Twelve thumbnails: point at one (or tap it) to see that moment.
    const st = steps(root, Array.from({ length: 12 }, () => ''), (f) => put(node, f), 'thumbs');
    st.btns.forEach((b, f) => {
      b.setAttribute('aria-label', `Frame ${f + 1} of 12`);
      b.addEventListener('mouseenter', () => st.pick(f)); b.addEventListener('focus', () => st.pick(f));
    });
    tabs(root, TASKS.map((x) => x[0]), (i) => {
      t = TASKS[i]; node.style.maxWidth = t[2] > 400 ? '380px' : '620px';
      st.btns.forEach(put); st.pick(0);
    })(0);
  }
})();

// copy button on the BibTeX block
document.querySelectorAll('.bib .copy').forEach((b) => b.addEventListener('click', async () => {
  const text = b.parentElement.querySelector('code').textContent;
  try { await navigator.clipboard.writeText(text); }
  catch (e) { const r = document.createRange(); r.selectNodeContents(b.parentElement.querySelector('code')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); document.execCommand('copy'); sel.removeAllRanges(); }
  b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy'; }, 1600);
}));
