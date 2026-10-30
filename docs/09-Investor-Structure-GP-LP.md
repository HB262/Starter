# Investor structure: GP/LP proposal

*Draft 1, October 30, 2026. Henry will not put in personal capital, so all equity comes from outside investors. This memo proposes a structure for securities counsel and a CPA to refine. It is not legal or tax advice.*

## Recommended structure

```
                 Investors (accredited only)
                          │ Class A units (LP)
                          ▼
  Henry + Chief Pilot ──► Front Range Jet Partners Fund I, LLC  ◄── manager-managed LLC
   (GP entity: "FRJ       │  (taxed as a partnership; issues K-1s)
    Sponsor LLC",         │
    Class B units)        ├──► AircraftCo 1 LLC ── owns Jet #1, borrows the senior loan
                          ├──► AircraftCo 2 LLC ── (later jets, if the plan calls for them)
                          └──► OpCo LLC ────────── own Part 135 certificate, management platform (Phase 2)
```

- **Use an LLC, not a limited partnership.** It works like a GP/LP but is simpler. Investors hold **Class A units**, with limited liability and no management rights. Henry and the Chief Pilot hold **Class B (sponsor) units** through a sponsor LLC that is the manager. **Henry is the general partner (managing member).** **Class B units are split 60% Henry / 40% Chief Pilot** (agreed Oct 30, 2026). The Chief Pilot's 40% vests over 4 years with a 1-year cliff. Acquisition fees go to the sponsor LLC on the same 60/40 basis unless agreed otherwise.
- **Use one fund, not one SPV per jet.** A single vehicle lets investors share in the management platform, which is where most of the exit value sits in two of the three strategies. If later jets need new money, raise it as a follow-on round in Fund I or as a side-car SPV.
- Each jet sits in its **own AircraftCo**, which ring-fences the loan and keeps liability separate.

## Proposed terms (modeled in the spreadsheet)

| Term | Proposal | Why |
|---|---|---|
| Investor capital | All equity. Base: about $4.2M at launch. Peak raise depends on strategy (see below). | Henry contributes no cash |
| Sponsor co-invest | 0% (input on Assumptions) | Sweat equity instead. Investors usually like to see at least some sponsor money, so even 1-2% helps if possible later. |
| Preferred return | 8%, compounding, cumulative | Market-standard for real-asset deals |
| Distribution order | 1) return of capital, 2) 8% pref, 3) split remaining profit **80% investors / 20% sponsor** | Simple; sponsor earns only if investors do well |
| Acquisition fee | 1% of each aircraft's price, paid at closing | Pays for sourcing and deal work |
| Ongoing pay | Chief Pilot is salaried (in crew costs). **Henry takes no salary at the start**; as general partner he earns through the 1% acquisition fee and the promote. Revisit a modest GP fee once the fleet covers its debt. | No separate asset-management fee, which keeps the deal clean and shows investors the GP is aligned |
| Tax allocations | Depreciation losses allocated to Class A pro rata to capital | This is the main tax feature for investors |
| Capital calls | Committed capital drawn as needed, up to a cap; reserve held from day one | The jet needs cash support in early years |
| Investor protections | Investor consent to buy or sell aircraft, add debt, change manager, or raise more capital; quarterly reports; annual audit from year 3 | Builds trust |
| Stop-loss | Written into the operating agreement: sell Jet #1 if trailing-12 cash after debt is worse than ($750K) by mid-2029 | Henry's rule; caps the downside |
| Key person | If the Chief Pilot leaves, investors can vote to replace the manager | Standard |

## What investors get (from the model, base scenario, 2027-2036)

| | Ownership | Management-led | Hybrid |
|---|---|---|---|
| Peak equity to raise | $8.0M | **$8.0M** | $8.0M |
| Investors receive at exit | $4.1M | **$29.6M** | $21.1M |
| Investor multiple, pre-tax | 0.5x | **3.7x** | 2.6x |
| Investor IRR, pre-tax | (7%) | **16%** | 12% |
| Investor IRR after tax, if losses usable | (11%) | **12%** | 8% |
| Sponsor promote (Henry + Derek) | $0 | **$3.5M** | $1.3M |
| of which Henry (60%) / Derek (40%) | $0 / $0 | **$2.1M / $1.4M** | $0.8M / $0.5M |

Upside scenario: 0.8x / 6.3x / 4.5x investor multiples.
Downside scenario: 0.3x / 1.9x / 1.2x.

**Reading it (Draft 4, Sovereign+ with conservative maintenance).** At the placeholder NetJets rate of $6,750 an hour, Jet #1 runs at about ($2.1M) a year after debt, so the stop-loss sells it in mid-2029 in every scenario. All the return then comes from managing other owners' jets, which needs our own certificate, and that step may cost NetJets access. **Don't pitch these returns until EJM's actual NetJets rate is in the model.**

## The depreciation story for investors

- The 2025 tax law made **100% first-year bonus depreciation permanent**, and used aircraft qualify. Jet #1's full price (about $11.5M) can be deducted in the year it enters service, if business use is over 50%. That is the case here, because the jet is 100% charter.
- With 80% debt, that is **about $2.70 of first-year deductions for every $1 of investor equity**. At a 37% tax rate, that could mean about $4.3M of tax savings in 2027 against about $4.2M invested, **if** investors can use the losses.
- **Important limits to tell investors:**
  1. Most investors are **passive**. Passive losses offset only passive income, such as other partnership or rental income. Unused losses carry forward and are released when the investment is sold.
  2. **At-risk rules** may limit losses funded by debt that the investor isn't personally liable for.
  3. The deduction is **recaptured as ordinary income** when the jets are sold. It is a timing benefit, which is why the after-tax multiple is lower than the pre-tax one, while the after-tax IRR is higher.
  4. The aircraft must be placed in service (ready for charter) in the tax year claimed.
- **Best-fit investors:** high-income people with passive income to shelter (real estate, other partnerships), and family offices. Have each investor's own CPA confirm.

## Securities law (must have counsel)

- Selling units is a **securities offering**. Use a **Regulation D** private placement:
  - **Rule 506(b):** no public advertising; accredited investors (plus up to 35 sophisticated non-accredited, which adds disclosure burden). Best for friends-and-network raises.
  - **Rule 506(c):** general solicitation allowed, but every investor must be verified as accredited.
- File **Form D** with the SEC within 15 days of the first sale, plus Colorado and other state notice filings.
- Documents: **Private Placement Memorandum** (business plan, risks, terms), **Operating Agreement**, **Subscription Agreement** with an investor questionnaire.
- Budget about $75K for offering costs (included in the model).
- Do not pay finders who aren't registered broker-dealers.

## Lender implications

Lenders will ask who stands behind the loan. With no wealthy guarantor, an investor-owned AircraftCo is usually treated as an **asset-based** loan, which typically means 60-70% LTV, not 80%. Options:
1. One or two anchor investors provide a guarantee, compensated with extra Class A units or a fee.
2. Accept 65-70% LTV. This needs more equity, but cuts the annual cash burn. See the "Financing Scenarios" sheet.
3. Use a seller-financed or mezzanine second piece.

## Next steps

1. ~~Pick a strategy.~~ Done: management-led (Oct 30, 2026). Size the raise at about $4.2M at launch with commitments up to about $8.0M (base).
2. Engage securities counsel to draft the PPM and operating agreement.
3. Build a target list of 15-25 accredited investors, with $250K minimum tickets.
4. Talk to lenders about guarantor requirements early. This decides the LTV.
