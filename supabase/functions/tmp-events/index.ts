import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: { method: string; clone: () => any; }) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let targetUrl = 'https://api.truckersmp.com/v2/vtc/75200/events/attending';

    // Try to parse body to check if we want VTC specific events instead of attending events
    try {
      const clonedReq = req.clone();
      const body = await clonedReq.json();
      if (body && body.type === 'vtc') {
        targetUrl = 'https://api.truckersmp.com/v2/vtc/75200/events';
      }
    } catch (e) {
      // Body might be empty or not JSON, just proceed with default URL
    }

    console.log(`[TMP API] Fetching upcoming events from ${targetUrl}`);

    // Fetch events from TruckersMP API
    const response = await fetch(targetUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AuraVTCHub/1.0',
      },
    });

    if (!response.ok) {
      console.error(`[TMP API] Error response: ${response.status}`);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch events', status: response.status }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log(`[TMP API] Fetched ${data.response?.length || 0} events`);
    const eventsArray = Array.isArray(data.response) ? data.response : [];
    return new Response(
      JSON.stringify(eventsArray), // Changed from 'data' to 'eventsArray'
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
