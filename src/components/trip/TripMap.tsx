import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { openDirections } from "@/lib/maps";

export type MapMarker = {
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  category: "hotel" | "restaurant" | "activity" | "photo" | "gem" | "itinerary";
  day?: number;
  order?: number;
};

const CATEGORY_COLOR: Record<MapMarker["category"], string> = {
  hotel: "#2563eb",       // blue
  restaurant: "#ea580c",  // orange
  activity: "#16a34a",    // green
  photo: "#9333ea",       // purple
  gem: "#dc2626",         // red
  itinerary: "#0f766e",   // teal
};

let cssLoaded = false;
function ensureLeafletCss() {
  if (cssLoaded || typeof document === "undefined") return;
  if (!document.querySelector('link[data-leaflet="1"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    link.setAttribute("data-leaflet", "1");
    document.head.appendChild(link);
  }
  cssLoaded = true;
}

export function TripMap({
  markers,
  route,
  height = 480,
}: {
  markers: MapMarker[];
  /** ordered lat/lng list to draw a polyline through */
  route?: Array<{ lat: number; lng: number }>;
  height?: number;
}) {
  const { t, i18n } = useTranslation();
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    ensureLeafletCss();

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;

      // Init once
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let map = mapRef.current as any;
      if (!map) {
        map = L.map(ref.current, { scrollWheelZoom: false, zoomControl: true });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);
        mapRef.current = map;
        // The popup's "Directions" link can't use a plain <a href> + window.open:
        // the Android WebView has no window.open support (see src/lib/maps.ts),
        // so it's a data-lat/data-lng button wired up here through Leaflet's
        // popupopen event instead, routed through the same Browser.open() helper
        // the rest of the app uses.
        map.on("popupopen", (e: { popup: { getElement(): HTMLElement | null } }) => {
          const el = e.popup.getElement();
          const link = el?.querySelector<HTMLElement>(".js-directions");
          if (!link) return;
          link.onclick = (ev) => {
            ev.preventDefault();
            const lat = Number(link.dataset.lat);
            const lng = Number(link.dataset.lng);
            openDirections(lat, lng);
          };
        });
      }

      // Clear existing layers except tiles
      map.eachLayer((layer: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const l = layer as any;
        if (l instanceof L.Marker || l instanceof L.Polyline) map.removeLayer(l);
      });

      const valid = markers.filter(
        (m) => Number.isFinite(m.lat) && Number.isFinite(m.lng) && (m.lat !== 0 || m.lng !== 0),
      );

      valid.forEach((m) => {
        const color = CATEGORY_COLOR[m.category];
        const badge = m.day ?? "";
        const icon = L.divIcon({
          className: "trip-map-pin",
          html: `<span style="
            display:flex;align-items:center;justify-content:center;
            width:30px;height:30px;border-radius:9999px;
            background:${color};color:white;font-weight:600;font-size:12px;
            box-shadow:0 4px 12px rgba(0,0,0,0.25);border:2px solid white;
          ">${badge}</span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
        const popup = `
          <div style="font-family:inherit;min-width:180px">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:${color};font-weight:600">
              ${escapeHtml(t(`map.category.${m.category}`))}${m.day ? ` · ${escapeHtml(t("trip.day"))} ${m.day}` : ""}
            </div>
            <div style="font-weight:600;margin-top:2px">${escapeHtml(m.title)}</div>
            ${m.subtitle ? `<div style="color:#555;font-size:12px;margin-top:2px">${escapeHtml(m.subtitle)}</div>` : ""}
            <a href="#" class="js-directions" data-lat="${m.lat}" data-lng="${m.lng}"
              style="display:inline-block;margin-top:6px;color:#0f766e;font-size:12px;font-weight:500">
              ${escapeHtml(t("trip.directions"))} →
            </a>
          </div>
        `;
        L.marker([m.lat, m.lng], { icon }).addTo(map).bindPopup(popup);
      });

      if (route && route.length > 1) {
        const pts = route
          .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0))
          .map((p) => [p.lat, p.lng] as [number, number]);
        if (pts.length > 1) {
          L.polyline(pts, {
            color: "#0f766e",
            weight: 3,
            opacity: 0.7,
            dashArray: "6,8",
          }).addTo(map);
        }
      }

      const all = valid.map((m) => [m.lat, m.lng] as [number, number]);
      if (route) {
        route.forEach((p) => {
          if (Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0)) {
            all.push([p.lat, p.lng]);
          }
        });
      }
      if (all.length > 0) {
        const bounds = L.latLngBounds(all);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      } else {
        map.setView([20, 0], 2);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [markers, route, t, i18n.language]);

  useEffect(() => {
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = mapRef.current as any;
      if (m) {
        m.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="rounded-2xl overflow-hidden border border-border shadow-soft">
      <div ref={ref} style={{ height, width: "100%" }} />
    </div>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function MapLegend() {
  const { t } = useTranslation();
  const keys: MapMarker["category"][] = ["hotel", "restaurant", "activity", "photo", "gem", "itinerary"];
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      {keys.map((k) => (
        <div key={k} className="inline-flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-full border border-white shadow"
            style={{ background: CATEGORY_COLOR[k] }}
          />
          <span className="text-muted-foreground">{t(`map.legend.${k}`)}</span>
        </div>
      ))}
    </div>
  );
}
