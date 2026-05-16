import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { selfieBase64, archetypeName, archetypeEmoji, archetypeTagline, archetypeColor, archetypeTraits } = await req.json();

    if (!selfieBase64 || !archetypeName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: selfieBase64, archetypeName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('ONSPACE_AI_API_KEY');
    const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL');

    if (!apiKey || !baseUrl) {
      return new Response(
        JSON.stringify({ error: 'OnSpace AI not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the AI prompt for vibe card generation
    const prompt = `Create a stunning, visually striking personality vibe card for a mobile app.

The person in the provided selfie has been identified as: "${archetypeName} ${archetypeEmoji}"
Tagline: "${archetypeTagline}"
Key traits: ${archetypeTraits.join(', ')}
Brand color: ${archetypeColor}

Design instructions:
- Incorporate the person's face/likeness from the selfie prominently in the upper portion of the card
- Apply a dreamy, artistic filter/treatment to their portrait — painterly, glowing aura, or cosmic effect
- Surround them with abstract energy that matches their archetype: use ${archetypeColor} as the dominant color with complementary hues
- Lower portion: dark, elegant overlay with the archetype name in bold typography
- Overall aesthetic: premium, cinematic, shareable — like a tarot card meets a modern identity card
- 3:4 portrait orientation, centered composition
- Ultra high resolution, dramatic lighting, vivid colors
- No text overlays needed — just the visual portrait and aura`;

    const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        modalities: ['image', 'text'],
        image_config: {
          aspect_ratio: '3:4',
          image_size: '1K',
        },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${selfieBase64}` },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('OnSpace AI error:', errText);
      return new Response(
        JSON.stringify({ error: `OnSpace AI: ${errText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const imageUrl = aiData?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error('No image in AI response:', JSON.stringify(aiData));
      return new Response(
        JSON.stringify({ error: 'AI did not return an image' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert base64 data URL to binary blob
    const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'image/png' });

    // Upload to Supabase Storage
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const fileName = `vibe-cards/${crypto.randomUUID()}.png`;

    const { error: uploadError } = await supabase.storage
      .from('vibe-cards')
      .upload(fileName, blob, {
        contentType: 'image/png',
        cacheControl: '31536000',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: `Storage: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { publicUrl } } = supabase.storage
      .from('vibe-cards')
      .getPublicUrl(fileName);

    return new Response(
      JSON.stringify({ vibeCardUrl: publicUrl }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('generate-vibe-card error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
