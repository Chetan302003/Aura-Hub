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
    console.log('[TMP API] Fetching server status');

    // Fetch servers from TruckersMP API
    const response = await fetch('https://api.truckersmp.com/v2/servers', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AuraVTCHub/1.0',
      },
    });

    if (!response.ok) {
      console.error(`[TMP API] Error response: ${response.status}`);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch servers', status: response.status }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log(`[TMP API] Fetched ${data.response?.length || 0} servers`);

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
