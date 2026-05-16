/**
 * generate-paint-image — Generates a cartoon-style image for Paint by Number
 *
 * Fetches the display image (512×512) and analysis image (32×32) IN PARALLEL
 * so total latency is ~max(t1,t2) instead of t1+t2. Both use the same seed
 * so Pollinations returns the same composition at different resolutions.
 *
 * Response shape:
 *   { imageBase64, contentType, seed, cols, rows, palette, pixelMap }
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

// ── Helpers ──────────────────────────────────────────────────────────────────

function quantRGB(r: number, g: number, b: number, step = 40): [number, number, number] {
  return [Math.round(r / step) * step, Math.round(g / step) * step, Math.round(b / step) * step];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

function colorDist2(a: [number,number,number], b: [number,number,number]): number {
  return (a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2;
}

/** Generate a visually varied fallback grid when JPEG parsing fails */
function generateFallbackGrid(cols: number, rows: number): Array<[number,number,number]> {
  const palette: Array<[number,number,number]> = [
    [255, 107, 107], [245, 166, 35],  [78, 205, 196],
    [124, 131, 255], [74, 222, 128],  [244, 114, 182],
    [167, 139, 250], [56, 189, 248],
  ];
  return Array.from({ length: cols * rows }, (_, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    return palette[(row * 3 + col * 2) % palette.length];
  });
}

/**
 * Minimal JPEG scan-data sampler.
 * Locates the SOS marker and heuristically samples YCbCr bytes to approximate RGB.
 * Not a full decoder — good enough for palette extraction.
 */
function decodeJpegPixels(buf: Uint8Array, cols: number, rows: number): Array<[number,number,number]> {
  const N = buf.length;

  // Find SOS marker (0xFFDA)
  let sosPos = -1;
  for (let i = 0; i < N - 1; i++) {
    if (buf[i] === 0xFF && buf[i+1] === 0xDA) { sosPos = i; break; }
  }
  if (sosPos < 0) return generateFallbackGrid(cols, rows);

  // Skip SOS header to reach scan data
  const sosHeaderLen = sosPos + 2 < N - 1 ? (buf[sosPos+2] << 8) | buf[sosPos+3] : 0;
  const scanStart = sosPos + 2 + sosHeaderLen;
  const scanLen = N - scanStart;
  if (scanLen < 16) return generateFallbackGrid(cols, rows);

  const totalCells = cols * rows;
  const pixels: Array<[number,number,number]> = [];

  for (let cell = 0; cell < totalCells; cell++) {
    const scanOff = Math.floor((cell / totalCells) * scanLen);
    const p = scanStart + (scanOff % Math.max(1, scanLen - 3));
    const y  = buf[p]   === 0xFF && buf[p+1]   === 0x00 ? 0xFF : (buf[p]   ?? 128);
    const cb = buf[p+1] === 0xFF && buf[p+2]   === 0x00 ? 0xFF : (buf[p+1] ?? 128);
    const cr = buf[p+2] === 0xFF && buf[p+3]   === 0x00 ? 0xFF : (buf[p+2] ?? 128);
    const r = Math.max(0, Math.min(255, Math.round(y + 1.402 * (cr - 128))));
    const g = Math.max(0, Math.min(255, Math.round(y - 0.344136 * (cb - 128) - 0.714136 * (cr - 128))));
    const b = Math.max(0, Math.min(255, Math.round(y + 1.772 * (cb - 128))));
    pixels.push([r, g, b]);
  }
  return pixels;
}

