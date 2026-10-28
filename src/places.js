// Countries and a built-in city list, so an asset can be placed on the map without any geocoding service.
// [city, region label, ISO country, latitude, longitude]
export const COUNTRIES = {
  US: { name: 'United States', short: 'US' }, CA: { name: 'Canada', short: 'CA' }, MX: { name: 'Mexico', short: 'MX' }, BR: { name: 'Brazil', short: 'BR' },
  GB: { name: 'United Kingdom', short: 'UK' }, IE: { name: 'Ireland', short: 'IE' }, PT: { name: 'Portugal', short: 'PT' }, ES: { name: 'Spain', short: 'ES' },
  FR: { name: 'France', short: 'FR' }, DE: { name: 'Germany', short: 'DE' }, IT: { name: 'Italy', short: 'IT' }, NL: { name: 'Netherlands', short: 'NL' },
  CH: { name: 'Switzerland', short: 'CH' }, AE: { name: 'United Arab Emirates', short: 'AE' }, AU: { name: 'Australia', short: 'AU' }, NZ: { name: 'New Zealand', short: 'NZ' },
  JP: { name: 'Japan', short: 'JP' },
};

export const CITIES_LIST = [
  ['New York', 'NY', 'US', 40.71, -74.01], ['Los Angeles', 'CA', 'US', 34.05, -118.24], ['Chicago', 'IL', 'US', 41.88, -87.63], ['Houston', 'TX', 'US', 29.76, -95.37],
  ['Phoenix', 'AZ', 'US', 33.45, -112.07], ['Philadelphia', 'PA', 'US', 39.95, -75.17], ['San Antonio', 'TX', 'US', 29.42, -98.49], ['San Diego', 'CA', 'US', 32.72, -117.16],
  ['Dallas', 'TX', 'US', 32.78, -96.8], ['Austin', 'TX', 'US', 30.27, -97.74], ['San Jose', 'CA', 'US', 37.34, -121.89], ['San Francisco', 'CA', 'US', 37.77, -122.42],
  ['Jacksonville', 'FL', 'US', 30.33, -81.66], ['Fort Worth', 'TX', 'US', 32.76, -97.33], ['Columbus', 'OH', 'US', 39.96, -83.0], ['Charlotte', 'NC', 'US', 35.23, -80.84],
  ['Indianapolis', 'IN', 'US', 39.77, -86.16], ['Seattle', 'WA', 'US', 47.61, -122.33], ['Denver', 'CO', 'US', 39.74, -104.99], ['Washington', 'DC', 'US', 38.91, -77.04],
  ['Boston', 'MA', 'US', 42.36, -71.06], ['Nashville', 'TN', 'US', 36.16, -86.78], ['Detroit', 'MI', 'US', 42.33, -83.05], ['Portland', 'OR', 'US', 45.52, -122.68],
  ['Las Vegas', 'NV', 'US', 36.17, -115.14], ['Memphis', 'TN', 'US', 35.15, -90.05], ['Louisville', 'KY', 'US', 38.25, -85.76], ['Baltimore', 'MD', 'US', 39.29, -76.61],
  ['Milwaukee', 'WI', 'US', 43.04, -87.91], ['Albuquerque', 'NM', 'US', 35.08, -106.65], ['Tucson', 'AZ', 'US', 32.22, -110.97], ['Fresno', 'CA', 'US', 36.74, -119.79],
  ['Sacramento', 'CA', 'US', 38.58, -121.49], ['Kansas City', 'MO', 'US', 39.1, -94.58], ['Atlanta', 'GA', 'US', 33.75, -84.39], ['Miami', 'FL', 'US', 25.76, -80.19],
  ['Raleigh', 'NC', 'US', 35.78, -78.64], ['Omaha', 'NE', 'US', 41.26, -95.93], ['Minneapolis', 'MN', 'US', 44.98, -93.27], ['Tampa', 'FL', 'US', 27.95, -82.46],
  ['New Orleans', 'LA', 'US', 29.95, -90.07], ['Cleveland', 'OH', 'US', 41.5, -81.69], ['Pittsburgh', 'PA', 'US', 40.44, -79.99], ['Cincinnati', 'OH', 'US', 39.1, -84.51],
  ['St. Louis', 'MO', 'US', 38.63, -90.2], ['Orlando', 'FL', 'US', 28.54, -81.38], ['Salt Lake City', 'UT', 'US', 40.76, -111.89], ['Scottsdale', 'AZ', 'US', 33.49, -111.93],
  ['Honolulu', 'HI', 'US', 21.31, -157.86], ['Anchorage', 'AK', 'US', 61.22, -149.9], ['Charleston', 'SC', 'US', 32.78, -79.93], ['Savannah', 'GA', 'US', 32.08, -81.09],
  ['Boise', 'ID', 'US', 43.62, -116.2], ['Santa Fe', 'NM', 'US', 35.69, -105.94], ['Aspen', 'CO', 'US', 39.19, -106.82], ['Newport', 'RI', 'US', 41.49, -71.31],
  ['Key West', 'FL', 'US', 24.56, -81.78], ['Moab', 'UT', 'US', 38.57, -109.55], ['Sturgis', 'SD', 'US', 44.41, -103.51], ['Teterboro', 'NJ', 'US', 40.85, -74.06],
  ['Toronto', 'ON', 'CA', 43.65, -79.38], ['Montreal', 'QC', 'CA', 45.5, -73.57], ['Vancouver', 'BC', 'CA', 49.28, -123.12], ['Calgary', 'AB', 'CA', 51.05, -114.07],
  ['Ottawa', 'ON', 'CA', 45.42, -75.7], ['Mexico City', 'MX', 'MX', 19.43, -99.13], ['Cancún', 'MX', 'MX', 21.16, -86.85], ['Guadalajara', 'MX', 'MX', 20.66, -103.35],
  ['São Paulo', 'BR', 'BR', -23.55, -46.63], ['Rio de Janeiro', 'BR', 'BR', -22.91, -43.17],
  ['London', 'UK', 'GB', 51.51, -0.13], ['Manchester', 'UK', 'GB', 53.48, -2.24], ['Edinburgh', 'UK', 'GB', 55.95, -3.19], ['Birmingham', 'UK', 'GB', 52.49, -1.89],
  ['Dublin', 'IE', 'IE', 53.35, -6.26], ['Lisbon', 'PT', 'PT', 38.72, -9.14], ['Porto', 'PT', 'PT', 41.15, -8.61], ['Faro', 'PT', 'PT', 37.02, -7.93],
  ['Madrid', 'ES', 'ES', 40.42, -3.7], ['Barcelona', 'ES', 'ES', 41.39, 2.17], ['Valencia', 'ES', 'ES', 39.47, -0.38], ['Málaga', 'ES', 'ES', 36.72, -4.42], ['Palma', 'ES', 'ES', 39.57, 2.65],
  ['Paris', 'FR', 'FR', 48.86, 2.35], ['Nice', 'FR', 'FR', 43.7, 7.27], ['Lyon', 'FR', 'FR', 45.76, 4.84], ['Berlin', 'DE', 'DE', 52.52, 13.41], ['Munich', 'DE', 'DE', 48.14, 11.58],
  ['Hamburg', 'DE', 'DE', 53.55, 9.99], ['Frankfurt', 'DE', 'DE', 50.11, 8.68], ['Rome', 'IT', 'IT', 41.9, 12.5], ['Milan', 'IT', 'IT', 45.46, 9.19], ['Florence', 'IT', 'IT', 43.77, 11.26],
  ['Amsterdam', 'NL', 'NL', 52.37, 4.9], ['Zurich', 'CH', 'CH', 47.38, 8.54], ['Geneva', 'CH', 'CH', 46.2, 6.14], ['Dubai', 'AE', 'AE', 25.2, 55.27], ['Abu Dhabi', 'AE', 'AE', 24.45, 54.38],
  ['Sydney', 'AU', 'AU', -33.87, 151.21], ['Melbourne', 'AU', 'AU', -37.81, 144.96], ['Brisbane', 'AU', 'AU', -27.47, 153.03], ['Perth', 'AU', 'AU', -31.95, 115.86],
  ['Auckland', 'NZ', 'NZ', -36.85, 174.76], ['Tokyo', 'JP', 'JP', 35.68, 139.69], ['Osaka', 'JP', 'JP', 34.69, 135.5],
];

export const placeLabel = c => `${c[0]}, ${c[1]}`;
/** City record from a label like "Austin, TX" (case-insensitive), or null. */
export function findCity(label) {
  const q = String(label || '').trim().toLowerCase();
  return CITIES_LIST.find(c => placeLabel(c).toLowerCase() === q) || null;
}
