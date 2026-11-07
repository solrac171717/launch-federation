// /guides/rental-portfolio-ltv-calculator. No lender limit is quoted: thresholds depend on the lender and the loan, and the pages we could read do not state them.
import { c, priceTable, priceText, trialFaq } from './solutions-shared.mjs';

// The calculator is plain HTML plus a few lines of script. It uses no libraries and sends nothing anywhere.
const calculator = `<div class="calc" id="ltv-calc">
<table><thead><tr><th>Property</th><th>Value ($)</th><th>Loan balance ($)</th><th>LTV</th></tr></thead><tbody>
${[540000, 265000, 400000, 85000, ''].map((v, i) => `<tr><td>Property ${i + 1}</td><td><input type="number" min="0" step="1000" inputmode="numeric" class="ltv-v" value="${v}" aria-label="Value of property ${i + 1}"></td><td><input type="number" min="0" step="1000" inputmode="numeric" class="ltv-d" value="${[290000, 175000, 200000, 0, ''][i]}" aria-label="Loan balance of property ${i + 1}"></td><td class="ltv-r">&ndash;</td></tr>`).join('')}
</tbody></table>
<p id="ltv-out" aria-live="polite"><strong>Enter at least one value.</strong></p>
</div>
<script>
(function () {
  var root = document.getElementById('ltv-calc'); if (!root) return;
  var vs = root.querySelectorAll('.ltv-v'), ds = root.querySelectorAll('.ltv-d'), rs = root.querySelectorAll('.ltv-r'), out = document.getElementById('ltv-out');
  var money = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
  function calc() {
    var tv = 0, td = 0, sum = 0, n = 0;
    for (var i = 0; i < vs.length; i++) {
      var v = parseFloat(vs[i].value) || 0, d = parseFloat(ds[i].value) || 0;
      if (v > 0) { rs[i].textContent = (d / v * 100).toFixed(1) + '%'; tv += v; td += d; sum += d / v * 100; n++; } else { rs[i].textContent = '\\u2013'; }
    }
    if (!tv) { out.innerHTML = '<strong>Enter at least one value.</strong>'; return; }
    out.innerHTML = '<strong>Portfolio LTV: ' + (td / tv * 100).toFixed(1) + '%</strong> &middot; value ' + money(tv) + ' &middot; loans ' + money(td) + ' &middot; equity ' + money(tv - td) + '<br>Simple average of the rows: ' + (sum / n).toFixed(1) + '% (the wrong way to do it when the properties differ in size).';
  }
  root.addEventListener('input', calc); calc();
})();
</script>`;

