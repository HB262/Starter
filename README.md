# Jet overflow charter business: plan and model

A business plan for buying a used Cessna Citation Latitude, basing it at Rocky Mountain Metropolitan Airport (KBJC), and flying it on a management company's Part 135 certificate as overflow lift for NetJets and other fractional programs. It also covers growing to an own-certificate fleet and exiting.

| # | Document | Use it for |
|---|---|---|
| 1 | [One-page summary](docs/01-One-Page-Summary.md) | The whole plan on one page |
| 2 | [Business plan](docs/02-Business-Plan.md) | Full plan: market, operations, financing, projections, exit |
| 3 | [Roadmap: startup to exit](docs/03-Roadmap-Startup-to-Exit.md) | Dated actions, owners and go/no-go gates |
| 4 | [Launch checklist](docs/04-Launch-Checklist.md) | Filings, contracts, insurance, FAA/DOT/TSA/IRS items |
| 5 | [Risk register](docs/05-Risk-Register.md) | Risks, early warnings, mitigations |
| 6 | [Management company RFP](docs/06-Management-Company-RFP.md) | Questions to send operators, plus a scorecard |
| 7 | [Investor and lender pitch](docs/07-Investor-and-Lender-Pitch.md) | 10-slide outline and lender package |
| 8 | [Open questions and assumptions](docs/08-Open-Questions-and-Assumptions.md) | What to verify next, and sources |
| — | [Financial model (Excel)](financials/Jet_Business_Financial_Model.xlsx) | Startup budget, unit economics, financing scenarios, 10-year forecast, exit |

## Using the model
- **Dashboard:** headline numbers.
- **Assumptions:** every input, with Downside / Base / Upside columns. Switch scenarios in cell **C3**.
- **Fleet Plan:** owned and managed aircraft by year for each scenario.
- **Startup Budget:** sources and uses of cash for Jet #1, plus the 2028 operating budget.
- **Unit Economics:** one jet, mature year, plus an hours sensitivity table.
- **Financing Scenarios:** 60-90% LTV compared, plus an hours × LTV grid.
- **Forecast:** 10-year P&L, cash flow, owner equity, balance sheet and tax memo.
- **Debt Schedule** and **Exit:** loan amortization, fleet value, exit proceeds, multiple on equity and IRR.

Blue cells are inputs, black cells are formulas, green cells link to other sheets. To rebuild the workbook from code, run `python3 financials/build_model.py`, then recalculate in Excel or LibreOffice.

*All figures are planning estimates as of October 2026 and must be replaced with real quotes before any commitment. This is not legal, tax or investment advice.*
