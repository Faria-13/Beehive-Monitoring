// Calls the same Open-Meteo source used by the Supabase fetch-weather edge function
// (lat/lon = RIT Campus, Henrietta NY)

const LAT = 43.0848;
const LON = -77.6744;

export async function fetchWeatherWidget() {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${LAT}&longitude=${LON}` +
    `&current=temperature_2m,weather_code` +
    `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
    `&forecast_days=5` +
    `&temperature_unit=fahrenheit` +
    `&timezone=America%2FNew_York`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
  return res.json();
}
