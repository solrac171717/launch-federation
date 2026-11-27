// Owned Map agency page: sticky header, FAQ, and the monthly / yearly switch (30% off when paid for the year).
const OFF = 0.30;
const eur = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' }).format(Math.round(n));

const header = document.querySelector('.site-header');
if (header) { const on = () => header.classList.toggle('scrolled', scrollY > 8); addEventListener('scroll', on, { passive: true }); on(); }

const items = [...document.querySelectorAll('[data-faq]')];
for (const item of items) {
  const btn = item.querySelector('.faq-q');
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    for (const o of items) { const b = o.querySelector('.faq-q'), on = o === item && open; b.setAttribute('aria-expanded', String(on)); o.classList.toggle('open', on); }
  });
}
document.documentElement.classList.add('js');

const buttons = [...document.querySelectorAll('.ag-per-b')];
const paint = per => {
  for (const b of buttons) { const on = b.dataset.per === per; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }
  for (const plan of document.querySelectorAll('.ag-plan')) {
    const month = Number(plan.dataset.month), price = plan.querySelector('[data-price]'), bill = plan.querySelector('[data-bill]');
    if (per === 'year') {
      const perMonth = month * (1 - OFF);
      price.textContent = eur(perMonth); bill.textContent = `${eur(perMonth * 12)} al año, pagados por adelantado (antes ${eur(month * 12)})`;
    } else { price.textContent = eur(month); bill.textContent = 'Facturación mensual'; }
  }
};
for (const b of buttons) b.addEventListener('click', () => paint(b.dataset.per));
