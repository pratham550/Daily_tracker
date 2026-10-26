// Open-Meteo: free, no API key, no account.
const WMO = [
  [[0], '☀️', 'Clear sky'],
  [[1], '🌤️', 'Mostly clear'],
  [[2], '⛅', 'Partly cloudy'],
  [[3], '☁️', 'Cloudy'],
  [[45, 48], '🌫️', 'Fog'],
  [[51, 53, 55, 56, 57], '🌦️', 'Drizzle'],
  [[61, 63, 65, 66, 67], '🌧️', 'Rain'],
  [[71, 73, 75, 77], '❄️', 'Snow'],
  [[80, 81, 82], '🌦️', 'Showers'],
  [[95, 96, 99], '⛈️', 'Thunderstorm'],
];

export function describeWeather(code) {
  const hit = WMO.find(([codes]) => codes.includes(code));
  return hit ? { icon: hit[1], text: hit[2] } : { icon: '🌡️', text: 'Weather' };
}

async function getJson(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

export async function searchCity(name) {
  const j = await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=6&language=en&format=json`);
  return (j.results || []).map((c) => ({
    name: c.name, region: [c.admin1, c.country].filter(Boolean).join(', '), lat: c.latitude, lon: c.longitude,
  }));
}

export async function fetchWeather(city) {
  const j = await getJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}` +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code' +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=1&timezone=auto',
  );
  return {
    at: Date.now(),
    temp: Math.round(j.current.temperature_2m),
    feels: Math.round(j.current.apparent_temperature),
    humidity: j.current.relative_humidity_2m,
    code: j.current.weather_code,
    max: Math.round(j.daily.temperature_2m_max[0]),
    min: Math.round(j.daily.temperature_2m_min[0]),
    rain: j.daily.precipitation_probability_max[0],
  };
}
