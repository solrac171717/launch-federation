// What a user can track in Owned Map. Each type maps to a category (used by the map filters and reports)
// and to the 3D illustration shown for it.
export const CATEGORIES = {
  residential: 'Residential',
  commercial: 'Commercial',
  land: 'Land',
  vehicle: 'Vehicles',
  vessel: 'Vessels',
  aircraft: 'Aircraft',
  equipment: 'Equipment',
};

export const ASSET_TYPES = [
  { key: 'house', label: 'House or apartment', category: 'residential', img: 'house', statuses: ['Occupied', 'Vacant', 'Leased', 'Held'] },
  { key: 'office', label: 'Office or retail', category: 'commercial', img: 'commercial', statuses: ['Leased', 'Vacant', 'Held'] },
  { key: 'warehouse', label: 'Warehouse or industrial', category: 'commercial', img: 'industrial', statuses: ['Leased', 'Vacant', 'Held'] },
  { key: 'parking', label: 'Parking space', category: 'commercial', img: 'parking', statuses: ['Leased', 'Vacant', 'Held'] },
  { key: 'land', label: 'Land', category: 'land', img: 'land', statuses: ['Held', 'Leased'] },
  { key: 'car', label: 'Car', category: 'vehicle', img: 'porsche', statuses: ['Garaged', 'In service'] },
  { key: 'truck', label: 'Truck', category: 'vehicle', img: 'truck', statuses: ['In service', 'Garaged'] },
  { key: 'motorcycle', label: 'Motorcycle', category: 'vehicle', img: 'moto', statuses: ['Garaged', 'In service'] },
  { key: 'rv', label: 'Motorhome or RV', category: 'vehicle', img: 'rv', statuses: ['Garaged', 'In service'] },
  { key: 'yacht', label: 'Yacht or motorboat', category: 'vessel', img: 'yacht', statuses: ['Moored', 'In service', 'Stored'] },
  { key: 'sailboat', label: 'Sailboat', category: 'vessel', img: 'sail', statuses: ['Moored', 'In service', 'Stored'] },
  { key: 'jetski', label: 'Jet ski', category: 'vessel', img: 'jetski', statuses: ['Stored', 'In service'] },
  { key: 'aircraft', label: 'Aircraft', category: 'aircraft', img: 'jet', statuses: ['Hangared', 'In service'] },
  { key: 'equipment', label: 'Heavy equipment', category: 'equipment', img: 'excavator', statuses: ['In service', 'Stored'] },
];
export const TYPE_BY_KEY = Object.fromEntries(ASSET_TYPES.map(t => [t.key, t]));

// Every status the product knows, with the tone used for its dot.
export const STATUS_TONE = { Occupied: 'ok', Leased: 'ok', 'In service': 'ok', Vacant: 'warn' };
export const ALL_STATUSES = [...new Set(ASSET_TYPES.flatMap(t => t.statuses))];
