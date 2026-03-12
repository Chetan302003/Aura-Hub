import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const vtcId = 72500;
        const targetUrl = `https://api.truckersmp.com/v2/vtc/${vtcId}/events`;

        console.log(`[VTC API] Fetching upcoming events from ${targetUrl}`);

        const response = await fetch(targetUrl, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'AuraVTCHub/1.0',
            },
        });

        if (!response.ok) {
            console.error(`[VTC API] Error response: ${response.status}`);
            const text = await response.text();
            return new Response(
                JSON.stringify({ error: 'Failed to fetch events', status: response.status, details: text }),
                { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const data = await response.json();
        console.log(`[VTC API] Fetched ${data.response?.length || 0} events`);

        // TruckersMP API returns { error: false, response: [...] }
        const eventsArray = data.response && Array.isArray(data.response) ? data.response : [];

        return new Response(
            JSON.stringify(eventsArray),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error: unknown) {
        console.error('[VTC API] Error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return new Response(
            JSON.stringify({ error: message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
