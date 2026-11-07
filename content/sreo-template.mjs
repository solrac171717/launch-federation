// The free download behind /guides/schedule-of-real-estate-owned-template.
// Columns follow what the REtipster guide lists for an SREO (name, type, units, acquisition date, address, entity holding the deed, ownership %,
// market value and its appraisal date, original loan amount and date, current balance, rate, payment, maturity, lender, occupancy, NOI) plus a derived LTV.
export const SREO_HEADERS = ['Property', 'Property type', 'Units', 'Address', 'Acquired on', 'Title held by (entity)', 'Your ownership %', 'Market value', 'Value source and date',
  'Original loan amount', 'Original loan date', 'Current loan balance', 'Interest rate %', 'Monthly payment', 'Loan maturity date', 'Lender', 'Occupancy %', 'Annual rent', 'Annual expenses', 'Annual NOI', 'Loan-to-value %'];

export const SREO_CSV = [SREO_HEADERS.join(','),
  'Maple Street Duplex,Duplex,2,"412 Maple St, Columbus, OH",2021-04-12,Maple Holdings LLC,100,540000,"Appraisal 2026-03-10",350000,2021-04-12,290000,4.25,1980,2051-04-01,Example Bank,100,48000,15600,=R2-S2,=L2/H2*100',
  'Harbor Condo,Condo,1,"88 Harbor Way, Tampa, FL",2022-09-30,Me,100,265000,"Broker estimate 2026-09-01",192000,2022-09-30,175000,5.1,1150,2052-10-01,Example Bank,100,21000,9800,=R3-S3,=L3/H3*100'].join('\n') + '\n';
