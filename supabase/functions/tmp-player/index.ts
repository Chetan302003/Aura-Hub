import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tmpId } = await req.json();

    if (!tmpId || !/^\d+$/.test(tmpId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid TruckersMP ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[TMP API] Fetching player data for ID: ${tmpId}`);

    // Fetch player data from TruckersMP API
    const response = await fetch(`https://api.truckersmp.com/v2/player/${tmpId}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AuraVTCHub/1.0',
      },
    });

    if (!response.ok) {
      console.error(`[TMP API] Error response: ${response.status}`);
      return new Response(
        JSON.stringify({ error: 'Player not found', status: response.status }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log(`[TMP API] Successfully fetched player: ${data.response?.name || 'Unknown'}`);

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[TMP API] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
