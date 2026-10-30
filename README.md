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
| 7 | [Investor and lender pitch](docs/07-Investor-and-Lender-Pitch.md) | 12-slide outline and lender package |
| 8 | [Open questions and assumptions](docs/08-Open-Questions-and-Assumptions.md) | What to verify next, and sources |
| 9 | [Investor structure (GP/LP)](docs/09-Investor-Structure-GP-LP.md) | Fund terms, waterfall, depreciation for investors, securities law |
| — | [Investor pitch deck](https://claude.ai/artifact/C83gJ7W13o543KZXGfyYH5) | 14 designed slides on the management-led plan (private link; share from the deck's Share menu) |
| — | [Financial model (Excel)](financials/Jet_Business_Financial_Model.xlsx) | Startup budget, unit economics, financing scenarios, three growth paths, investor returns |

## Using the model
- **Dashboard:** one-jet economics and the three growth paths side by side (investor multiple, IRR, peak raise, sponsor promote).
- **Assumptions:** every input, with Downside / Base / Upside columns. Switch scenarios in cell **C3**.
- **Fleet Plan:** owned and managed aircraft by year for each growth path (Ownership, Management-led, Hybrid), with the stop-loss applied.
- **Startup Budget:** sources and uses of cash for Jet #1, plus the 2028 operating budget.
- **Unit Economics:** one jet, mature year, plus an hours sensitivity table.
- **Financing Scenarios:** 60-90% LTV compared, plus an hours × LTV grid.
- **Forecast Own / Mgmt / Hybrid:** for each path, a 10-year P&L, cash flow, investor equity, balance sheet, investor tax memo, exit and GP/LP waterfall.
- **Debt Own / Mgmt / Hybrid:** loan amortization, fleet value and any stop-loss sale for each path.

Blue cells are inputs, black cells are formulas, green cells link to other sheets. To rebuild the workbook from code, run `python3 financials/build_model.py`, then recalculate in Excel or LibreOffice.

*All figures are planning estimates as of October 2026 and must be replaced with real quotes before any commitment. This is not legal, tax or investment advice.*
