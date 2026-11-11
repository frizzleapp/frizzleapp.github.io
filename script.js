/* The download buttons. Each goes to Frizzle Cloud's /download, which counts the download
   and redirects to the disk image. Until the server's address is in config.js the buttons
   lead to the foot of the page, and the one there says the download is not open yet. */
(function () {
  const cloud = ((window.FRIZZLE_SITE || {}).cloud || "").replace(/\/+$/, "");
  document.querySelectorAll("[data-download]").forEach((link) => {
    if (cloud) {
      link.href = cloud + "/download?from=site";
    } else if (link.id === "download-footer") {
      link.textContent = "The download opens soon";
      link.removeAttribute("href");
      link.setAttribute("aria-disabled", "true");
    }
  });
})();

/* The hero demo: Frizzle "teaching" five screens in a loop.
   Each scene plays the real interaction: the chord is held (a ring breathes by
   the chalk and the question appears word by word as it's heard), Frizzle
   thinks for a moment, then speaks one sentence at a time while the chalk
   travels to the thing that sentence names and draws it. Paths and captions
   come from scenes.js, the same data the stills were rendered from. */
(function () {
  const scenes = window.FRIZZLE_SCENES || {};
  const order = ["lecture", "dashboard", "code", "diagram", "sheet"];
  const stage = document.getElementById("stage");
  if (!stage || !order.every((k) => scenes[k])) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const screens = [document.getElementById("screen-a"), document.getElementById("screen-b")];
  const marksGroup = document.getElementById("marks-group");
  const lassoGroup = document.getElementById("lasso-group");
  const halo = document.getElementById("halo");
  const stub = document.getElementById("stub");
  const tags = document.getElementById("tags");
  const heard = document.getElementById("heard");
  const caption = document.getElementById("caption");
  const captionN = document.getElementById("caption-n");
  const captionText = document.getElementById("caption-text");
  const chips = Array.from(document.querySelectorAll("#demo-controls .chip"));
  const status = document.getElementById("demo-status");

  const W = 1440, H = 900;
  const CHALK = { white: "#fff7e8", yellow: "#ffe37a", pink: "#ffb3c7", blue: "#99d4ff" };
  const INK = "#211c19";
  let active = 0, current = -1, token = 0, userPicked = false;

  const px = (n) => (n * stage.clientWidth) / W;
  const py = (n) => (n * stage.clientHeight) / H;

  function clear() {
    marksGroup.innerHTML = "";
    lassoGroup.innerHTML = "";
    tags.innerHTML = "";
    halo.style.opacity = 0;
    stub.classList.remove("on");
    heard.classList.remove("on");
    caption.classList.remove("on");
  }

  function svgPath(points) {
    return points.map((p, i) => (i ? "L" : "M") + (p[0] * W).toFixed(1) + " " + (p[1] * H).toFixed(1)).join(" ");
  }

  function makeMark(paths, color) {
    // halo under core under grain, each a path with its own dash animation
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const layers = [];
    paths.forEach((pts) => {
      const d = svgPath(pts);
      const halo = el("path", { d, fill: "none", stroke: INK, "stroke-opacity": 0.42, "stroke-width": 6.6, "stroke-linecap": "round", "stroke-linejoin": "round" });
      const core = el("path", { d, fill: "none", stroke: CHALK[color] || CHALK.white, "stroke-opacity": 0.92, "stroke-width": 4, "stroke-linecap": "round", "stroke-linejoin": "round" });
      const grain = el("path", { d, fill: "none", stroke: CHALK[color] || CHALK.white, "stroke-opacity": 0.55, "stroke-width": 1.2, "stroke-dasharray": "3 2.5 1.5 3", transform: "translate(0.6 -0.8)" });
      g.append(halo, core, grain);
      const len = core.getTotalLength ? core.getTotalLength() : 1000;
      layers.push({ halo, core, grain, len, pts: core });
    });
    marksGroup.appendChild(g);
    return layers;
  }

  function el(name, attrs) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  function setProgress(layers, progress) {
    // progress 0..1 across all sub-paths by length. The halo and core reveal
    // along the path; the dry grain appears once a sub-path is complete.
    const total = layers.reduce((s, l) => s + l.len, 0);
    let budget = total * progress, tip = null;
    layers.forEach((l) => {
      const shown = Math.max(0, Math.min(l.len, budget));
      budget -= l.len;
      [l.halo, l.core].forEach((p) => {
        p.setAttribute("stroke-dasharray", `${l.len} ${l.len}`);
        p.setAttribute("stroke-dashoffset", String(l.len - shown));
      });
      l.grain.style.opacity = shown >= l.len - 0.5 ? "1" : "0";
      if (shown > 0 && l.pts.getPointAtLength) tip = l.pts.getPointAtLength(Math.min(shown, l.len));
    });
    return tip;
  }

  function placeStub(x, y) {
    stub.style.transform = `translate(${px(x) - 13}px, ${py(y) - 32}px)`;
  }

  function placeTag(node, x, y) {
    node.style.left = px(x) + "px";
    node.style.top = py(y) + "px";
  }

  // The "heard" tag is anchored at its top-left, so keep it inside the stage.
  function placeHeard(x, y) {
    const w = heard.offsetWidth || 160, h = heard.offsetHeight || 28;
    const left = Math.min(Math.max(px(x), 8), stage.clientWidth - w - 8);
    const top = Math.min(Math.max(py(y), 8), stage.clientHeight - h - 8);
    heard.style.left = left + "px";
    heard.style.top = top + "px";
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  async function animate(ms, fn, myToken) {
    const start = performance.now();
    return new Promise((resolve) => {
      function frame(now) {
        if (myToken !== token) return resolve(false);
        const t = Math.min(1, (now - start) / ms);
        fn(t);
        if (t < 1) requestAnimationFrame(frame); else resolve(true);
      }
      requestAnimationFrame(frame);
    });
  }

  function showScreen(name) {
    const next = screens[1 - active];
    next.src = `assets/screens/${name}-clean.png`;
    next.classList.add("on");
    screens[active].classList.remove("on");
    active = 1 - active;
  }

  async function play(index) {
    const myToken = ++token;
    const key = order[index];
    const sc = scenes[key];
    current = index;
    chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.scene === key)));
    clear();
    showScreen(key);
    if (reduced) {
      // Show the finished lesson at rest: every mark, every caption.
      sc.beats.forEach((b) => { if (b.paths.length) setProgress(makeMark(b.paths, b.color), 1); });
      sc.beats.forEach((b) => { if (b.caption && b.captionAt) { const t = tag(b.caption, b.color); placeTag(t, b.captionAt[0], b.captionAt[1]); t.classList.add("on"); } });
      if (sc.lasso.length) drawLasso(sc.lasso, true, 1);
      return;
    }

    // Listening: ring by the chalk, the question heard word by word.
    const cursor = sc.beats[0].paths.length ? sc.beats[0].paths[0][0] : [0.6, 0.6];
    const listenAt = [Math.min(cursor[0] + 0.12, 0.85), Math.min(cursor[1] + 0.14, 0.8)];
    stub.classList.add("on");
    placeStub(listenAt[0] * W, listenAt[1] * H);
    halo.setAttribute("cx", String(listenAt[0] * W));
    halo.setAttribute("cy", String(listenAt[1] * H));
    heard.textContent = sc.question;
    placeHeard(listenAt[0] * W + 24, listenAt[1] * H + 30);
    heard.textContent = "";
    heard.classList.add("on");
    const words = sc.question.split(" ");
    const lassoDuration = sc.lasso.length ? 1100 : 0;
    const listenMs = 900 + words.length * 260 + lassoDuration;
    await animate(listenMs, (t) => {
      halo.style.opacity = 0.75;
      const breath = 0.5 + 0.5 * Math.sin(t * listenMs / 1000 * 2.4 * Math.PI);
      halo.setAttribute("r", String(9 + breath * 4));
      const shown = Math.min(words.length, Math.floor(((t * listenMs - 400 - lassoDuration) / 260) + 1));
      heard.textContent = shown > 0 ? words.slice(0, shown).join(" ") : "…";
      if (sc.lasso.length && t * listenMs < lassoDuration + 200) drawLasso(sc.lasso, false, Math.min(1, (t * listenMs) / lassoDuration));
    }, myToken);
    if (myToken !== token) return;
    if (sc.lasso.length) drawLasso(sc.lasso, true, 1);
    halo.style.opacity = 0;
    // Thinking: a short beat.
    await sleep(700);
    if (myToken !== token) return;
    heard.classList.remove("on");

    // Beats: speak (caption) and draw at the cue.
    let from = listenAt;
    for (let b = 0; b < sc.beats.length; b++) {
      const beat = sc.beats[b];
      const wordsN = beat.say.split(" ").length;
      const beatMs = Math.max(2600, (wordsN / 2.7) * 1000 + 600);
      captionN.textContent = `${b + 1}/${sc.beats.length}`;
      captionText.textContent = beat.say;
      caption.classList.add("on");
      if (beat.paths.length) {
        const layers = makeMark(beat.paths, beat.color);
        const start = beat.paths[0][0];
        const cueMs = Math.min(beatMs * 0.42, 1500);
        // travel to the start, arriving at the cue
        const travelMs = Math.min(650, Math.max(220, Math.hypot((start[0] - from[0]) * W, (start[1] - from[1]) * H) / 1.4));
        await sleep(Math.max(0, cueMs - travelMs));
        if (myToken !== token) return;
        const f0 = from;
        await animate(travelMs, (t) => {
          const e = ease(t), lift = Math.sin(t * Math.PI) * 7;
          placeStub((f0[0] + (start[0] - f0[0]) * e) * W, (f0[1] + (start[1] - f0[1]) * e) * H - lift);
        }, myToken);
        if (myToken !== token) return;
        const total = layers.reduce((s, l) => s + l.len, 0);
        const drawMs = Math.min(1800, Math.max(450, (total / 520) * 1000));
        let shownTag = false;
        const tagNode = beat.caption && beat.captionAt ? tag(beat.caption, beat.color) : null;
        if (tagNode) placeTag(tagNode, beat.captionAt[0] * W, beat.captionAt[1] * H);
        await animate(drawMs, (t) => {
          const tip = setProgress(layers, ease(t));
          if (tip) placeStub(tip.x, tip.y);
          if (tagNode && t > 0.55 && !shownTag) { shownTag = true; tagNode.classList.add("on"); }
        }, myToken);
        if (myToken !== token) return;
        if (tagNode && !shownTag) tagNode.classList.add("on");
        const end = beat.paths[beat.paths.length - 1];
        from = end[end.length - 1];
        await sleep(Math.max(600, beatMs - cueMs - drawMs));
      } else {
        await sleep(beatMs);
      }
      if (myToken !== token) return;
      await sleep(220);
    }
    await sleep(1800);
    if (myToken !== token) return;
    if (!userPicked) play((index + 1) % order.length);
    else { userPicked = false; play((index + 1) % order.length); }
  }

  function tag(text, color) {
    const node = document.createElement("div");
    node.className = `tag ${color || "white"}`;
    node.textContent = text;
    tags.appendChild(node);
    return node;
  }

  function drawLasso(points, finished, progress) {
    lassoGroup.innerHTML = "";
    const n = Math.max(2, Math.floor(points.length * progress));
    const pts = points.slice(0, n);
    const d = svgPath(pts) + (finished ? " Z" : "");
    if (finished) lassoGroup.appendChild(el("path", { d, fill: "#fff7e8", "fill-opacity": 0.05, stroke: "none" }));
    lassoGroup.appendChild(el("path", { d, fill: "none", stroke: INK, "stroke-opacity": 0.3, "stroke-width": 2, transform: "translate(0 1)", "stroke-dasharray": finished ? "7 6" : "none" }));
    lassoGroup.appendChild(el("path", { d, fill: "none", stroke: "#fff7e8", "stroke-opacity": finished ? 0.5 : 0.85, "stroke-width": 2, "stroke-linecap": "round", "stroke-dasharray": finished ? "7 6" : "none" }));
  }

  chips.forEach((chip) => chip.addEventListener("click", () => {
    userPicked = true;
    play(order.indexOf(chip.dataset.scene));
  }));
  window.addEventListener("resize", () => { if (current >= 0 && !reduced) play(current); });

  // Only animate while the hero is on screen.
  let started = false;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting && !started) { started = true; play(0); }
      else if (!e.isIntersecting && started && !reduced) { token++; started = false; }
      else if (e.isIntersecting && !started) { started = true; play(current < 0 ? 0 : current); }
    });
  }, { threshold: 0.3 });
  io.observe(stage);
  if (status) status.textContent = reduced ? "Each screen shows a finished lesson: what Frizzle said and pointed at." : "Live: the chalk draws what Frizzle would say and point at. Pick a screen.";
})();
