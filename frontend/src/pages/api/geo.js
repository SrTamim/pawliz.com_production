// Reads Vercel's IP-geo headers (city-level, no browser permission prompt).
// On localhost / non-Vercel hosts these headers are absent -> returns
// { lat: null, lng: null }; the client then simply skips prefetch. Never throws.
export default function handler(req, res) {
  const lat = parseFloat(req.headers["x-vercel-ip-latitude"]);
  const lng = parseFloat(req.headers["x-vercel-ip-longitude"]);
  const city = req.headers["x-vercel-ip-city"] || null;

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    res.status(200).json({ lat, lng, city: city ? decodeURIComponent(city) : null });
  } else {
    res.status(200).json({ lat: null, lng: null, city: null });
  }
}
