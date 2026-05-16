import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

// Orpheus TTS via Groq — expressive neural voice
// Endpoint: https://api.groq.com/openai/v1/audio/speech
// Model: canopylabs/orpheus-v1-english
// Voice: jessica (warm, calm female)
// Output: wav
// Max 200 chars per request — text is chunked and WAV files concatenated.
// REQUIRES terms acceptance at https://console.groq.com/playground
// If terms not yet accepted, returns { fallback: true } so client uses expo-speech.

const GROQ_TTS_URL = 'https://api.groq.com/openai/v1/audio/speech';
const TTS_MODEL = 'canopylabs/orpheus-v1-english';
const PRIMARY_VOICE = 'jessica';
const FALLBACK_VOICE = 'zoe';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing required field: text' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GROQ_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GROQ_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean text for speech
    const cleaned = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/ — /g, ', ')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[#*_`]/g, '')
      .trim()
      .slice(0, 1500);

    if (!cleaned) {
      return new Response(
        JSON.stringify({ error: 'No text to synthesize after cleaning' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Split on sentence boundaries — Orpheus max 200 chars per chunk
    const sentenceChunks: string[] = [];
    const sentences = cleaned.split(/(?<=[.!?])\s+/);
    let current = '';
    for (const sentence of sentences) {
      if ((current + ' ' + sentence).trim().length <= 190) {
        current = (current + ' ' + sentence).trim();
      } else {
        if (current) sentenceChunks.push(current);
        if (sentence.length > 190) {
          let rem = sentence;
          while (rem.length > 190) {
            const idx = rem.lastIndexOf(' ', 185);
            sentenceChunks.push(rem.slice(0, idx > 0 ? idx : 185));
            rem = rem.slice(idx > 0 ? idx + 1 : 185);
          }
          current = rem;
        } else {
          current = sentence;
        }
      }
    }
    if (current) sentenceChunks.push(current);

    // Helper to call Groq for one chunk
    const callChunk = async (chunkText: string, voice: string): Promise<ArrayBuffer | null> => {
      const res = await fetch(GROQ_TTS_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: TTS_MODEL,
          input: chunkText,
          voice,
          response_format: 'wav',
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) {
        const errText = await res.text();
        if (errText.includes('terms') || errText.includes('requires terms') || errText.includes('terms acceptance')) {
          throw new Error('TERMS_REQUIRED');
        }
        console.error(`Orpheus chunk error [${res.status}]:`, errText.slice(0, 300));
        return null;
      }
      return await res.arrayBuffer();
    };

    // Generate all chunks
    const audioBuffers: ArrayBuffer[] = [];
    let activeVoice = PRIMARY_VOICE;

    for (let i = 0; i < sentenceChunks.length; i++) {
      let buf = await callChunk(sentenceChunks[i], activeVoice);
      if (buf === null && i === 0) {
        buf = await callChunk(sentenceChunks[i], FALLBACK_VOICE);
        if (buf !== null) activeVoice = FALLBACK_VOICE;
      }
      if (buf !== null) audioBuffers.push(buf);
    }

    if (audioBuffers.length === 0) {
      return new Response(
        JSON.stringify({ error: 'All TTS chunks failed', fallback: true }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Concatenate WAV files: header from first chunk, raw PCM from all
    const WAV_HEADER_BYTES = 44;
    const firstHeader = new Uint8Array(audioBuffers[0]).slice(0, WAV_HEADER_BYTES);
    const totalPCM = audioBuffers.reduce((sum, b) => sum + Math.max(0, b.byteLength - WAV_HEADER_BYTES), 0);

    const combined = new Uint8Array(WAV_HEADER_BYTES + totalPCM);
    combined.set(firstHeader, 0);

    const dv = new DataView(combined.buffer);
    dv.setUint32(4, 36 + totalPCM, true);  // RIFF chunk size
    dv.setUint32(40, totalPCM, true);       // data chunk size

    let offset = WAV_HEADER_BYTES;
    for (const buf of audioBuffers) {
      const pcm = new Uint8Array(buf).slice(WAV_HEADER_BYTES);
      combined.set(pcm, offset);
      offset += pcm.byteLength;
    }

    // Base64-encode
    let binary = '';
    for (let i = 0; i < combined.byteLength; i++) {
      binary += String.fromCharCode(combined[i]);
    }
    const base64Audio = btoa(binary);

    return new Response(
      JSON.stringify({ audio: base64Audio, format: 'wav' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errMsg = String(err);
    console.error('speak-summary error:', errMsg);
    if (errMsg.includes('TERMS_REQUIRED')) {
      return new Response(
        JSON.stringify({ error: 'TERMS_REQUIRED', fallback: true }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
