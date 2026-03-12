import { useState, useRef, useEffect } from 'react';
import { GlassCard } from '@/components/layout/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  MapPin,
  Plus,
  Trash2,
  Route,
  Navigation,
  Save,
  Share2,
  Loader2,
  GripVertical,
  AlertCircle,
  ExternalLink,
  Globe
} from 'lucide-react';

// Placeholder for Mapbox token - will be configured later
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

interface Waypoint {
  id: string;
  name: string;
  coordinates: [number, number] | null;
  order: number;
}

interface RouteData {
  waypoints: Waypoint[];
  totalDistance: number;
  estimatedTime: number;
  tmpRouteUrl?: string;
}

// TruckersMP route URL generator
const generateTMPRouteUrl = (waypoints: Waypoint[]): string => {
  const validWaypoints = waypoints.filter(w => w.name.trim());
  if (validWaypoints.length < 2) return '';
  
  const departure = encodeURIComponent(validWaypoints[0].name);
  const arrival = encodeURIComponent(validWaypoints[validWaypoints.length - 1].name);
  
  // TruckersMP uses this format for event routes
  return `https://map.truckersmp.com/#/${departure}/${arrival}`;
};

// ETS2 Map route URL generator  
const generateETS2MapUrl = (waypoints: Waypoint[]): string => {
  const validWaypoints = waypoints.filter(w => w.name.trim());
  if (validWaypoints.length < 2) return '';
  
  // Using ets2.lt map for route visualization
  return `https://ets2.lt/en/route-advisor/`;
};

/**
 * Convoy Route Planner with TruckersMP integration
 * 
 * Uses TruckersMP Map for route visualization instead of real-world maps.
 * Optional Mapbox integration for geocoding city names.
 * 
 * TAURI CONVERSION NOTES:
 * -----------------------
 * This component works the same in Tauri. External links open in system browser.
 */
