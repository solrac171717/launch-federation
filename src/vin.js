// Vehicle identification numbers: validate one, and turn the answer of the free US NHTSA decoder into form values.
export const cleanVin = v => String(v || '').toUpperCase().replace(/[\s-]/g, '');
export const isVin = v => /^[A-HJ-NPR-Z0-9]{17}$/.test(cleanVin(v));

const title = s => String(s || '').toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
const TYPE_OF = [[/MOTORCYCLE/, 'motorcycle'], [/TRUCK|BUS/, 'truck'], [/PASSENGER|MULTIPURPOSE/, 'car']];

/** @param r  one entry of NHTSA's DecodeVinValues "Results" */
export function fromNhtsa(r, vin) {
  if (!r || !r.Make) return null;
  const year = /^\d{4}$/.test(r.ModelYear || '') ? r.ModelYear : '';
  const make = title(r.Make), model = String(r.Model || '').trim(), trim = String(r.Trim || '').trim();
  const kind = String(r.VehicleType || '').toUpperCase();
  const type = (TYPE_OF.find(([re]) => re.test(kind)) || [])[1] || null;
  const clean = String(r.ErrorCode || '0').split(',').every(c => ['0', '', '1'].includes(c.trim())); // 1 = check digit mismatch is reported below
  return {
    vin: cleanVin(vin), type, year, make, model, trim,
    name: [year, make, model].filter(Boolean).join(' ').slice(0, 80),
    details: [trim && `Trim ${trim}`, r.BodyClass && String(r.BodyClass), r.DisplacementL && `${Number(r.DisplacementL).toFixed(1)} L`, r.PlantCountry && `Built in ${title(String(r.PlantCountry).replace(/\s*\(.*\)/, ''))}`].filter(Boolean).join(', '),
    checkDigitOk: !/\b1\b/.test(String(r.ErrorCode || '')) && clean,
    partial: !model,
  };
}
