// Rollout videos: baseline comparison, blind A/B ablation clips, four hands, humanoid study.
(() => {
  const R = 'assets/roll/';
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (box, names, onPick, start = 0) => {
    const btns = names.map((n, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tab'; b.textContent = n;
      b.addEventListener('click', () => pick(i)); box.appendChild(b); return b;
    });
    const pick = (i) => { btns.forEach((b, j) => b.setAttribute('aria-pressed', j === i)); onPick(i); };
    pick(start);
    return pick;
  };
  // Nothing below the first screen is fetched while the cover loads. A clip's poster waits until the page has loaded, and the clip
  // itself starts downloading when it is about a screen away. (No load() calls: an explicit load() makes Chrome ignore preload="none".)
  const posters = new Map();
  let settled = false;
  const lean = !!(navigator.connection && navigator.connection.saveData);      // the visitor asked the browser to save data: fetch a clip only when it plays
  const near = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    const v = e.target.tagName === 'VIDEO' ? e.target : e.target.querySelector('video');
    v.dataset.near = 1; if (!lean) v.preload = 'auto';
    if (posters.has(v)) { v.poster = posters.get(v); posters.delete(v); }
  }), { rootMargin: '900px 0px' });
  const setPoster = (v, url) => { if (settled || v.dataset.near) v.poster = url; else posters.set(v, url); };
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  addEventListener('load', () => setTimeout(() => {
    settled = true; if (!lean) { posters.forEach((url, v) => { v.poster = url; }); posters.clear(); }
    document.querySelectorAll('image[data-href]').forEach((im) => im.setAttribute('href', im.dataset.href));      // pictures inside the method figures
  }, 1200));

  // A looping clip that plays only while it is on screen; a click pauses it.
  const player = (v, rate = 1) => {
    let seen = false, held = false;
    const sync = () => { if (seen && !held) { v.playbackRate = rate; v.play().catch(() => {}); } else v.pause(); };
    new IntersectionObserver((es) => { seen = es[0].isIntersecting; sync(); }, { threshold: 0.25 }).observe(v);
    near.observe(v); v.tabIndex = -1;
    if (!v.controls) v.addEventListener('click', () => { held = !held; v.parentElement.classList.toggle('held', held); sync(); });
    return {
      show(src, poster, keepTime = false) {
        const t = keepTime ? v.currentTime : 0;
        setPoster(v, poster); v.src = src;
        if (t) v.addEventListener('loadedmetadata', () => { v.currentTime = Math.min(t, v.duration || t); }, { once: true });
        held = false; v.parentElement.classList.remove('held'); sync();
      },
      set rate(r) { rate = r; v.playbackRate = r; },
    };
  };

  // A card with a divider to drag. Its clip holds `n` panels side by side from one camera; panel `ia` shows left of the divider, `ib` right.
  const wipe = (grid, title, n, ia, ib, left, right, rate = 1) => {
    const card = document.createElement('figure');
    card.innerHTML = '<div class="cell"><video class="b" muted loop playsinline preload="none"></video><div class="a"><video muted loop playsinline preload="none"></video></div>'
      + `<span class="tag l">${left}</span><span class="tag r">${right}</span><div class="bar"><button type="button" aria-label="Divider between ${left} and ${right}"></button></div></div>`
      + `<figcaption><b>${title}</b><span></span></figcaption>`;
    grid.appendChild(card);
    const cell = $('.cell', card), va = $('.a video', card), vb = $('video.b', card), note = $('figcaption span', card);
    [[va, ia], [vb, ib]].forEach(([v, i]) => { v.style.width = `${n * 100}%`; v.style.left = `${-i * 100}%`; });
    let seen = false;
    const sync = () => [va, vb].forEach((v) => { if (seen) { v.playbackRate = rate; v.play().catch(() => {}); } else v.pause(); });
    new IntersectionObserver((es) => { seen = es[0].isIntersecting; sync(); }, { threshold: 0.2 }).observe(cell);
    vb.addEventListener('timeupdate', () => { if (Math.abs(va.currentTime - vb.currentTime) > 0.12) va.currentTime = vb.currentTime; });
    const set = (x) => cell.style.setProperty('--x', `${(100 * Math.min(0.97, Math.max(0.03, x))).toFixed(1)}%`);
    const at = (e) => set((e.clientX - cell.getBoundingClientRect().left) / cell.clientWidth);
    const knob = $('button', card);
    knob.addEventListener('pointerdown', (e) => { knob.setPointerCapture(e.pointerId); e.preventDefault(); });
    knob.addEventListener('pointermove', (e) => { if (knob.hasPointerCapture(e.pointerId)) at(e); });
    knob.addEventListener('keydown', (e) => {
      const x = parseFloat(getComputedStyle(cell).getPropertyValue('--x')) / 100;
      if (e.key === 'ArrowLeft') set(x - 0.05); else if (e.key === 'ArrowRight') set(x + 0.05);
    });
    cell.addEventListener('click', (e) => { if (e.target !== knob) at(e); });
    return (src, poster, keep, text = '', bad = false) => {
      const t = keep ? vb.currentTime : 0;
      [va, vb].forEach((v) => {
        setPoster(v, poster); v.src = src;
        if (t) v.addEventListener('loadedmetadata', () => { v.currentTime = t; }, { once: true });
      });
      note.textContent = text; note.className = bad ? 'bad' : '';
      if (!keep) set(0.5);
      sync();
    };
  };

  // A card whose clip holds `n` panels side by side from one camera; it shows the `labels.length` panels from panel `i0` on, each with its label.
  const side = (grid, title, n, i0, labels, rate = 1) => {
    const m = labels.length, card = document.createElement('figure');
    card.innerHTML = '<div class="cell"><video muted loop playsinline preload="none"></video>'
      + labels.map((l, k) => `<span class="tag${k === m - 1 ? ' ours' : ''}" style="left:calc(${100 * k / m}% + 8px)">${l}</span>`).join('')
      + labels.slice(1).map((l, k) => `<i style="left:${100 * (k + 1) / m}%"></i>`).join('') + '</div><figcaption><b></b><span></span></figcaption>';
    grid.appendChild(card);
    const v = $('video', card), name = $('figcaption b', card), note = $('figcaption span', card);
    v.style.width = `${100 * n / m}%`; v.style.left = `${-100 * i0 / m}%`; v.tabIndex = -1;
    near.observe(card);
    new IntersectionObserver((es) => { if (es[0].isIntersecting) { v.playbackRate = rate; v.play().catch(() => {}); } else v.pause(); }, { threshold: 0.2 }).observe(card);
    name.textContent = title;
    return (src, poster, keep, text = '', bad = false, head = title) => {
      const t = keep ? v.currentTime : 0, on = !v.paused;
      setPoster(v, poster); v.src = src;
      if (t) v.addEventListener('loadedmetadata', () => { v.currentTime = t; }, { once: true });
      if (on) { v.playbackRate = rate; v.play().catch(() => {}); }
      name.textContent = head; note.textContent = text; note.className = bad ? 'bad' : '';
    };
  };

  /* ---- DexMachina vs DexDuet: one card per demonstration ---- */
  {
    const root = $('#vs'), grid = $('.pargrid', root), demo = $('input', root);
    const HANDS = ['Inspire', 'Allegro', 'XHand', 'Schunk'];
    // demonstrations in which DexMachina drops the object on more hands come first
    const TASKS = ['Waffleiron-300', 'Ketchup-300', 'Notebook-300', 'Mixer-300', 'Mixer-170', 'Box-200', 'Ketchup-100'];
    const DROPS = ['Inspire Ketchup-300', 'Inspire Notebook-300', 'Inspire Waffleiron-300', 'Allegro Ketchup-300', 'Allegro Waffleiron-300', 'XHand Ketchup-300', 'XHand Notebook-300', 'Schunk Waffleiron-300'];
    const BASE_AHEAD = ['Allegro Ketchup-100', 'Schunk Notebook-300'];
    let h = 0;
    const cards = TASKS.map((task) => {
      const load = side(grid, task, 2, 0, ['DexMachina', 'DexDuet']);
      return (keep) => {
        const id = `${HANDS[h].toLowerCase()}_${task.toLowerCase()}`, name = `${HANDS[h]} ${task}`;
        load(`${R}vs/${id}_${demo.checked ? 'vs_demo' : 'clean'}.mp4`, `${R}vs/${id}.jpg`, keep,
          DROPS.includes(name) ? 'DexMachina lets go or drops' : BASE_AHEAD.includes(name) ? 'DexMachina slightly ahead' : '', DROPS.includes(name));
      };
    });
    mk($('.tabs.robot', root), HANDS.map((x) => x + ' hands'), (i) => { h = i; cards.forEach((c) => c()); });
    demo.addEventListener('change', () => cards.forEach((c) => c(true)));
  }

  /* ---- SPIDER suite: panels are reference, baseline, DexDuet ---- */
  {
    const SUITES = [['#sp', 'spider', 'SPIDER', [['box-30-230', 'Box'], ['ketchup-30-230', 'Ketchup, clip 1'], ['ketchup-30-230-u02', 'Ketchup, clip 2'],
      ['mixer-30-230', 'Mixer'], ['notebook-30-230', 'Notebook'], ['waffleiron-30-230', 'Waffle iron'], ['laptop-30-230', 'Laptop']]]];
    SUITES.forEach(([box, key, name, clips]) => {
      const grid = $(`${box} .pargrid`);
      clips.forEach(([id, title]) => side(grid, title, 3, 1, [name, 'DexDuet'])(`${R}suites/${key}_${id}.mp4`, `${R}suites/${key}_${id}.jpg`));
    });
  }

  /* ---- blind A/B clips of the ablations ---- */
  {
    const root = $('#ab');
    const V = { a: 'DexDuet', b: 'DexDuet without the hand graph reward', c: 'DexDuet without the hand-object contact reward', d: 'DexDuet without both interaction rewards' };
    // clip, demonstration, variant of A, variant of B, ADD-AUC A, B, Contact-AUC A, B
    const CLIPS = [
      ['T01', 'Box-200', 'd', 'a', 98.3, 96.1, 70.3, 94.2], ['T07', 'Mixer-300', 'a', 'b', 90.1, 87.2, 89.6, 71.2],
      ['T08', 'Box-200', 'a', 'd', 95.2, 97.6, 89.5, 75.5], ['T09', 'Notebook-300', 'c', 'a', 83.5, 82.3, 62.8, 78.8],
      ['T15', 'Ketchup-300', 'b', 'a', 81.5, 84.1, 62.2, 72.7], ['T17', 'Waffleiron-300', 'c', 'a', 91.5, 92.6, 61.5, 72.4],
      ['T19', 'Waffleiron-300', 'c', 'a', 90.3, 91.7, 48.1, 74.2], ['T21', 'Ketchup-300', 'a', 'b', 89.8, 89.7, 82.0, 65.8],
    ];
    const pl = player($('video', root)), out = $('.reveal', root), btns = [...root.querySelectorAll('.pick button')], scr = $('.screen', root);
    let cur = 0;
    const row = (L, v, add, con, ours) => `<div class="${ours ? 'ours' : ''}"><b>${L}</b><span>${V[v]}</span><span>Contact-AUC <b>${con.toFixed(1)}</b></span><span>ADD-AUC ${add.toFixed(1)}</span></div>`;
    mk($('.tabs', root), CLIPS.map((c, i) => `${i + 1} · ${c[1]}`), (i) => {
      cur = i; pl.show(`${R}abl/${CLIPS[i][0]}.mp4`, `${R}abl/${CLIPS[i][0]}.jpg`);
      out.innerHTML = ''; btns.forEach((b) => b.removeAttribute('aria-pressed')); delete scr.dataset.ours;
    });
    btns.forEach((b, k) => b.addEventListener('click', () => {
      const c = CLIPS[cur], ours = c[2] === 'a' ? 0 : 1;
      btns.forEach((x, j) => x.setAttribute('aria-pressed', j === k)); scr.dataset.ours = 'ab'[ours];
      out.innerHTML = `<p>${k === ours ? 'You picked DexDuet.' : 'You picked the policy with rewards removed.'}</p>`
        + row('A', c[2], c[4], c[6], ours === 0) + row('B', c[3], c[5], c[7], ours === 1);
    }));
  }

  /* ---- four hands ---- */
  if ($('#four')) {
    const root = $('#four'), pl = player($('video', root));
    const TASKS = ['Box-200', 'Ketchup-100', 'Ketchup-300', 'Mixer-300', 'Notebook-300'];
    mk($('.tabs', root), TASKS, (i) => pl.show(`${R}four/${TASKS[i].toLowerCase()}.mp4`, `${R}four/${TASKS[i].toLowerCase()}.jpg`), 3);
  }

  /* ---- pipeline: human demonstration, simulation, real robot, restarted together ---- */
  if ($('#pipe')) {
    const root = $('#pipe'), vs = [...root.querySelectorAll('video')], TASKS = [['bottle', 'Reorient a bottle'], ['gamepad', 'Place a gamepad on a block']];
    let seen = false;
    const restart = () => vs.forEach((v) => { v.currentTime = 0; if (seen) v.play().catch(() => {}); });
    vs[0].addEventListener('ended', restart);
    new IntersectionObserver((es) => { seen = es[0].isIntersecting; vs.forEach((v) => (seen ? v.play().catch(() => {}) : v.pause())); }, { threshold: 0.2 }).observe(root);
    mk($('.tabs', root), TASKS.map((t) => t[1]), (i) => {
      vs.forEach((v) => { v.poster = `${R}pipe/${TASKS[i][0]}_${v.dataset.k}.jpg?v=2`; v.src = `${R}pipe/${TASKS[i][0]}_${v.dataset.k}.mp4?v=2`; v.load(); });
      restart();
    });
  }

  /* ---- real robots: looping clips ---- */
  /* ---- sim / real slider: one clip holds the simulation (left half) and the real robot (right half), so the two can never drift apart ---- */
  document.querySelectorAll('.simreal').forEach((fig) => {
    const c = fig.querySelector('canvas'), g = c.getContext('2d'), bar = fig.querySelector('.bar'), W = c.width, H = c.height;
    const v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none'; v.src = fig.dataset.src; v.className = 'src'; fig.append(v);
    let x = 0.5, seen = false;
    const draw = () => {
      if (v.readyState < 2) return;
      // the canvas covers the card, so the split is placed in card coordinates and mapped back to clip pixels
      const r = fig.getBoundingClientRect(), k = Math.max(r.width / W, r.height / H), s = Math.round(Math.min(W, Math.max(0, (x * r.width + (W * k - r.width) / 2) / k)));
      if (s > 0) g.drawImage(v, 0, 0, s, H, 0, 0, s, H);
      if (s < W) g.drawImage(v, W + s, 0, W - s, H, s, 0, W - s, H);
    };
    const tick = () => { draw(); if (seen) (v.requestVideoFrameCallback ? v.requestVideoFrameCallback(tick) : requestAnimationFrame(tick)); };
    const set = (nx) => { x = Math.min(0.97, Math.max(0.03, nx)); fig.style.setProperty('--x', `${100 * x}%`); bar.setAttribute('aria-valuenow', Math.round(100 * x)); draw(); };
    const at = (e) => { const r = fig.getBoundingClientRect(); set((e.clientX - r.left) / r.width); };
    fig.addEventListener('pointerdown', (e) => { fig.setPointerCapture(e.pointerId); fig.classList.add('drag'); at(e); });
    fig.addEventListener('pointermove', (e) => { if (fig.classList.contains('drag')) at(e); });
    ['pointerup', 'pointercancel'].forEach((n) => fig.addEventListener(n, () => fig.classList.remove('drag')));
    bar.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') set(x - 0.05); else if (e.key === 'ArrowRight') set(x + 0.05); else return; e.preventDefault(); });
    v.addEventListener('loadeddata', draw);
    new IntersectionObserver((es) => { const on = es[0].isIntersecting; if (on && !seen) { seen = true; v.play().catch(() => {}); tick(); } else if (!on) { seen = false; v.pause(); } }, { threshold: 0.2 }).observe(fig);
    set(0.5);
  });

  document.querySelectorAll('.realgrid video').forEach((v) => {
    if (v.dataset.poster) { setPoster(v, v.dataset.poster); near.observe(v); }
    new IntersectionObserver((es) => { if (es[0].isIntersecting) v.play().catch(() => {}); else v.pause(); }, { threshold: 0.2 }).observe(v);
  });

  /* ---- humanoid study: human recording, CHORD (PPO) and DexDuet on the eight highlight episodes, one at a time ---- */
  {
    const EPS = [[27, 'Woven basket, ground to desk'], [9, 'Red bowl, under the chair'], [11, 'Book, pick and place'], [17, 'Traffic cone, ground to table'],
      [18, 'Trash can, drag sideways'], [23, 'Toy stroller, back and forth'], [12, 'Platform, turn'], [24, 'Watering can, pour']];
    const load = side($('#g1 .pargrid'), '', 3, 0, ['Human', 'CHORD (PPO)', 'DexDuet'], 0.6);
    mk($('#g1 .tabs'), EPS.map((e) => e[1]), (k) => {
      const id = 'ep' + String(EPS[k][0]).padStart(2, '0');
      load(`${R}g1/${id}.mp4`, `${R}g1/${id}.jpg`, false, '', false, EPS[k][1]);
    });
  }

  /* ---- choosers: show one of several blocks, picked with a select (or tabs when there are few), so they do not stack down the page ---- */
  document.querySelectorAll('.chooser').forEach((box) => {
    const opts = [...box.querySelectorAll(':scope > .opt')];
    opts.forEach((o) => o.querySelectorAll(':scope > details').forEach((d) => { d.open = true; }));
    const show = (k) => { opts.forEach((o, i) => { o.hidden = i !== k; }); dispatchEvent(new Event('scroll')); };
    if (box.dataset.as === 'tabs') {
      const bar = document.createElement('div'); bar.className = 'tabs big'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', box.dataset.label);
      box.prepend(bar); mk(bar, opts.map((o) => o.dataset.name), show);
    } else {
      const bar = document.createElement('label'); bar.className = 'choose';
      const sel = document.createElement('select');
      opts.forEach((o, i) => sel.add(new Option(o.dataset.name, i)));
      bar.append(box.dataset.label, sel); box.prepend(bar);
      sel.addEventListener('change', () => show(+sel.value)); show(0);
    }
  });
})();