export function ConvoyRoutePlanner() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hasMapbox, setHasMapbox] = useState(!!MAPBOX_TOKEN);
  
  const [waypoints, setWaypoints] = useState<Waypoint[]>([
    { id: '1', name: '', coordinates: null, order: 0 },
    { id: '2', name: '', coordinates: null, order: 1 },
  ]);
  
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(false);

  // Initialize map if token is available
  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainer.current || mapRef.current) return;

    const initMap = async () => {
      try {
        const mapboxgl = await import('mapbox-gl');
        await import('mapbox-gl/dist/mapbox-gl.css');
        
        mapboxgl.default.accessToken = MAPBOX_TOKEN;
        
        const map = new mapboxgl.default.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: [10, 50], // Europe center
          zoom: 4,
        });

        map.addControl(new mapboxgl.default.NavigationControl(), 'top-right');
        
        map.on('load', () => {
          setMapLoaded(true);
          
          // Add route source and layer
          map.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: [],
              },
            },
          });

          map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': 'hsl(145, 85%, 42%)',
              'line-width': 4,
              'line-opacity': 0.8,
            },
          });

          // Add waypoint markers layer
          map.addSource('waypoints', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [],
            },
          });

          map.addLayer({
            id: 'waypoint-markers',
            type: 'circle',
            source: 'waypoints',
            paint: {
              'circle-radius': 10,
              'circle-color': 'hsl(145, 85%, 42%)',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            },
          });
        });

        mapRef.current = map;
      } catch (err) {
        console.error('Failed to load Mapbox:', err);
        setHasMapbox(false);
      }
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Geocode location name to coordinates (optional, for map display)
  const geocodeLocation = async (query: string): Promise<[number, number] | null> => {
    if (!MAPBOX_TOKEN) return null;
    
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=1`
      );
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        return data.features[0].center as [number, number];
      }
    } catch (err) {
      console.error('Geocoding error:', err);
    }
    return null;
  };

  // Calculate route and generate TMP links
  const calculateRoute = async () => {
    const validWaypoints = waypoints.filter(w => w.name.trim());
    
    if (validWaypoints.length < 2) {
      toast.error('Please enter at least 2 waypoints');
      return;
    }

    setLoading(true);

    try {
      // Geocode all waypoints for map display (if Mapbox available)
      const geocodedWaypoints = await Promise.all(
        validWaypoints.map(async (wp) => {
          if (wp.coordinates) return wp;
          const coords = await geocodeLocation(wp.name);
          return { ...wp, coordinates: coords };
        })
      );

      const withCoords = geocodedWaypoints.filter(w => w.coordinates);
      
      setWaypoints(prev => prev.map(w => {
        const found = geocodedWaypoints.find(gw => gw.id === w.id);
        return found || w;
      }));

      // Generate TruckersMP route URL
      const tmpRouteUrl = generateTMPRouteUrl(validWaypoints);

      // Get route from Mapbox Directions API (if available)
      let totalDistance = 0;
      let estimatedTime = 0;

      if (MAPBOX_TOKEN && withCoords.length >= 2) {
        const coordinates = withCoords.map(w => w.coordinates!.join(',')).join(';');
        const response = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`
        );
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          totalDistance = route.distance / 1000; // meters to km
          estimatedTime = route.duration / 60; // seconds to minutes

          // Update map
          if (mapRef.current && mapLoaded) {
            const routeSource = mapRef.current.getSource('route');
            if (routeSource) {
              routeSource.setData({
                type: 'Feature',
                properties: {},
                geometry: route.geometry,
              });
            }

            const waypointSource = mapRef.current.getSource('waypoints');
            if (waypointSource) {
              waypointSource.setData({
                type: 'FeatureCollection',
                features: withCoords.map((wp, idx) => ({
                  type: 'Feature',
                  properties: { name: wp.name, order: idx + 1 },
                  geometry: {
                    type: 'Point',
                    coordinates: wp.coordinates,
                  },
                })),
              });
            }

            // Fit map to route
            const coords = route.geometry.coordinates;
            const bounds = coords.reduce(
              (b: any, c: [number, number]) => b.extend(c),
              new (mapRef.current as any).constructor.LngLatBounds(coords[0], coords[0])
            );
            mapRef.current.fitBounds(bounds, { padding: 50 });
          }
        }
      }

      setRouteData({
        waypoints: withCoords.length > 0 ? withCoords : validWaypoints,
        totalDistance,
        estimatedTime,
        tmpRouteUrl,
      });

      toast.success('Route planned! Open in TruckersMP Map for in-game navigation.');
    } catch (err) {
      console.error('Route calculation error:', err);
      toast.error('Failed to calculate route');
    }

    setLoading(false);
  };

  const addWaypoint = () => {
    setWaypoints(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        name: '',
        coordinates: null,
        order: prev.length,
      },
    ]);
  };

  const removeWaypoint = (id: string) => {
    if (waypoints.length <= 2) {
      toast.error('Minimum 2 waypoints required');
      return;
    }
    setWaypoints(prev => prev.filter(w => w.id !== id));
  };

  const updateWaypoint = (id: string, name: string) => {
    setWaypoints(prev =>
      prev.map(w => (w.id === id ? { ...w, name, coordinates: null } : w))
    );
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const openTMPMap = () => {
    if (routeData?.tmpRouteUrl) {
      window.open(routeData.tmpRouteUrl, '_blank');
    } else {
      window.open('https://map.truckersmp.com', '_blank');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Waypoints Panel */}
        <GlassCard className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Route size={20} className="text-primary" />
              Route Waypoints
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={addWaypoint}
              className="gap-1 rounded-full"
            >
              <Plus size={14} />
              Add Stop
            </Button>
          </div>

          <div className="space-y-3">
            {waypoints.map((waypoint, index) => (
              <div key={waypoint.id} className="flex items-center gap-2">
                <GripVertical size={16} className="text-muted-foreground cursor-grab" />
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  index === 0 
                    ? 'bg-primary text-primary-foreground' 
                    : index === waypoints.length - 1 
                    ? 'bg-accent text-accent-foreground' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {index + 1}
                </div>
                <Input
                  placeholder={index === 0 ? 'Departure city...' : index === waypoints.length - 1 ? 'Destination city...' : 'Waypoint city...'}
                  value={waypoint.name}
                  onChange={(e) => updateWaypoint(waypoint.id, e.target.value)}
                  className="flex-1 glass-input"
                />
                {waypoint.coordinates && (
                  <MapPin size={14} className="text-primary" />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeWaypoint(waypoint.id)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>

          <Button
            onClick={calculateRoute}
            disabled={loading}
            className="w-full rounded-full neon-glow"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin mr-2" />
                Planning...
              </>
            ) : (
              <>
                <Navigation size={16} className="mr-2" />
                Plan Route
              </>
            )}
          </Button>

          {/* Route Summary */}
          {routeData && (
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 space-y-3">
              <h4 className="font-semibold text-primary">Route Summary</h4>
              
              {routeData.totalDistance > 0 && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Estimated Distance</p>
                    <p className="font-bold">{Math.round(routeData.totalDistance)} km</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Est. Time (Real)</p>
                    <p className="font-bold">{formatTime(routeData.estimatedTime)}</p>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2">
                <Button 
                  onClick={openTMPMap}
                  className="w-full gap-2 rounded-full"
                >
                  <Globe size={14} />
                  Open in TruckersMP Map
                  <ExternalLink size={12} />
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-1 rounded-full">
                    <Save size={12} />
                    Save Route
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 gap-1 rounded-full">
                    <Share2 size={12} />
                    Share
                  </Button>
                </div>
              </div>
            </div>
          )}
        </GlassCard>

        {/* Map Panel */}
        <GlassCard className="min-h-[400px] relative overflow-hidden">
          {!MAPBOX_TOKEN ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <Globe size={48} className="text-primary mb-4" />
              <h4 className="font-semibold text-lg mb-2">TruckersMP Route Planner</h4>
              <p className="text-muted-foreground text-sm mb-4">
                Plan your convoy route using in-game city names. 
                The route will open in TruckersMP Map for navigation.
              </p>
              
              {/* TruckersMP Map Preview */}
              <div className="w-full max-w-sm space-y-3">
                <Button 
                  onClick={() => window.open('https://map.truckersmp.com', '_blank')}
                  variant="outline"
                  className="w-full gap-2 rounded-full"
                >
                  <Globe size={16} />
                  Open TruckersMP Map
                  <ExternalLink size={12} />
                </Button>
                
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Enter ETS2/ATS city names above</p>
                  <p>e.g., "Berlin", "Paris", "Rotterdam"</p>
                </div>
              </div>
              
              {/* Optional Mapbox info */}
              <div className="mt-6 p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground">
                <p className="font-medium mb-1">Optional: Enable Map Preview</p>
                <p>Add VITE_MAPBOX_TOKEN to show a map preview here.</p>
              </div>
            </div>
          ) : (
            <div ref={mapContainer} className="absolute inset-0 rounded-2xl" />
          )}
          
          {MAPBOX_TOKEN && !mapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <Loader2 size={32} className="animate-spin text-primary" />
            </div>
          )}
        </GlassCard>
      </div>

      {/* Waypoint List */}
      {routeData && routeData.waypoints.length > 0 && (
        <GlassCard>
          <h4 className="font-semibold mb-3">Convoy Route Stops</h4>
          <div className="flex flex-wrap gap-2">
            {routeData.waypoints.map((wp, idx) => (
              <Badge
                key={wp.id}
                variant="outline"
                className={`gap-1 ${
                  idx === 0 
                    ? 'bg-primary/20 border-primary/40' 
                    : idx === routeData.waypoints.length - 1 
                    ? 'bg-accent/20 border-accent/40' 
                    : ''
                }`}
              >
                <span className="text-xs font-bold">{idx + 1}</span>
                {wp.name}
              </Badge>
            ))}
          </div>
          
          {/* TMP Event Route Tips */}
          <div className="mt-4 p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">📍 For VTC Events</p>
            <p>Use this route in the Event creation form. Players can follow along using TruckersMP Map during the convoy.</p>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
