// styles.js - visual style kit: fonts, backgrounds, text styles, highlight styles.
// Everything here is deterministic (seeded randomness) so the preview and the
// exported video look exactly the same on every frame.
const StyleKit = (() => {
  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function parseHex(c) {
    let h = String(c || "#000000").replace("#", "");
    if (h.length === 3) h = h.split("").map((x) => x + x).join("");
    const n = parseInt(h, 16);
    if (isNaN(n)) return [0, 0, 0];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(c, a) {
    const [r, g, b] = parseHex(c);
    return `rgba(${r},${g},${b},${a})`;
  }
  // amt -1..0 darkens, 0..1 lightens
  function shade(c, amt) {
    const [r, g, b] = parseHex(c);
    const f = (v) => Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt);
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }
  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ------------------------------------------------------------------
  // Fonts
  // ------------------------------------------------------------------
  // weight: what the canvas should use. Display fonts only have one weight,
  // so forcing "bold" would fake-bold them and look smeared.
  const FONTS = [
    // Classic (your originals - unchanged)
    { group: "Classic", label: "Impact (Genius Style)", value: "Impact, sans-serif", weight: "bold" },
    { group: "Classic", label: "Arial Bold", value: "Arial, sans-serif", weight: "bold" },
    { group: "Classic", label: "Courier Monospace", value: "'Courier New', monospace", weight: "bold" },
    { group: "Classic", label: "Georgia Serif", value: "Georgia, serif", weight: "bold" },
    { group: "Classic", label: "Jost", value: "jost, serif", weight: "bold" },
    { group: "Classic", label: "Futura", value: "futura, serif", weight: "bold" },
    // Bold display
    { group: "Bold & Display", label: "Anton", value: "'Anton', Impact, sans-serif", weight: "normal" },
    { group: "Bold & Display", label: "Bebas Neue", value: "'Bebas Neue', Impact, sans-serif", weight: "normal" },
    { group: "Bold & Display", label: "Oswald", value: "'Oswald', sans-serif", weight: "700" },
    { group: "Bold & Display", label: "Archivo Black", value: "'Archivo Black', sans-serif", weight: "normal" },
    { group: "Bold & Display", label: "Montserrat ExtraBold", value: "'Montserrat', sans-serif", weight: "800" },
    { group: "Bold & Display", label: "Poppins Bold", value: "'Poppins', sans-serif", weight: "700" },
    { group: "Bold & Display", label: "Russo One", value: "'Russo One', sans-serif", weight: "normal" },
    { group: "Bold & Display", label: "Righteous", value: "'Righteous', sans-serif", weight: "normal" },
    { group: "Bold & Display", label: "Bangers (Comic)", value: "'Bangers', cursive", weight: "normal" },
    { group: "Bold & Display", label: "Rubik Mono One", value: "'Rubik Mono One', sans-serif", weight: "normal" },
    // Serif
    { group: "Serif & Elegant", label: "Playfair Display", value: "'Playfair Display', serif", weight: "800" },
    { group: "Serif & Elegant", label: "Abril Fatface", value: "'Abril Fatface', serif", weight: "normal" },
    { group: "Serif & Elegant", label: "Cinzel", value: "'Cinzel', serif", weight: "700" },
    // Script / hand
    { group: "Script & Handwriting", label: "Lobster", value: "'Lobster', cursive", weight: "normal" },
    { group: "Script & Handwriting", label: "Pacifico", value: "'Pacifico', cursive", weight: "normal" },
    { group: "Script & Handwriting", label: "Permanent Marker", value: "'Permanent Marker', cursive", weight: "normal" },
    { group: "Script & Handwriting", label: "Caveat", value: "'Caveat', cursive", weight: "700" },
    // Typewriter
    { group: "Typewriter", label: "Special Elite", value: "'Special Elite', monospace", weight: "normal" },
  ];

  const GOOGLE_FONTS_URL =
    "https://fonts.googleapis.com/css2?" +
    [
      "Anton",
      "Bebas+Neue",
      "Oswald:wght@700",
      "Archivo+Black",
      "Montserrat:wght@800",
      "Poppins:wght@700",
      "Russo+One",
      "Righteous",
      "Bangers",
      "Rubik+Mono+One",
      "Playfair+Display:wght@800",
      "Abril+Fatface",
      "Cinzel:wght@700",
      "Lobster",
      "Pacifico",
      "Permanent+Marker",
      "Caveat:wght@700",
      "Special+Elite",
    ]
      .map((f) => "family=" + f)
      .join("&") +
    "&display=swap";

  function fontString(s, px) {
    const f = FONTS.find((x) => x.value === s.fontFamily);
    const weight = f ? f.weight : "bold";
    return `${weight} ${px}px ${s.fontFamily}`;
  }

  // Resolves once the font is usable on a canvas
  function ensureFont(s) {
    if (document.fonts && document.fonts.load) {
      return document.fonts.load(fontString(s, 40), "Aa").catch(() => {});
    }
    return Promise.resolve();
  }

  function populateFontSelect(select) {
    select.innerHTML = "";
    let group = null;
    let og = null;
    FONTS.forEach((f) => {
      if (f.group !== group) {
        group = f.group;
        og = document.createElement("optgroup");
        og.label = group;
        select.appendChild(og);
      }
      const o = document.createElement("option");
      o.value = f.value;
      o.textContent = f.label;
      og.appendChild(o);
    });
  }

  // ------------------------------------------------------------------
  // Procedural texture building blocks
  // ------------------------------------------------------------------
  let noiseTile = null;
  function getNoiseTile() {
    if (noiseTile) return noiseTile;
    const c = makeCanvas(256, 256);
    const x = c.getContext("2d");
    const id = x.createImageData(256, 256);
    const r = mulberry32(1234);
    for (let i = 0; i < 256 * 256; i++) {
      const v = Math.floor(r() * 256);
      id.data[i * 4] = v;
      id.data[i * 4 + 1] = v;
      id.data[i * 4 + 2] = v;
      id.data[i * 4 + 3] = 255;
    }
    x.putImageData(id, 0, 0);
    noiseTile = c;
    return c;
  }

  function grain(ctx, w, h, alpha, mode) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = mode || "overlay";
    ctx.fillStyle = ctx.createPattern(getNoiseTile(), "repeat");
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function vignette(ctx, w, h, strength, rgb) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.hypot(w, h) / 2);
    g.addColorStop(0, `rgba(${rgb || "0,0,0"},0)`);
    g.addColorStop(1, `rgba(${rgb || "0,0,0"},${strength})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function blotches(ctx, w, h, count, rand, colors, aMin, aMax, rMin, rMax) {
    for (let i = 0; i < count; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = rMin + rand() * (rMax - rMin);
      const col = colors[Math.floor(rand() * colors.length)];
      const a = aMin + rand() * (aMax - aMin);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${col},${a})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  function fibers(ctx, w, h, count, rand, colors, lenMin, lenMax, lw) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineWidth = lw;
    for (let i = 0; i < count; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const a = rand() * Math.PI * 2;
      const len = lenMin + rand() * (lenMax - lenMin);
      ctx.strokeStyle = colors[Math.floor(rand() * colors.length)];
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(
        x + Math.cos(a + 0.6) * len * 0.5,
        y + Math.sin(a + 0.6) * len * 0.5,
        x + Math.cos(a) * len,
        y + Math.sin(a) * len,
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  function gradFill(ctx, w, h, stops, vertical) {
    const g = vertical ? ctx.createLinearGradient(0, 0, 0, h) : ctx.createLinearGradient(0, 0, w, h);
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // ------------------------------------------------------------------
  // Background presets
  // ------------------------------------------------------------------
  const MATTE_COLORS = {
    "matte-black": "#151515",
    "matte-charcoal": "#2b2d31",
    "matte-white": "#ecebe7",
    "matte-navy": "#14213d",
    "matte-sand": "#d8c9b0",
    "matte-burgundy": "#4a1c28",
  };

  const BG_PRESETS = [
    { group: "Gradients", id: "genius-gradient", label: "Genius" },
    { group: "Gradients", id: "sunset", label: "Sunset" },
    { group: "Gradients", id: "ocean", label: "Ocean" },
    { group: "Gradients", id: "aurora", label: "Aurora" },
    { group: "Gradients", id: "midnight", label: "Midnight" },
    { group: "Gradients", id: "peach", label: "Peach" },
    { group: "Gradients", id: "neon", label: "Neon" },
    { group: "Gradients", id: "fire", label: "Fire" },
    { group: "Gradients", id: "cotton", label: "Cotton Candy" },
    { group: "Matte", id: "matte-black", label: "Matte Black" },
    { group: "Matte", id: "matte-charcoal", label: "Charcoal" },
    { group: "Matte", id: "matte-white", label: "Matte White" },
    { group: "Matte", id: "matte-navy", label: "Navy" },
    { group: "Matte", id: "matte-sand", label: "Sand" },
    { group: "Matte", id: "matte-burgundy", label: "Burgundy" },
    { group: "Textures", id: "paper", label: "Paper" },
    { group: "Textures", id: "parchment", label: "Parchment" },
    { group: "Textures", id: "kraft", label: "Kraft" },
    { group: "Textures", id: "concrete", label: "Concrete" },
    { group: "Textures", id: "chalkboard", label: "Chalkboard" },
    { group: "Textures", id: "notebook", label: "Notebook" },
    { group: "Textures", id: "blueprint", label: "Blueprint" },
    { group: "Textures", id: "dotgrid", label: "Dot Grid" },
    { group: "Solid & Image", id: "#121212", label: "Dark" },
    { group: "Solid & Image", id: "#ffffff", label: "White" },
    { group: "Solid & Image", id: "image", label: "Your Image" },
  ];

  function paintPreset(ctx, w, h, id) {
    const k = h / 1080;
    const r = mulberry32(hashStr(id));
    ctx.save();
    switch (id) {
      case "genius-gradient": {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0.0, "#333639");
        g.addColorStop(0.2, "#a8abaf");
        g.addColorStop(0.5, "#e8eaed");
        g.addColorStop(0.8, "#a8abaf");
        g.addColorStop(1.0, "#333639");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        break;
      }
      case "sunset": gradFill(ctx, w, h, ["#ffb347", "#ff5e62", "#6a2c91"], true); break;
      case "ocean": gradFill(ctx, w, h, ["#00c6ff", "#0072ff", "#001a4d"], false); break;
      case "aurora": gradFill(ctx, w, h, ["#0b132b", "#1c7c7d", "#7bffb3"], false); break;
      case "midnight": gradFill(ctx, w, h, ["#0f0c29", "#302b63", "#24243e"], false); break;
      case "peach": gradFill(ctx, w, h, ["#ffecd2", "#fcb69f", "#ff9a9e"], false); break;
      case "neon": gradFill(ctx, w, h, ["#12002b", "#6a00f4", "#ff00c8"], false); break;
      case "fire": gradFill(ctx, w, h, ["#1a0000", "#b31217", "#ffb100"], true); break;
      case "cotton": gradFill(ctx, w, h, ["#a1c4fd", "#c2e9fb", "#fbc2eb"], false); break;

      case "matte-black":
      case "matte-charcoal":
      case "matte-white":
      case "matte-navy":
      case "matte-sand":
      case "matte-burgundy": {
        ctx.fillStyle = MATTE_COLORS[id];
        ctx.fillRect(0, 0, w, h);
        const lg = ctx.createLinearGradient(0, 0, 0, h);
        lg.addColorStop(0, "rgba(255,255,255,0.06)");
        lg.addColorStop(1, "rgba(0,0,0,0.10)");
        ctx.fillStyle = lg;
        ctx.fillRect(0, 0, w, h);
        vignette(ctx, w, h, 0.18);
        grain(ctx, w, h, 0.07);
        break;
      }

      case "paper": {
        ctx.fillStyle = "#f3f0e8";
        ctx.fillRect(0, 0, w, h);
        blotches(ctx, w, h, 40, r, ["150,130,90", "255,255,255"], 0.02, 0.05, 80 * k, 260 * k);
        fibers(ctx, w, h, Math.round(900 * k), r, ["rgba(120,105,80,0.10)", "rgba(255,255,255,0.35)"], 6 * k, 22 * k, Math.max(1, k));
        grain(ctx, w, h, 0.1);
        vignette(ctx, w, h, 0.12, "90,80,60");
        break;
      }
      case "parchment": {
        const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) / 2);
        g.addColorStop(0, "#efdcab");
        g.addColorStop(1, "#b88c4e");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        blotches(ctx, w, h, 60, r, ["120,75,25", "255,240,200"], 0.04, 0.09, 60 * k, 240 * k);
        fibers(ctx, w, h, Math.round(500 * k), r, ["rgba(110,70,20,0.12)"], 6 * k, 20 * k, Math.max(1, k));
        grain(ctx, w, h, 0.12);
        vignette(ctx, w, h, 0.35, "60,35,10");
        break;
      }
      case "kraft": {
        ctx.fillStyle = "#b88a5a";
        ctx.fillRect(0, 0, w, h);
        blotches(ctx, w, h, 30, r, ["90,55,25", "230,200,160"], 0.03, 0.07, 80 * k, 260 * k);
        fibers(ctx, w, h, Math.round(2200 * k), r, ["rgba(90,55,25,0.22)", "rgba(240,215,175,0.28)"], 8 * k, 34 * k, Math.max(1, k));
        grain(ctx, w, h, 0.13);
        vignette(ctx, w, h, 0.16, "60,35,10");
        break;
      }
      case "concrete": {
        ctx.fillStyle = "#8c8d8f";
        ctx.fillRect(0, 0, w, h);
        blotches(ctx, w, h, 140, r, ["40,40,42", "200,200,204"], 0.05, 0.11, 60 * k, 300 * k);
        ctx.fillStyle = "rgba(25,25,28,0.18)";
        for (let i = 0; i < 700 * k; i++) {
          const rad = (0.6 + r() * 1.8) * k;
          ctx.beginPath();
          ctx.arc(r() * w, r() * h, rad, 0, Math.PI * 2);
          ctx.fill();
        }
        grain(ctx, w, h, 0.24);
        vignette(ctx, w, h, 0.22);
        break;
      }
      case "chalkboard": {
        const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) / 2);
        g.addColorStop(0, "#32453c");
        g.addColorStop(1, "#1e2a24");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        blotches(ctx, w, h, 50, r, ["230,240,235"], 0.02, 0.05, 120 * k, 420 * k);
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        for (let i = 0; i < 350 * k; i++) {
          ctx.beginPath();
          ctx.arc(r() * w, r() * h, (0.5 + r() * 1.3) * k, 0, Math.PI * 2);
          ctx.fill();
        }
        grain(ctx, w, h, 0.12);
        vignette(ctx, w, h, 0.4);
        break;
      }
      case "notebook": {
        ctx.fillStyle = "#fbfaf5";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "rgba(80,140,210,0.5)";
        for (let y = 90 * k; y < h; y += 54 * k) ctx.fillRect(0, Math.round(y), w, Math.max(1, Math.round(2 * k)));
        ctx.fillStyle = "rgba(220,80,80,0.55)";
        ctx.fillRect(Math.round(w * 0.09), 0, Math.max(2, Math.round(3 * k)), h);
        grain(ctx, w, h, 0.06);
        vignette(ctx, w, h, 0.08, "90,80,60");
        break;
      }
      case "blueprint": {
        const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) / 2);
        g.addColorStop(0, "#1553b8");
        g.addColorStop(1, "#0a2f73");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        const step = 40 * k;
        for (let i = 0, x = 0; x <= w; x += step, i++) {
          ctx.fillStyle = i % 5 === 0 ? "rgba(255,255,255,0.26)" : "rgba(255,255,255,0.11)";
          ctx.fillRect(Math.round(x), 0, Math.max(1, Math.round(k * (i % 5 === 0 ? 2 : 1))), h);
        }
        for (let i = 0, y = 0; y <= h; y += step, i++) {
          ctx.fillStyle = i % 5 === 0 ? "rgba(255,255,255,0.26)" : "rgba(255,255,255,0.11)";
          ctx.fillRect(0, Math.round(y), w, Math.max(1, Math.round(k * (i % 5 === 0 ? 2 : 1))));
        }
        grain(ctx, w, h, 0.07);
        vignette(ctx, w, h, 0.3);
        break;
      }
      case "dotgrid": {
        ctx.fillStyle = "#15151c";
        ctx.fillRect(0, 0, w, h);
        const step = 48 * k;
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        for (let y = step / 2; y < h; y += step) {
          for (let x = step / 2; x < w; x += step) {
            ctx.beginPath();
            ctx.arc(x, y, 3 * k, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        vignette(ctx, w, h, 0.3);
        grain(ctx, w, h, 0.05);
        break;
      }
      default: {
        // any other string is treated as a plain CSS color (legacy / custom)
        ctx.fillStyle = id && id !== "image" ? id : "#121212";
        ctx.fillRect(0, 0, w, h);
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------
  // Image backgrounds (+ glass)
  // ------------------------------------------------------------------
  function drawCover(ctx, img, x, y, w, h) {
    const ir = img.width / img.height;
    const r = w / h;
    let sw, sh, sx, sy;
    if (ir > r) {
      sh = img.height;
      sw = sh * r;
      sx = (img.width - sw) / 2;
      sy = 0;
    } else {
      sw = img.width;
      sh = sw / r;
      sx = 0;
      sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  // Cross-browser blur (no ctx.filter): shrink then grow with smoothing
  function blurCanvas(src, radius) {
    const w = src.width;
    const h = src.height;
    const f = 1 + radius * 0.6;
    const dw = Math.max(6, Math.round(w / f));
    const dh = Math.max(4, Math.round(h / f));
    const a = makeCanvas(dw, dh);
    const ax = a.getContext("2d");
    ax.imageSmoothingEnabled = true;
    ax.imageSmoothingQuality = "high";
    ax.drawImage(src, 0, 0, dw, dh);
    const mw = Math.min(w, dw * 3);
    const mh = Math.min(h, dh * 3);
    const b = makeCanvas(mw, mh);
    const bx = b.getContext("2d");
    bx.imageSmoothingEnabled = true;
    bx.imageSmoothingQuality = "high";
    bx.drawImage(a, 0, 0, mw, mh);
    const out = makeCanvas(w, h);
    const ox = out.getContext("2d");
    ox.imageSmoothingEnabled = true;
    ox.imageSmoothingQuality = "high";
    ox.drawImage(b, 0, 0, w, h);
    return out;
  }

  function blurredCover(img, w, h, radius) {
    const full = makeCanvas(w, h);
    drawCover(full.getContext("2d"), img, 0, 0, w, h);
    return radius > 0 ? blurCanvas(full, radius) : full;
  }

  function paintImage(ctx, w, h, img, s) {
    const effect = s.bgImageEffect || "plain";
    const blur = clamp(s.bgBlur == null ? 14 : s.bgBlur, 0, 40);
    const dim = clamp((s.bgDim == null ? 25 : s.bgDim) / 100, 0, 0.9);
    const k = h / 1080;

    if (effect === "plain") {
      drawCover(ctx, img, 0, 0, w, h);
    } else if (effect === "blur") {
      ctx.drawImage(blurredCover(img, w, h, blur), 0, 0);
    } else if (effect === "frost") {
      ctx.drawImage(blurredCover(img, w, h, blur), 0, 0);
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      ctx.fillRect(0, 0, w, h);
      const sg = ctx.createLinearGradient(0, 0, w, h);
      sg.addColorStop(0, "rgba(255,255,255,0.28)");
      sg.addColorStop(0.4, "rgba(255,255,255,0)");
      sg.addColorStop(1, "rgba(255,255,255,0.10)");
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, w, h);
      grain(ctx, w, h, 0.1);
    } else {
      // "panel": sharp image with a frosted glass sheet over it
      drawCover(ctx, img, 0, 0, w, h);
      if (dim > 0) {
        ctx.fillStyle = `rgba(0,0,0,${dim * 0.6})`;
        ctx.fillRect(0, 0, w, h);
      }
      const px = w * 0.06;
      const py = h * 0.09;
      const pw = w * 0.88;
      const ph = h * 0.82;
      const rad = 36 * k;

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 40 * k;
      ctx.shadowOffsetY = 12 * k;
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      roundRectPath(ctx, px, py, pw, ph, rad);
      ctx.fill();
      ctx.restore();

      ctx.save();
      roundRectPath(ctx, px, py, pw, ph, rad);
      ctx.clip();
      ctx.drawImage(blurredCover(img, w, h, blur), 0, 0);
      ctx.fillStyle = "rgba(255,255,255,0.13)";
      ctx.fillRect(px, py, pw, ph);
      const sg = ctx.createLinearGradient(px, py, px + pw, py + ph);
      sg.addColorStop(0, "rgba(255,255,255,0.30)");
      sg.addColorStop(0.35, "rgba(255,255,255,0)");
      sg.addColorStop(0.7, "rgba(255,255,255,0)");
      sg.addColorStop(1, "rgba(255,255,255,0.12)");
      ctx.fillStyle = sg;
      ctx.fillRect(px, py, pw, ph);
      grain(ctx, w, h, 0.09);
      ctx.restore();

      ctx.save();
      ctx.lineWidth = Math.max(1.5, 2 * k);
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      roundRectPath(ctx, px, py, pw, ph, rad);
      ctx.stroke();
      ctx.restore();
      return; // dim already applied to the base photo
    }

    if (dim > 0) {
      ctx.fillStyle = `rgba(0,0,0,${dim})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  // Loaded-image cache + prerendered background cache
  const imgCache = { src: null, img: null, ready: false };
  function getImage(src, onLoad) {
    if (imgCache.src !== src) {
      imgCache.src = src;
      imgCache.ready = false;
      imgCache.img = null;
      const im = new Image();
      im.onload = () => {
        if (imgCache.src === src) {
          imgCache.img = im;
          imgCache.ready = true;
          if (onLoad) onLoad();
        }
      };
      im.src = src;
    }
    return imgCache.ready ? imgCache.img : null;
  }

  const DIRECT_BG = new Set([
    "genius-gradient", "sunset", "ocean", "aurora", "midnight",
    "peach", "neon", "fire", "cotton",
  ]);
  const bgCache = new Map();
  function drawBackground(ctx, w, h, s, onImageLoad) {
    const id = s.bgColor || "#121212";

    // Gradients and solid colors are cheap: paint them directly every frame
    // instead of keeping big cached canvases around (phones can drop those).
    if (DIRECT_BG.has(id) || /^#[0-9a-f]{3,8}$/i.test(id)) {
      paintPreset(ctx, w, h, id);
      return;
    }

    let img = null;
    if (id === "image" && s.bgImage) img = getImage(s.bgImage, onImageLoad);

    const key = [
      id,
      w,
      h,
      id === "image" && s.bgImage ? s.bgImage.length + ":" + s.bgImage.slice(-48) : "",
      s.bgImageEffect,
      s.bgBlur,
      s.bgDim,
      img ? 1 : 0,
    ].join("|");

    let c = bgCache.get(key);
    if (!c) {
      c = makeCanvas(w, h);
      const x = c.getContext("2d");
      try {
        if (id === "image") {
          if (img) paintImage(x, w, h, img, s);
          else {
            x.fillStyle = "#151515";
            x.fillRect(0, 0, w, h);
          }
        } else {
          paintPreset(x, w, h, id);
        }
      } catch (err) {
        console.warn("Background failed, using a flat color:", err);
        x.fillStyle = "#151515";
        x.fillRect(0, 0, w, h);
      }
      if (bgCache.size >= 2) bgCache.delete(bgCache.keys().next().value);
      bgCache.set(key, c);
    }
    ctx.drawImage(c, 0, 0);
  }

  // Downscale + compress a picked file so it fits in browser storage
  function fileToDataURL(file, maxSide, quality) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => {
        let side = maxSide || 1600;
        let q = quality || 0.82;
        let out = "";
        for (let attempt = 0; attempt < 5; attempt++) {
          const sc = Math.min(1, side / Math.max(im.width, im.height));
          const c = makeCanvas(im.width * sc, im.height * sc);
          c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
          out = c.toDataURL("image/jpeg", q);
          if (out.length < 900000) break;
          side *= 0.8;
          q = Math.max(0.55, q - 0.08);
        }
        URL.revokeObjectURL(url);
        resolve(out);
      };
      im.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("bad image"));
      };
      im.src = url;
    });
  }

  // ------------------------------------------------------------------
  // Text styles
  // ------------------------------------------------------------------
  const TEXT_STYLES = [
    { id: "flat", label: "Flat", demoBg: "#1d1d1d", demoColor: "#ffffff" },
    { id: "shadow", label: "Soft Shadow", demoBg: "#e4e4e4", demoColor: "#1a1a1a" },
    { id: "extrude", label: "3D Raised", demoBg: "#2a2a2a", demoColor: "#ffd21f" },
    { id: "engraved", label: "Engraved", demoBg: "#bdbdbd", demoColor: "#bdbdbd" },
    { id: "emboss", label: "Embossed", demoBg: "#bdbdbd", demoColor: "#bdbdbd" },
    { id: "neon", label: "Neon Glow", demoBg: "#0b0b14", demoColor: "#00e5ff" },
    { id: "outline", label: "Outline", demoBg: "#1d1d1d", demoColor: "#ffffff" },
    { id: "gold", label: "Gold Foil", demoBg: "#1d1d1d", demoColor: "#ffd700" },
    { id: "chrome", label: "Chrome", demoBg: "#1d1d1d", demoColor: "#ffffff" },
    { id: "rgbsplit", label: "RGB Split", demoBg: "#111111", demoColor: "#ffffff" },
  ];

  function drawText(ctx, text, x, y, styleId, color, fs, depth) {
    depth = clamp(depth == null ? 6 : depth, 1, 20);
    const dk = depth / 6;
    ctx.save();
    switch (styleId) {
      case "shadow":
        ctx.shadowColor = "rgba(0,0,0,0.55)";
        ctx.shadowBlur = fs * 0.1 * dk;
        ctx.shadowOffsetX = fs * 0.045 * dk;
        ctx.shadowOffsetY = fs * 0.055 * dk;
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
        break;

      case "extrude": {
        // stacked copies going down-right = letters with real height
        const n = clamp(Math.round(fs * 0.0085 * depth), 1, 40);
        for (let i = n; i >= 1; i--) {
          ctx.fillStyle = shade(color, -0.3 - 0.35 * (i / n));
          if (i === n) {
            ctx.shadowColor = "rgba(0,0,0,0.45)";
            ctx.shadowBlur = n * 1.6;
            ctx.shadowOffsetX = n * 0.5;
            ctx.shadowOffsetY = n * 0.7;
          } else {
            ctx.shadowColor = "transparent";
          }
          ctx.fillText(text, x + i, y + i);
        }
        ctx.shadowColor = "transparent";
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
        break;
      }

      case "engraved": {
        // carved INTO the surface: dark lip top-left, light lip bottom-right
        const d = Math.max(1, Math.round(fs * 0.02 * dk));
        ctx.shadowColor = "transparent";
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.fillText(text, x + d, y + d);
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillText(text, x - d, y - d);
        ctx.fillStyle = shade(color, -0.08);
        ctx.fillText(text, x, y);
        break;
      }

      case "emboss": {
        // pushed OUT of the surface: light top-left, dark bottom-right
        const d = Math.max(1, Math.round(fs * 0.02 * dk));
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillText(text, x + d, y + d);
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.fillText(text, x - d, y - d);
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
        break;
      }

      case "neon":
        ctx.shadowColor = color;
        ctx.fillStyle = shade(color, 0.55);
        ctx.shadowBlur = fs * 0.35 * dk;
        ctx.fillText(text, x, y);
        ctx.fillText(text, x, y);
        ctx.shadowBlur = fs * 0.12 * dk;
        ctx.fillText(text, x, y);
        ctx.shadowBlur = 0;
        ctx.fillStyle = shade(color, 0.85);
        ctx.fillText(text, x, y);
        break;

      case "outline":
        ctx.lineJoin = "round";
        ctx.lineWidth = Math.max(1.5, fs * 0.008 * depth);
        ctx.strokeStyle = color;
        ctx.strokeText(text, x, y);
        break;

      case "gold":
      case "chrome": {
        const g = ctx.createLinearGradient(0, y - fs * 0.85, 0, y + fs * 0.05);
        const stops =
          styleId === "gold"
            ? [["#fff1a8", 0], ["#f7c948", 0.35], ["#b8860b", 0.55], ["#ffe27a", 0.75], ["#a6700a", 1]]
            : [["#ffffff", 0], ["#b8c2cc", 0.35], ["#46515c", 0.5], ["#d6dde4", 0.7], ["#ffffff", 1]];
        stops.forEach(([c, p]) => g.addColorStop(p, c));
        const dark = styleId === "gold" ? "#5a3b05" : "#1c232b";
        const n = Math.max(1, Math.round(fs * 0.02));
        ctx.fillStyle = dark;
        for (let i = n; i >= 1; i--) ctx.fillText(text, x + i, y + i);
        ctx.fillStyle = g;
        ctx.fillText(text, x, y);
        ctx.lineJoin = "round";
        ctx.lineWidth = Math.max(1, fs * 0.012);
        ctx.strokeStyle = styleId === "gold" ? "rgba(90,55,0,0.8)" : "rgba(20,28,36,0.85)";
        ctx.strokeText(text, x, y);
        break;
      }

      case "rgbsplit": {
        const d = Math.max(1, fs * 0.02 * dk);
        ctx.fillStyle = "rgba(255,0,80,0.85)";
        ctx.fillText(text, x - d, y);
        ctx.fillStyle = "rgba(0,220,255,0.85)";
        ctx.fillText(text, x + d, y);
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
        break;
      }

      default:
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------
  // Highlight / underline styles
  // ------------------------------------------------------------------
  const HL_STYLES = [
    { id: "solid", label: "Solid" },
    { id: "marker", label: "Marker" },
    { id: "glass", label: "Glass" },
    { id: "doodle", label: "Doodle" },
  ];

  // Real highlighter pen: translucent, slightly uneven edges, chisel-tip ends
  function markerShape(ctx, x1, x2, y, h, color, rand) {
    const j = h * 0.045;
    const rj = () => (rand() - 0.5) * 2 * j;
    const sl = h * 0.14;
    const w = x2 - x1;
    const steps = Math.max(2, Math.round(w / (h * 0.7)));

    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.86;
    ctx.beginPath();
    ctx.moveTo(x1 + sl * 0.6, y + rj());
    for (let i = 1; i <= steps; i++) ctx.lineTo(x1 + (w * i) / steps - (i === steps ? sl * 0.2 : 0), y + rj());
    ctx.quadraticCurveTo(x2 + h * 0.1, y + h / 2, x2 - sl * 0.4, y + h + rj());
    for (let i = steps - 1; i >= 0; i--) ctx.lineTo(x1 + (w * i) / steps + sl * 0.2, y + h + rj());
    ctx.quadraticCurveTo(x1 - h * 0.1, y + h / 2, x1 + sl * 0.6, y + rj());
    ctx.closePath();
    ctx.fill();

    // ink pooling along the edges + a darker streak where strokes overlap
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = Math.max(1, h * 0.04);
    ctx.strokeStyle = shade(color, -0.35);
    ctx.stroke();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = shade(color, -0.2);
    ctx.fillRect(x1 + h * 0.08, y + h * (0.3 + rand() * 0.2), Math.max(1, w - h * 0.16), h * 0.1);
    ctx.restore();
  }

  function glassShape(ctx, x1, x2, y, h, color, radiusScale) {
    const w = x2 - x1;
    const r = h * (radiusScale || 0.3);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = h * 0.2;
    ctx.shadowOffsetY = h * 0.06;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, rgba(color, 0.95));
    g.addColorStop(1, rgba(color, 0.62));
    ctx.fillStyle = g;
    roundRectPath(ctx, x1, y, w, h, r);
    ctx.fill();
    ctx.shadowColor = "transparent";

    ctx.save();
    roundRectPath(ctx, x1, y, w, h, r);
    ctx.clip();
    const gloss = ctx.createLinearGradient(0, y, 0, y + h * 0.55);
    gloss.addColorStop(0, "rgba(255,255,255,0.6)");
    gloss.addColorStop(1, "rgba(255,255,255,0.04)");
    ctx.fillStyle = gloss;
    ctx.fillRect(x1, y, w, h * 0.55);
    const bottom = ctx.createLinearGradient(0, y + h * 0.75, 0, y + h);
    bottom.addColorStop(0, "rgba(255,255,255,0)");
    bottom.addColorStop(1, "rgba(255,255,255,0.22)");
    ctx.fillStyle = bottom;
    ctx.fillRect(x1, y + h * 0.75, w, h * 0.25);
    ctx.restore();

    ctx.lineWidth = Math.max(1.2, h * 0.03);
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    roundRectPath(ctx, x1, y, w, h, r);
    ctx.stroke();
    ctx.restore();
  }

  // Hand-coloured scribble + wobbly pen outline
  function doodleBox(ctx, x1, x2, y, h, color, rand) {
    const j = () => (rand() - 0.5) * h * 0.07;
    const pad = h * 0.05;
    const L = x1 + pad;
    const R = x2 - pad;
    const T = y + pad;
    const B = y + h - pad;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;

    ctx.globalAlpha = 0.4;
    ctx.lineWidth = Math.max(2, h * 0.09);
    const step = Math.max(8, h * 0.42);
    ctx.beginPath();
    ctx.moveTo(L + j(), B + j());
    for (let x = L; x < R; x += step) {
      ctx.lineTo(Math.min(R, x + step * 0.6) + j(), T + j());
      ctx.lineTo(Math.min(R, x + step) + j(), B + j());
    }
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(2, h * 0.05);
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      ctx.moveTo(L + j(), T + j());
      ctx.quadraticCurveTo((L + R) / 2, T + j() * 3, R + j(), T + j());
      ctx.quadraticCurveTo(R + j() * 2, (T + B) / 2, R + j(), B + j());
      ctx.quadraticCurveTo((L + R) / 2, B + j() * 3, L + j(), B + j());
      ctx.quadraticCurveTo(L + j() * 2, (T + B) / 2, L + j(), T + h * 0.08 + j());
      ctx.stroke();
    }
    ctx.restore();
  }

  function doodleUnderline(ctx, x1, x2, yc, h, color, rand) {
    const amp = Math.max(2.5, h * 1.1);
    const wl = Math.max(14, h * 3.2);
    const ph = rand() * Math.PI * 2;
    const ph2 = rand() * Math.PI * 2;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = pass === 0 ? 1 : 0.5;
      ctx.lineWidth = Math.max(2, h * (pass === 0 ? 0.9 : 0.4));
      ctx.beginPath();
      for (let x = x1; x <= x2 + 1; x += 3) {
        const m = 0.85 + 0.25 * Math.sin((x - x1) * 0.043 + ph2);
        const yy = yc + (pass ? amp * 0.5 : 0) + Math.sin(((x - x1) / wl) * Math.PI * 2 + ph + pass * 1.3) * amp * m;
        if (x === x1) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // line = layout line (needs highlightTop/Height, underlineTop/Height)
  function drawAnnotation(ctx, type, color, x1, x2, line, style, seed) {
    const w = x2 - x1;
    if (w <= 0) return;
    const isU = type === "underline";
    const top = isU ? line.underlineTop : line.highlightTop;
    const h = isU ? line.underlineHeight : line.highlightHeight;
    const rand = mulberry32((seed | 0) + 17);

    ctx.save();
    ctx.globalAlpha = 1;
    switch (style) {
      case "marker": {
        const th = isU ? h * 2.4 : h;
        const y0 = isU ? top + h / 2 - th / 2 : top;
        markerShape(ctx, x1, x2, y0, th, color, rand);
        break;
      }
      case "glass": {
        const th = isU ? h * 2.1 : h;
        const y0 = isU ? top + h / 2 - th / 2 : top;
        glassShape(ctx, x1, x2, y0, th, color, isU ? 0.5 : 0.3);
        break;
      }
      case "doodle":
        if (isU) doodleUnderline(ctx, x1, x2, top + h / 2, h, color, rand);
        else doodleBox(ctx, x1, x2, top, h, color, rand);
        break;
      default:
        ctx.fillStyle = color;
        ctx.fillRect(x1, top, w, h);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------
  // Thumbnails + chip grids (the visual pickers in the Style tab)
  // ------------------------------------------------------------------
  function drawBgThumb(cv, item, extra) {
    const ctx = cv.getContext("2d");
    const w = cv.width;
    const h = cv.height;
    if (item.id === "image") {
      if (extra && extra.imageSrc) {
        const im = new Image();
        im.onload = () => {
          drawCover(ctx, im, 0, 0, w, h);
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          ctx.fillRect(0, 0, w, h);
        };
        im.src = extra.imageSrc;
      } else {
        ctx.fillStyle = "#2a2a2a";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#aaa";
        ctx.font = `${Math.round(h * 0.5)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("📷", w / 2, h / 2);
      }
      return;
    }
    paintPreset(ctx, w, h, item.id);
  }

  function drawTextThumb(cv, item, s) {
    const ctx = cv.getContext("2d");
    const w = cv.width;
    const h = cv.height;
    ctx.fillStyle = item.demoBg;
    ctx.fillRect(0, 0, w, h);
    const fs = Math.round(h * 0.62);
    ctx.font = fontString(s, fs);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    drawText(ctx, "Aa", w / 2, h * 0.72, item.id, item.demoColor, fs, 6);
  }

  function drawHlThumb(cv, item) {
    const ctx = cv.getContext("2d");
    const w = cv.width;
    const h = cv.height;
    ctx.fillStyle = "#262626";
    ctx.fillRect(0, 0, w, h);
    const fs = h * 0.4;
    const base = h * 0.64;
    ctx.font = `bold ${fs}px Impact, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const line = {
      highlightTop: base - fs * 0.78,
      highlightHeight: fs * 0.86,
      underlineTop: base + fs * 0.11,
      underlineHeight: Math.max(2, Math.round(fs * 0.07)),
    };
    const place = (x, text, type) => {
      const tw = ctx.measureText(text).width;
      drawAnnotation(ctx, type, "#ffe600", x - fs * 0.05, x + tw + fs * 0.05, line, item.id, 7);
      ctx.fillStyle = type === "highlight" && item.id === "solid" ? "#111" : "#fff";
      ctx.fillText(text, x, base);
      return tw;
    };
    const a = place(w * 0.08, "Hi", "highlight");
    place(w * 0.08 + a + w * 0.16, "Go", "underline");
  }

  function buildChipGrid(container, items, onPick) {
    container.innerHTML = "";
    let lastGroup = null;
    items.forEach((item) => {
      if (item.group && item.group !== lastGroup) {
        lastGroup = item.group;
        const t = document.createElement("div");
        t.className = "chip-group-title";
        t.textContent = item.group;
        container.appendChild(t);
      }
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.dataset.id = item.id;
      b.title = item.label;
      const cv = document.createElement("canvas");
      cv.width = 96;
      cv.height = 54;
      b.appendChild(cv);
      const l = document.createElement("span");
      l.textContent = item.label;
      b.appendChild(l);
      b.addEventListener("click", () => onPick(item));
      container.appendChild(b);
    });
  }

  function renderChipThumbs(container, items, drawFn) {
    container.querySelectorAll(".chip").forEach((chip) => {
      const item = items.find((i) => i.id === chip.dataset.id);
      if (item) drawFn(chip.querySelector("canvas"), item);
    });
  }

  function setActiveChip(container, id) {
    container.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c.dataset.id === id));
  }

  const DEFAULTS = {
    lineHeight: 1.4,
    textStyle: "flat",
    textDepth: 6,
    bgImage: "",
    bgImageEffect: "plain",
    bgBlur: 14,
    bgDim: 25,
    hlStyle: "solid",
  };

  return {
    FONTS,
    GOOGLE_FONTS_URL,
    BG_PRESETS,
    TEXT_STYLES,
    HL_STYLES,
    DEFAULTS,
    fontString,
    ensureFont,
    populateFontSelect,
    drawBackground,
    paintPreset,
    drawText,
    drawAnnotation,
    fileToDataURL,
    buildChipGrid,
    renderChipThumbs,
    setActiveChip,
    drawBgThumb,
    drawTextThumb,
    drawHlThumb,
  };
})();