// Motion runs only where it can be seen. The cover's wall of clips and its title animation stop once the cover has scrolled away,
// and the two animated method figures stop while they are off screen; measured, they otherwise keep about a tenth of a core busy.
(() => {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wall = document.querySelector('.wall video'), cover = document.querySelector('.cover');
  if (wall && still) { wall.removeAttribute('autoplay'); wall.pause(); }       // the poster stays
  if (cover) new IntersectionObserver((es) => {
    const on = es[0].isIntersecting;
    cover.classList.toggle('resting', !on);
    if (wall && !still) { if (on) wall.play().catch(() => {}); else wall.pause(); }
  }).observe(cover);
  document.querySelectorAll('.step').forEach((step) => new IntersectionObserver((es) => step.classList.toggle('resting', !es[0].isIntersecting), { rootMargin: '60px 0px' }).observe(step));
})();

// Nav: the section being read is marked. On a phone the links scroll sideways inside the bar, and the current one is brought into view.
(() => {
  const box = document.querySelector('nav .links'), links = [...document.querySelectorAll('nav a.link')];
  if (!box || !links.length) return;
  const secs = links.map((a) => document.querySelector(a.getAttribute('href')));
  let cur = -2, queued = false;
  const spy = () => {
    queued = false;
    const line = innerHeight * 0.4; let k = -1;
    secs.forEach((sec, i) => { if (sec.getBoundingClientRect().top <= line) k = i; });
    if (k === cur) return;
    cur = k;
    links.forEach((a, i) => { if (i === k) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    if (box.scrollWidth > box.clientWidth + 2) {
      const a = links[Math.max(0, k)];
      box.scrollTo({ left: k < 0 ? 0 : a.offsetLeft - (box.clientWidth - a.offsetWidth) / 2, behavior: 'smooth' });
    }
  };
  const ask = () => { if (!queued) { queued = true; requestAnimationFrame(spy); } };
  addEventListener('scroll', ask, { passive: true }); addEventListener('resize', ask); spy();
  // which sides of the strip hide more links: the stylesheet fades those sides, so a cut-off word says "there is more"
  const edge = () => { const max = box.scrollWidth - box.clientWidth, x = box.scrollLeft; box.dataset.more = max < 2 ? '' : (x > 2 ? 'l' : '') + (x < max - 2 ? 'r' : ''); };
  box.addEventListener('scroll', edge, { passive: true }); addEventListener('resize', edge); addEventListener('load', edge); edge();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(edge);
})();
