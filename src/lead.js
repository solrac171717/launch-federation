// Early-access lead validation, shared by the browser form and the API so the rules can't drift.
export const PORTFOLIO_SIZES = {
  'under-1m': 'Under $1M',
  '1m-5m': '$1M – $5M',
  '5m-25m': '$5M – $25M',
  '25m-100m': '$25M – $100M',
  'over-100m': 'Over $100M',
};
export const ASSET_TYPES = {
  residential: 'Residential real estate',
  commercial: 'Commercial real estate',
  land: 'Land',
  vehicles: 'Vehicles',
  vessels: 'Boats & yachts',
  aircraft: 'Aircraft',
  equipment: 'Equipment',
};
export const INVESTOR_TYPES = {
  individual: 'Individual investor',
  'family-office': 'Family office',
  manager: 'Professional asset manager',
  other: 'Other',
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** @returns {{ok: boolean, errors: Record<string,string>, value: object|null}} */
export function validateLead(raw = {}) {
  const errors = {};
  const email = String(raw.email ?? '').trim().toLowerCase();
  const firstName = String(raw.firstName ?? '').trim().replace(/\s+/g, ' ');
  const portfolioSize = String(raw.portfolioSize ?? '');
  const assetTypes = [].concat(raw.assetTypes ?? []).map(String);
  const investorType = String(raw.investorType ?? '');

  if (!EMAIL.test(email) || email.length > 254) errors.email = 'Enter a valid email address.';
  if (!firstName) errors.firstName = 'Enter your first name.';
  else if (firstName.length > 80) errors.firstName = 'First name is too long.';
  if (!(portfolioSize in PORTFOLIO_SIZES)) errors.portfolioSize = 'Choose a portfolio size range.';
  if (assetTypes.length === 0) errors.assetTypes = 'Select at least one asset category.';
  else if (!assetTypes.every(t => t in ASSET_TYPES)) errors.assetTypes = 'Unknown asset category.';
  if (investorType && !(investorType in INVESTOR_TYPES)) errors.investorType = 'Unknown investor type.';
  if (raw.consent !== true && raw.consent !== 'on' && raw.consent !== 'true') errors.consent = 'Please confirm you agree to be contacted.';

  const ok = Object.keys(errors).length === 0;
  return {
    ok, errors,
    value: ok ? {
      email, first_name: firstName, portfolio_size: portfolioSize,
      asset_types: [...new Set(assetTypes)], investor_type: investorType || null,
    } : null,
  };
}
