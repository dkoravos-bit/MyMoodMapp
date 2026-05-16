/**
 * generate-mood-art — Free AI image generation via Pollinations.ai
 *
 * Uses https://image.pollinations.ai (100% free, no API key required)
 * with the FLUX model for high-quality mood visualizations.
 *
 * Art types:
 *   "now"       → radial energy portrait for current emotional state
 *   "landscape" → emotional terrain panorama (week/month views)
 *   "forecast"  → atmospheric sky scene for 48h prediction
 *   "print"     → abstract soul signature / mood fingerprint
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// ── Dimension helpers ────────────────────────────────────────────────────────
const palette = (s: number) => {
  if (s >= 80) return 'warm amber gold, radiant sunrise orange, luminous cream, thriving energy';
  if (s >= 65) return 'cool teal, sage green, clear sky blue, calm and peaceful';
  if (s >= 50) return 'soft gold, warm sand, muted amber, neutral warmth';
  if (s >= 35) return 'deep indigo, slate blue, cool violet, introspective';
  return 'deep navy, midnight blue, dark slate, heavy and brooding';
};

const sceneMood = (s: number) => {
  if (s >= 80) return 'expansive, radiant, full of light and energy';
  if (s >= 65) return 'serene, clear, quietly beautiful';
  if (s >= 50) return 'gentle, hazy, in-between states';
  if (s >= 35) return 'brooding, quiet, introspective';
  return 'heavy, deep, searching for light';
};

// ── Dimension sizes for Pollinations ────────────────────────────────────────
// Kept small for fast generation — flux-schnell handles these in ~15-25s
const getDimensions = (aspectRatio: string): { width: number; height: number } => {
  switch (aspectRatio) {
    case '16:9': return { width: 640, height: 360 };   // fast 16:9
    case '9:16': return { width: 360, height: 640 };
    case '4:3':  return { width: 640, height: 480 };
    case '3:4':  return { width: 480, height: 640 };
    default:     return { width: 512, height: 512 };   // fast 1:1
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      artType,
      score,
      dimensions,
      dominantTag,
      volatility,
      trend,
      timeOfDay,
      forecastMood,
      cyclePhase,
      weatherCondition,
      entryCount,
      seedOverride,
    } = await req.json();

    const s = score ?? 50;
    const dimBody   = dimensions ? Math.round(((dimensions.body + 1) / 2) * 100) : 50;
    const dimMind   = dimensions ? Math.round(((dimensions.mind + 1) / 2) * 100) : 50;
    const dimEnergy = dimensions ? Math.round(dimensions.energy * 100) : 50;

    let prompt = '';
    let aspectRatio = '1:1';

    // ── Build prompt by art type ─────────────────────────────────────────────
    if (artType === 'landscape') {
      aspectRatio = '16:9';
      prompt = [
        `Aerial topographic landscape, cinematic drone photography, emotional data visualization.`,
        `Mood ${s}/100: ${sceneMood(s)}. Colors: ${palette(s)}.`,
        `Terrain height reflects wellbeing — peaks are thriving days, valleys are struggles.`,
        dimBody > 70 ? 'Lush green meadows and valleys.' : dimBody > 40 ? 'Mixed terrain, patches of color.' : 'Sparse rocky terrain.',
        dimMind > 70 ? 'Crystal clear atmosphere, sharp mountain ridges.' : dimMind > 40 ? 'Morning mist in the valleys.' : 'Heavy fog over the landscape.',
        dimEnergy > 70 ? 'Dramatic golden hour light, long warm shadows.' : dimEnergy > 40 ? 'Soft diffused afternoon light.' : 'Overcast flat subdued light.',
        trend === 'improving' ? 'A glowing river flows toward bright highlands.' : trend === 'declining' ? 'Terrain descends into misty valleys.' : 'Balanced plateau with varied terrain.',
        cyclePhase === 'follicular' ? 'Spring-green bloom accent.' : cyclePhase === 'ovulation' ? 'Golden summit highlight.' : cyclePhase === 'luteal' ? 'Warm amber autumn tones.' : cyclePhase === 'menstrual' ? 'Deep red earth tones.' : '',
        'National Geographic photorealistic quality, 8K detail, no text, no people, no UI.',
      ].filter(Boolean).join(' ');
    }

    else if (artType === 'print') {
      aspectRatio = '1:1';
      // Fingerprint ridge pattern — matches LayerPrint description in mapp.tsx
      const ridgePattern = volatility === 'stable'
        ? 'perfect loop whorl fingerprint — tight precise concentric ridge lines, mathematically symmetrical'
        : volatility === 'variable'
          ? 'arch-loop composite fingerprint — bifurcating organic ridges with natural forks and splits'
          : 'fragmented delta fingerprint — shattered ridge endings, broken whorls, crystalline fracture points';
      prompt = [
        `Extreme macro forensic fingerprint scan under microscope, ultra-detailed ridge and valley pattern, dark background. 4K.`,
        `Ridge color: ${palette(s)}.`,
        `Ridge pattern: ${ridgePattern}.`,
        dimBody > 60 ? 'Thick bold raised ridges, deep dark valleys between them.' : 'Fine delicate ridge lines, subtle valley depth.',
        dimMind > 60 ? 'Crystal-sharp ridge definition, perfectly crisp edges, high contrast.' : 'Soft slightly blurred ridge boundaries, lower contrast.',
        dimEnergy > 60 ? 'Vivid glowing ridge colors with bioluminescent inner light.' : 'Muted desaturated ridge colors, faded washed-out appearance.',
        trend === 'improving' ? 'Bright light radiates outward from the central core whorl.' : trend === 'declining' ? 'Ridge colors darken and converge toward the center.' : 'Even ridge illumination, balanced radial symmetry.',
        dominantTag ? `Ridge texture subtly influenced by "${dominantTag}" emotional context.` : '',
        `Pattern encodes ${entryCount ?? 30} mood data points.`,
        'Forensic fingerprint photography, dark background, ridges highlighted with glowing bioluminescent color. No text, no labels, no UI.',
      ].filter(Boolean).join(' ');
    }

    else if (artType === 'forecast') {
      aspectRatio = '16:9';
      const sky = forecastMood === 'high'
        ? 'golden sunrise breaking through dramatic clouds, warm amber light, expansive optimistic sky'
        : forecastMood === 'low'
          ? 'moody twilight with brooding low clouds, atmospheric indigo and deep purple'
          : 'soft mid-day light, scattered clouds, balanced peaceful tone';
      prompt = [
        `Atmospheric sky panorama, 48-hour emotional weather forecast scene. Cinematic landscape.`,
        `Sky: ${sky}.`,
        `Colors: ${palette(s)}.`,
        weatherCondition ? `Weather: ${weatherCondition} conditions reflected in clouds.` : '',
        dimEnergy > 60 ? 'High altitude cirrus clouds, fast-moving energetic sky.' : 'Low cumulus clouds, slow-moving grounded atmosphere.',
        trend === 'improving' ? 'Clearing skies with golden beams breaking through.' : trend === 'declining' ? 'Approaching weather front, dramatic contrast.' : 'Stable balanced atmospheric conditions.',
        timeOfDay === 'morning' ? 'Misty lake reflection in the foreground.' : timeOfDay === 'evening' ? 'Silhouetted treeline at dusk.' : timeOfDay === 'night' ? 'Starlit horizon.' : 'Expansive open meadow foreground.',
        'Ansel Adams quality photography, ultra-sharp, no text, no people.',
      ].filter(Boolean).join(' ');
    }

    else {
      // 'now' — energy field portrait
      aspectRatio = '1:1';
      prompt = [
        `Abstract energy field visualization, living emotional compass, present moment. 4K digital art.`,
        `Wellness score ${s}/100: ${sceneMood(s)}.`,
        `Colors: ${palette(s)}.`,
        `Four energy quadrants:`,
        `North/Mind ${dimMind}%: ${dimMind > 60 ? 'electric blue plasma field' : 'soft cool mist'}.`,
        `East/Energy ${dimEnergy}%: ${dimEnergy > 60 ? 'vivid green lightning arcs' : 'gentle ember glow'}.`,
        `South/Body ${dimBody}%: ${dimBody > 60 ? 'warm amber force field' : 'cool lavender haze'}.`,
        `West/Focus: ${dimEnergy > 60 && dimMind > 60 ? 'sharp orange geometric rays' : 'soft diffuse light waves'}.`,
        `Central core: ${s > 65 ? 'brilliant pulsing radiant sphere' : s > 40 ? 'steady warm glow orb' : 'deep blue gathering ember'}.`,
        volatility === 'stable' ? 'Shape is perfectly circular and symmetrical.' : volatility === 'variable' ? 'Shape is organically asymmetric.' : 'Shape is dynamically fractured and faceted.',
        'Cosmic energy art, bioluminescence, plasma physics. No text, no UI.',
      ].filter(Boolean).join(' ');
    }

    // ── Call Pollinations.ai (free, no API key) ──────────────────────────────
    const { width, height } = getDimensions(aspectRatio);
    // seedOverride from client ensures forced-regen produces a distinct image
    const seed = (seedOverride != null ? Number(seedOverride) : null) ?? Math.floor(Math.random() * 999999);
    // flux-schnell: fastest Pollinations model
    // enhance=false keeps latency low; nologo removes watermark
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&model=flux-schnell&nologo=true&enhance=false&seed=${seed}&safe=false`;

    console.log(`[mood-art] Generating ${artType} via Pollinations flux-schnell (${width}x${height}) seed=${seed}`);

    // Fetch with up to 3 attempts; 90s timeout each.
    // 429 rate-limit = Pollinations busy — MUST wait 20s before retry (per-IP rate limit).
    // Normal failures get a 5s wait.
    // Total max time ~3×90s + 2×20s = ~310s max, but typical is 15-60s on first attempt.
    let imgResponse: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        const wait = 20000; // 20s backoff — required for Pollinations 429 rate limits
        console.log(`[mood-art] Retrying after ${wait / 1000}s (attempt ${attempt + 1})`);
        await new Promise(r => setTimeout(r, wait));
      }
      try {
        imgResponse = await fetch(pollinationsUrl, {
          signal: AbortSignal.timeout(90000), // 90s per attempt
        });
        if (imgResponse.status === 429) {
          console.warn('[mood-art] 429 rate limit, will retry after 20s');
          imgResponse = null;
          continue;
        }
        if (!imgResponse.ok) {
          console.warn(`[mood-art] HTTP ${imgResponse.status}, will retry`);
          imgResponse = null;
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }
        break; // success
      } catch (fetchErr) {
        console.warn(`[mood-art] Fetch attempt ${attempt + 1} failed:`, fetchErr);
        imgResponse = null;
      }
    }

    if (!imgResponse || !imgResponse.ok) {
      const status = imgResponse?.status ?? 0;
      console.error('[mood-art] Pollinations error:', status, imgResponse?.statusText ?? 'no response');
      return new Response(
        JSON.stringify({ error: `Image generation failed: ${status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const imageBuffer = await imgResponse.arrayBuffer();
    if (!imageBuffer || imageBuffer.byteLength < 1000) {
      return new Response(
        JSON.stringify({ error: 'Generated image too small or empty' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Upload to Supabase Storage ───────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const contentType = imgResponse.headers.get('content-type') ?? 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const fileName = `mood-art/${artType}-${Date.now()}-${seed}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('vibe-cards')
      .upload(fileName, imageBuffer, {
        contentType,
        cacheControl: '86400',
        upsert: false,
      });

    if (uploadError) {
      console.error('[mood-art] Storage upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: `Storage: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { publicUrl } } = supabase.storage
      .from('vibe-cards')
      .getPublicUrl(fileName);

    console.log(`[mood-art] Done: ${publicUrl}`);

    return new Response(
      JSON.stringify({ artUrl: publicUrl, artType }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[mood-art] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