export const LTV = {
  slug: 'rental-portfolio-ltv-calculator',
  dir: 'guides',
  date: '2026-11-07',
  kind: 'guide',
  crumb: 'Rental portfolio LTV calculator',
  title: 'Rental Portfolio LTV Calculator: Formula and Worked Example',
  description: 'A rental portfolio LTV calculator for all your properties at once: the formula, why averaging percentages is wrong, a stress test and a worked example.',
  h1: 'Rental portfolio LTV calculator: one loan-to-value for all your properties',
  primary: 'rental portfolio ltv calculator',
  about: ['Loan-to-value ratio', 'Rental property', 'Real estate portfolio'],
  takeaways: [
    "Portfolio loan-to-value is total loan balances divided by total values. It is not the average of each property's percentage, which can be badly wrong.",
    'The calculator below does it for up to five properties in your browser. Nothing is sent or stored.',
    'The value you enter drives the answer. A 7% lower value moves a 59.5% loan-to-value to 64.0%, so say where your value comes from.',
    'A portfolio figure hides weak spots. Look at each property too, and test what a 10% fall in values does to the worst one.',
  ],
  lead: 'A rental portfolio LTV calculator answers a question lenders and careful owners both ask: how much of everything I own is financed? Loan-to-value is simple for one property, loan divided by value. For a portfolio it is easy to get wrong, because the average of several percentages is not the portfolio&rsquo;s percentage. This guide gives you a working calculator, the formula, a worked example with four properties, a stress test for a fall in values, and the way to read the result without fooling yourself.',
  toc: [['verdict', 'The short answer'], ['formula', 'The formula'], ['calculator', 'The calculator'], ['example', 'A worked example: four properties'], ['average', 'Why the average is wrong'], ['value', 'The value you use changes the answer'], ['stress', 'A stress test: values fall 10%'], ['headroom', 'Headroom to a target, and why pooling hides problems'], ['shares', 'Your share of co-owned properties'], ['beyond', 'What loan-to-value does not tell you'], ['mistakes', 'Six common mistakes'], ['ownedmap', 'Keeping it current in Owned Map'], ['price', 'Price and who it is for'], ['method', 'How we checked'], ['sources', 'Sources']],
  sections: [
    { id: 'verdict', h2: 'The short answer', html: `<ul><li><strong>Portfolio LTV = total loan balances &divide; total values.</strong> Add the balances, add the values, divide once.</li><li><strong>Never average the percentages.</strong> A $85,000 plot with no loan and a $540,000 duplex with a large one do not weigh the same.</li><li><strong>State where each value comes from.</strong> The result is only as good as the values.</li><li><strong>Check each property as well.</strong> The portfolio can look comfortable while one property is stretched.</li></ul>
<p>This page explains the arithmetic. It does not tell you what loan-to-value a lender will accept: that depends on the lender, the loan and the property, so ask yours.</p>` },
    { id: 'formula', h2: 'The formula', html: `<p>For one property, loan-to-value is the loan balance divided by the property&rsquo;s value, written as a percentage. A $250,000 loan on a $420,000 property is 250,000 &divide; 420,000 = 59.5%.</p>
<p>Both inputs should be current. The loan balance comes from the lender&rsquo;s latest statement, and REtipster lists the current balance, interest rate, payment and maturity date among the loan details an investor keeps for each property.${c(34)} PropertyMetrics lists the loan balance, interest rate, recourse, maturity and lender as separate fields in its template.${c(35)} The value is the harder part, and we come to it below.</p>
<p>For a portfolio, add all the balances and all the values, then divide. Equity is the difference: total value minus total loans. If values are $1,290,000 and loans are $665,000, loan-to-value is 51.6% and equity is $625,000.</p>
<p>Loan-to-value and yield measure different things. Yield compares income with value; loan-to-value compares debt with value. A property can have a strong yield and a high loan-to-value, which is the combination that hurts when rents or values fall. Net operating income divided by <em>current</em> value is the capitalization rate,${c(5)} and our guide to the <a href="/solutions/rental-property-portfolio-tracker">rental property portfolio tracker</a> defines every number side by side.</p>` },
    { id: 'calculator', h2: 'The calculator', html: `<p>Enter the value and the loan balance of each property. Leave unused rows empty. The figures below are the example in this guide; change them to your own. The calculation happens in your browser, and nothing is sent or stored.</p>${calculator}` },
    { id: 'example', h2: 'A worked example: four properties', html: `<table><thead><tr><th></th><th>Duplex</th><th>Condo</th><th>House</th><th>Land</th></tr></thead><tbody>
<tr><td>Value</td><td>$540,000</td><td>$265,000</td><td>$400,000</td><td>$85,000</td></tr>
<tr><td>Loan balance</td><td>$290,000</td><td>$175,000</td><td>$200,000</td><td>none</td></tr>
<tr><td>Loan-to-value</td><td>53.7%</td><td>66.0%</td><td>50.0%</td><td>0%</td></tr>
<tr><td>Equity</td><td>$250,000</td><td>$90,000</td><td>$200,000</td><td>$85,000</td></tr></tbody></table>
<p>Totals: value <strong>$1,290,000</strong>, loans <strong>$665,000</strong>, equity <strong>$625,000</strong>. Portfolio loan-to-value: 665,000 &divide; 1,290,000 = <strong>51.6%</strong>.</p>` },
    { id: 'average', h2: 'Why the average is wrong', html: `<p>Take the four percentages in the table: 53.7%, 66.0%, 50.0% and 0%. Their simple average is <strong>42.4%</strong>. The real portfolio figure is <strong>51.6%</strong>, nine points higher. The average treats the $85,000 plot, which has no loan, as if it were as big as the $540,000 duplex, and pulls the answer down.</p>
<p>Leave the land out and average the three financed properties and you get 56.6%, which is now too high, because it treats the $265,000 condo, the most leveraged, as equal to the $540,000 duplex. Only the weighted figure, total loans over total values, is right. Add any new property to the table and it stays right.</p>
<p>The calculator above shows both numbers so you can see the gap on your own portfolio. The more the properties differ in size, the bigger the gap.</p>` },
    { id: 'value', h2: 'The value you use changes the answer', html: `<p>Loan-to-value is a ratio, and the denominator is an opinion. The same $250,000 loan on a property worth $420,000 is 59.5%. If the true value is 7% lower, $390,600, it is 64.0%. Zillow publishes a median error of about 7% for its automated estimate on off-market homes, and wider in some places.${c(13)} Quicken, which uses Zillow values, says in its own help page that Zillow provides estimated market values, not professional appraisals.${c(33)}</p>
<p>REtipster&rsquo;s advice for a schedule of real estate owned is to use the latest appraisal and record the date of that appraisal.${c(34)} A good routine for your own tracking:</p>
<ol><li>Use an appraisal or a broker&rsquo;s opinion where you have a recent one.</li><li>Otherwise use your best estimate and write down how you made it.</li><li>Compute the loan-to-value at your value and again at 7% lower. If both are comfortable, the exact value matters less.</li></ol>` },
    { id: 'stress', h2: 'A stress test: values fall 10%', html: `<p>A single number tells you today&rsquo;s position. A stress test tells you how much room you have. Cut every value by 10% and keep the loans as they are:</p>
<table><thead><tr><th></th><th>Today</th><th>Values down 10%</th></tr></thead><tbody>
<tr><td>Portfolio value</td><td>$1,290,000</td><td>$1,161,000</td></tr>
<tr><td>Loans</td><td>$665,000</td><td>$665,000</td></tr>
<tr><td>Equity</td><td>$625,000</td><td>$496,000</td></tr>
<tr><td>Portfolio loan-to-value</td><td>51.6%</td><td>57.3%</td></tr>
<tr><td>Condo loan-to-value</td><td>66.0%</td><td>73.4%</td></tr></tbody></table>
<p>The portfolio moves from 51.6% to 57.3%, which looks manageable. The condo moves from 66.0% to 73.4%, and that is the property that was already the weakest. Equity falls by $129,000, a tenth of the portfolio&rsquo;s value, because the loans do not fall with the values.</p>
<p>The loan balance falls only as you repay principal. The IRS tells US rental owners that mortgage principal payments cannot simply be deducted,${c(6)} which is a reminder that principal reduces your debt without showing up as a cost: it builds equity but not cash flow.</p>` },
    { id: 'headroom', h2: 'Headroom to a target, and why pooling hides problems', html: `<p>Some owners set themselves a ceiling, say 60% across the portfolio, and ask how much room there is below it. The arithmetic is target &times; value &minus; loans. It is an example of your own limit, not a lender&rsquo;s rule.</p>
<table><thead><tr><th></th><th>Duplex</th><th>Condo</th><th>House</th><th>Land</th><th>Portfolio</th></tr></thead><tbody>
<tr><td>60% of value</td><td>$324,000</td><td>$159,000</td><td>$240,000</td><td>$51,000</td><td>$774,000</td></tr>
<tr><td>Minus loans</td><td>$290,000</td><td>$175,000</td><td>$200,000</td><td>$0</td><td>$665,000</td></tr>
<tr><td>Headroom</td><td>$34,000</td><td>&minus;$16,000</td><td>$40,000</td><td>$51,000</td><td>$109,000</td></tr></tbody></table>
<p>Pooled, the portfolio has $109,000 of headroom. Property by property, the condo is already $16,000 over the same ceiling, and most of the room sits on the plot of land. Lenders look at a particular property as well as at the whole, so read both the pooled figure and the line for each property before you rely on either.</p>` },
    { id: 'shares', h2: 'Your share of co-owned properties', html: `<p>If you hold part of a property, the question is whether you are measuring the property or your stake. Both are valid; mix them and you get nonsense. In the example, the house is owned 40% with a partner. Counting it whole, the portfolio is $1,290,000 of value against $665,000 of loans. On your share, the house contributes $160,000 of value and $80,000 of debt, so the portfolio is $1,050,000 against $545,000, a loan-to-value of 51.9% and equity of $505,000.</p>
<p>The percentage barely changes here because the house sits near the portfolio average. For a property far from the average, it moves more. PropertyMetrics treats ownership percentage and each party&rsquo;s share of the loan balance as separate fields,${c(35)} which is the right instinct: record both, and label which one a total uses.</p>` },
    { id: 'beyond', h2: 'What loan-to-value does not tell you', html: `<ul><li><strong>Whether you can afford the loan.</strong> That is a question about income against payments, often shown as a debt service coverage ratio. PropertyMetrics lists it among its per-loan fields.${c(35)} Loan-to-value says nothing about it.</li><li><strong>When the loan ends.</strong> A property at 50% with a balloon due next year is riskier than one at 65% with 25 years to run. Keep the maturity date next to the figure.</li><li><strong>The interest rate.</strong> Two loans of the same size can cost very different amounts.</li><li><strong>What you would keep if you sold.</strong> Selling costs and tax come out of the equity.</li></ul>
<p>Treat loan-to-value as one of four numbers: how much is financed, whether the income covers the payments, when the debt falls due and what it costs.</p>` },
    { id: 'mistakes', h2: 'Six common mistakes', html: `<ol><li><strong>Averaging the percentages.</strong> Covered above; it understates or overstates the real figure depending on which properties are large.</li><li><strong>Using the original loan amount.</strong> The balance falls as you repay. Use the figure on the latest statement, as REtipster's list of loan details implies by asking for the current balance.${c(34)}</li><li><strong>Leaving out a loan.</strong> A second mortgage, a line of credit secured on the property or a private loan from a relative all count. If it is secured against the property, it belongs in the numerator.</li><li><strong>Counting land and buildings under different rules.</strong> A plot with no loan is still part of the portfolio's value. Include it, and say so, or leave it out and say so.</li><li><strong>Mixing whole-property and share figures.</strong> One column should be one basis. Label it.</li><li><strong>Comparing a value from this year with a loan from last year.</strong> Date both. A schedule of values from March and balances from September is not a ratio, it is two snapshots.</li></ol>
<p>The fix for all six is the same: keep one row per property, with the value, its source and date, the balance, its date, and your ownership percentage, and compute the totals from the rows rather than typing them in.</p>` },
    { id: 'ownedmap', h2: 'Keeping it current in Owned Map', html: `<p>A calculator answers the question once. Owned Map answers it every time you open it. Each property holds its value, loan balance, loan payment and your ownership share, and the app shows loan-to-value and equity per asset and for the whole portfolio, projects the loan down over the years, and simulates what a sale would leave after costs and tax. It can also set a concentration limit and flag when one asset or category exceeds it.</p>
<p>It will not tell you what a lender will accept, and it does not connect to your lender or your bank. You enter the loan balance and update it when a statement arrives. If a lender asks for a list of your properties, our <a href="/guides/schedule-of-real-estate-owned-template">schedule of real estate owned template</a> has the columns they ask for, including loan-to-value.</p>` },
    { id: 'price', h2: 'Price and who it is for', html: `<p>The calculator on this page is free. Owned Map starts where the one-off calculation stops. ${priceText}</p>${priceTable}
<p>It makes sense from about the fourth property, or sooner if you share ownership. For two properties, this page and a spreadsheet are enough.</p>` },
    { id: 'method', h2: 'How we checked', html: `<p>We wrote this page on November 7, 2026. The arithmetic is ours and every figure in the tables is reproducible with the calculator above. What we say about the loan details a schedule includes comes from REtipster and PropertyMetrics; what we say about Zillow values comes from Zillow&rsquo;s published error figure as reported to us in search results, and from Quicken&rsquo;s help page. We tried to read a lender guideline page and a consumer-finance definition of loan-to-value, and they did not load, so we quote no lender limits.</p>
<p>Every outside claim is numbered and listed under Sources below. If you spot something out of date, email <a href="mailto:support@ownedmap.com">support@ownedmap.com</a> and we will correct it. This page is general information, not lending advice.</p>` },
  ],
  faq: [
    ['How do you calculate loan-to-value for a rental portfolio?', 'Add all the loan balances, add all the property values and divide the first by the second. Do not average the individual percentages.'],
    ['Why is the average of my LTVs different from the portfolio LTV?', 'Because properties differ in size. The average gives a small property the same weight as a large one. The total loans over total values weights each by its value.'],
    ['Which value should I use?', 'The latest appraisal if you have one, with its date. Otherwise a broker’s opinion or your own estimate, labelled as such. Run the figure again with a value 7% lower to see how sensitive it is.'],
    ['What is a good portfolio LTV?', 'It depends on the lender, the loan and the property, so ask yours. This page explains the arithmetic and does not state lender limits.'],
    ['Should I count co-owned properties in full?', 'Either is valid if you label it. Counting the whole property measures the property; counting your percentage measures your stake. Do not mix them in one total.'],
    ['Does the calculator store my numbers?', 'No. It runs in your browser and nothing is sent or saved.'],
    ['Does Owned Map show loan-to-value?', 'Yes, for each asset and for the portfolio, together with equity, yield, cash flow and a sale simulation. It does not connect to your lender; you enter the balance.'],
    trialFaq,
  ],
  sources: [],
};