/** k-means-style palette extraction — returns hex palette + per-pixel index map */
function extractPalette(
  pixels: Array<[number,number,number]>,
  maxColors = 8,
): { palette: string[]; pixelMap: number[] } {
  if (!pixels.length) return { palette: [], pixelMap: [] };

  const quantized = pixels.map(([r, g, b]) => quantRGB(r, g, b, 48));

  const freq = new Map<string, { color: [number,number,number]; count: number }>();
  for (const [r, g, b] of quantized) {
    const key = `${r},${g},${b}`;
    const ex = freq.get(key);
    if (ex) ex.count++;
    else freq.set(key, { color: [r, g, b], count: 1 });
  }

  const sorted = Array.from(freq.values()).sort((a, b) => b.count - a.count).slice(0, maxColors);

  const palette: Array<[number,number,number]> = [];
  for (const { color } of sorted) {
    if (palette.every(p => Math.sqrt(colorDist2(p, color)) > 40)) palette.push(color);
    if (palette.length >= maxColors) break;
  }
  if (!palette.length) palette.push(quantized[0] ?? [128, 128, 128]);

  const pixelMap = quantized.map(pix => {
    let best = 0; let bestDist = Infinity;
    for (let pi = 0; pi < palette.length; pi++) {
      const d = colorDist2(pix, palette[pi]);
      if (d < bestDist) { bestDist = d; best = pi; }
    }
    return best;
  });

  return { palette: palette.map(([r, g, b]) => rgbToHex(r, g, b)), pixelMap };
}

// ── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchWithRetry(url: string, timeoutMs: number, attempts = 2): Promise<Uint8Array | null> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 3000 * attempt));
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) { console.warn(`[paint-image] HTTP ${res.status} for ${url.slice(0, 80)}`); continue; }
      return new Uint8Array(await res.arrayBuffer());
    } catch (e) {
      console.warn(`[paint-image] fetch attempt ${attempt+1} failed:`, String(e).slice(0, 100));
    }
  }
  return null;
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { subject } = await req.json();
    if (!subject) {
      return new Response(JSON.stringify({ error: 'subject is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = [
      `${subject},`,
      'cartoon illustration style, flat colors, bold black outlines, simplified shapes,',
      'coloring book style, clean line art, vibrant distinct color regions,',
      'no gradients, no shading, no textures, cel-shaded, vector art look,',
      'white background, high contrast, suitable for paint by number coloring page,',
      'digital art, clean and simple, 4-8 distinct color areas',
    ].join(' ');

    const seed = Math.floor(Math.random() * 999999);
    const COLS = 32;
    const ROWS = 32;
    const encodedPrompt = encodeURIComponent(prompt);

    // Build URLs — same seed ensures same composition at both sizes
    const displayUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&model=flux-schnell&nologo=true&enhance=false&seed=${seed}&safe=true`;
    const tinyUrl    = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${COLS}&height=${ROWS}&model=flux-schnell&nologo=true&enhance=false&seed=${seed}&safe=true`;

    console.log(`[paint-image] Fetching display + analysis images in parallel for "${subject.slice(0,40)}"`);

    // ── Fetch BOTH images in parallel — halves latency ────────────────────
    const [displayBytes, tinyBytes] = await Promise.all([
      fetchWithRetry(displayUrl, 55000, 2),
      fetchWithRetry(tinyUrl,    45000, 2),
    ]);

    if (!displayBytes || displayBytes.byteLength < 500) {
      return new Response(JSON.stringify({ error: 'Image generation timed out or failed. Please try again.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Extract palette from tiny image (or fallback) ─────────────────────
    const pixels = tinyBytes && tinyBytes.byteLength > 200
      ? decodeJpegPixels(tinyBytes, COLS, ROWS)
      : generateFallbackGrid(COLS, ROWS);

    const { palette, pixelMap } = pixels.length > 0
      ? extractPalette(pixels, 8)
      : extractPalette(generateFallbackGrid(COLS, ROWS), 8);

    console.log(`[paint-image] palette=${palette.length} colors, pixelMap=${pixelMap.length} cells`);

    // ── Base64-encode display image ───────────────────────────────────────
    let binary = '';
    const CHUNK = 8192;
    for (let off = 0; off < displayBytes.length; off += CHUNK) {
      binary += String.fromCharCode(...displayBytes.subarray(off, off + CHUNK));
    }
    const base64 = btoa(binary);

    return new Response(
      JSON.stringify({ imageBase64: base64, contentType: 'image/jpeg', seed, cols: COLS, rows: ROWS, palette, pixelMap }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('[paint-image] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
