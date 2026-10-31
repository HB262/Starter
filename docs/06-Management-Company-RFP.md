# EJM term-sheet questions (and backup RFP)

*Draft 2, October 30, 2026, updated with Derek's comments. The plan now puts Jet #1 on **Executive Jet Management's (EJM) Part 135 certificate**. Derek flies today for an operation on EJM's certificate, so he takes these questions to EJM first. Send the same questions to 1-2 other operators (for example Solairus, Clay Lacy, Jet Linx Denver) only as a price check.*

---

## What Derek has already told us about EJM
- EJM provides the Part 135 certificate, OpSpecs, and negotiated fuel and services prices.
- EJM has hangars, A&P mechanics, pilots and admin.
- Its managed jets fly about **95% NetJets customers**, so owners don't have to sell charter.
- EJM makes sure aircraft and pilots meet NetJets' requirements. Both pilots hold full PIC type ratings and attend FlightSafety recurrent every 6 months, at EJM's training rates.
- NetJets can turn off the flow at any time.
- Lately the crews have covered many NetJets Phenom owners, since NetJets now requires at least 5,500 ft of runway in the rain for Phenoms.

## Questions for EJM (in order of importance)

**1. The NetJets rate** *(decides the deal)*
- What does EJM bill NetJets per hour for a Sovereign+? Is fuel included, or reimbursed separately?
- Is positioning paid? Are there daily minimums, overnight or crew fees?
- What share of that rate reaches the owner after EJM's commission?

**2. Hours**
- Actual annual billable hours for EJM-managed midsize jets flying NetJets trips over the last 3 years (range and average).
- How much of recent volume is Phenom wet-runway cover, and how long does EJM expect that to last?
- Will EJM put a projected-hours letter in writing for our aircraft?
- How are trips allocated between owners' aircraft of the same type?

**3. Fit**
- Will NetJets use a Sovereign+ for our trips (cabin height is 5 ft 8 in versus the Latitude's 6 ft)? Any cabin, Wi-Fi or paint standard we must meet?
- Can the aircraft be based at KBJC? Where are EJM's nearest hangars?

**4. Costs**
- Monthly management fee and what it covers.
- Commission on NetJets trips and on retail charter.
- Negotiated fuel price at KBJC and typical trip stops.
- Maintenance labor rate for EJM's A&P mechanics; approval limits for owner spend.
- FlightSafety Sovereign recurrent price at EJM's rates.
- Insurance: can AircraftCo join EJM's fleet policy?
- Sample monthly owner statement for a NetJets-flying jet.

**5. Pilots**
- Can Derek be hired onto EJM's roster and fly our aircraft as captain? Who employs the crew?
- Staffing per aircraft for 600-800 hours a year.

**6. Contract and the future**
- Term, termination notice, audit rights, data ownership.
- If NetJets stops sending trips, what happens to the jet and the fee?
- If we later get our own Part 135 certificate, could aircraft we manage still fly NetJets trips (through EJM or directly)?
- Would EJM accept more aircraft from us later, owned or brought in from other owners, and on what terms?

## Gate 1 pass test
Put EJM's answers into the model (Assumptions: `rate_ovf`, `hours`, `mix`, `mgmt_fee`, `comm`, `fuel`). Proceed only if **cash flow after debt service on the Unit Economics sheet is better than the ($750K) stop-loss threshold**, and ideally positive. In the base case (Guardian Jet costs plus Derek's contingencies) that needs about $12,400 an hour at 600 hours; Henry's $6,000 planning rate fails. If NetJets pays fuel, set `fuel_paid` to 100%.

## Backup operator scorecard (price check only)

| Criterion | Weight | EJM | Op. B | Op. C |
|---|---|---|---|---|
| NetJets volume and rate | 40% | | | |
| Total cost (fee + commission + markups) | 20% | | | |
| Safety ratings and record | 15% | | | |
| Transparency (reporting, audit rights) | 10% | | | |
| Denver/KBJC presence, crew and maintenance support | 15% | | | |
| **Weighted score** | 100% | | | |

Score each criterion 1-5, multiply by its weight, and add them up.
