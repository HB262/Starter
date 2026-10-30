"""Builds Jet_Business_Financial_Model.xlsx.

Run:  python3 financials/build_model.py
Every number in the workbook is either a labeled input on the Assumptions /
Fleet Plan sheets (blue text) or a formula that flows from them.
"""
from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

OUT = "financials/Jet_Business_Financial_Model.xlsx"
YEARS = list(range(2027, 2037))
FIRST_COL = 3  # column C holds the first forecast year
YCOLS = [get_column_letter(FIRST_COL + i) for i in range(len(YEARS))]
LASTY = YCOLS[-1]
MAX_SLOTS = 7  # owned-aircraft slots in the debt schedule

FONT = "Arial"
BLUE = Font(name=FONT, size=10, color="0000FF")
BLACK = Font(name=FONT, size=10, color="000000")
GREEN = Font(name=FONT, size=10, color="008000")
BOLD = Font(name=FONT, size=10, bold=True)
TITLE = Font(name=FONT, size=14, bold=True, color="1F3864")
SUB = Font(name=FONT, size=10, italic=True, color="595959")
HDR_FONT = Font(name=FONT, size=10, bold=True, color="FFFFFF")
HDR_FILL = PatternFill("solid", fgColor="1F3864")
SEC_FILL = PatternFill("solid", fgColor="D9E1F2")
KEY_FILL = PatternFill("solid", fgColor="FFFF00")
TOP = Border(top=Side(style="thin", color="000000"))

USD = '$#,##0;($#,##0);"-"'
USD_K = '$#,##0,"K";($#,##0,"K");"-"'
NUM = '#,##0;(#,##0);"-"'
NUM1 = '#,##0.0;(#,##0.0);"-"'
PCT = '0.0%;(0.0%);"-"'
MULT = '0.0"x"'
YEAR = "0"

wb = Workbook()


def setup(ws, title, subtitle, widths):
    ws["A1"] = title
    ws["A1"].font = TITLE
    ws["A2"] = subtitle
    ws["A2"].font = SUB
    for col, w in widths.items():
        ws.column_dimensions[col].width = w
    ws.sheet_view.showGridLines = False


def header(ws, row, values, start_col=1):
    for i, v in enumerate(values):
        c = ws.cell(row=row, column=start_col + i, value=v)
        c.font = HDR_FONT
        c.fill = HDR_FILL
        c.alignment = Alignment(horizontal="center" if i else "left", wrap_text=True)


def section(ws, row, text, ncols):
    for col in range(1, ncols + 1):
        ws.cell(row=row, column=col).fill = SEC_FILL
    ws.cell(row=row, column=1, value=text).font = BOLD


def put(ws, ref, value, fmt=None, font=None, fill=None, bold=False):
    c = ws[ref]
    c.value = value
    if font is None:
        if isinstance(value, str) and value.startswith("="):
            font = GREEN if "!" in value else BLACK
        else:
            font = BLUE
    if bold:
        font = Font(name=font.name, size=font.size, color=font.color, bold=True)
    c.font = font
    if fmt:
        c.number_format = fmt
    if fill:
        c.fill = fill
    return c


# ---------------------------------------------------------------- Assumptions
A = wb.active
A.title = "Assumptions"
setup(A, "Assumptions: Citation Latitude overflow charter business",
      "Blue = input you can change. Yellow = key lever. Column F (Live) feeds the forecast "
      "based on the scenario selected in C3.",
      {"A": 52, "B": 12, "C": 14, "D": 14, "E": 14, "F": 14, "G": 90})
A["A3"] = "Active scenario (1 = Downside, 2 = Base, 3 = Upside)"
A["A3"].font = BOLD
put(A, "C3", 2, fill=KEY_FILL)
put(A, "D3", '=INDEX({"Downside","Base","Upside"},$C$3)')
header(A, 5, ["Assumption", "Unit", "Downside", "Base", "Upside", "Live", "Source / note"])

# (key, label, unit, down, base, up, fmt, note, key_lever)
ASSUMPTIONS = [
    ("SEC", "Aircraft acquisition (per aircraft)"),
    ("price", "Purchase price, used Citation Latitude (2016-2019)", "$", 15_000_000, 13_500_000, 12_500_000, USD,
     "AvBuyer/Aircraft Bluebook guide: 2020 Latitude ~$17.5M (May 2025), asking range $18.75-22.5M for newer units. "
     "Older 2016-2019 units assumed lower. VERIFY with a broker/JETNET before LOI.", True),
    ("price_chg", "Annual change in price paid for later aircraft", "%", 0.0, 0.0, 0.0, PCT,
     "Assumes later purchases are similar-vintage aircraft at today's price. Adjust if the market moves.", False),
    ("prebuy", "Pre-buy inspection (Textron service center)", "$", 85_000, 75_000, 60_000, USD,
     "Estimate; includes ferry to inspection facility and borescope.", False),
    ("legal", "Closing legal, escrow, title, registration", "$", 60_000, 50_000, 40_000, USD, "Estimate.", False),
    ("onboard", "Part 135 onboarding, conformity, Wi-Fi/avionics updates", "$", 200_000, 150_000, 100_000, USD,
     "Adding aircraft to operator's certificate (conformity, manuals, OpSpecs), plus connectivity charter "
     "customers expect. Estimate.", False),
    ("refurb", "Cosmetic interior / paint refresh", "$", 350_000, 250_000, 150_000, USD,
     "Fractional customers expect fleet-standard cabins. Estimate.", False),
    ("init_train", "Initial crew training and hiring (per aircraft)", "$", 100_000, 75_000, 50_000, USD,
     "Type rating for new hires (CE-680A) and Part 135 initial. Estimate.", False),
    ("entity", "Company formation, legal, accounting, insurance setup (once)", "$", 75_000, 50_000, 35_000, USD,
     "LLC formation, operating agreement, aviation counsel, CPA, insurance broker. Estimate.", False),
    ("SEC", "Financing"),
    ("ltv", "Loan-to-value (debt share of purchase price)", "%", 0.80, 0.80, 0.80, PCT,
     "Henry: assume at least 80% debt. See 'Financing Scenarios' for 60-90%.", True),
    ("rate", "Interest rate (fixed)", "%", 0.0800, 0.0725, 0.0675, PCT,
     "Advertised jet loan rates ~5.6-9% (Sep/Oct 2026 rate sheets); prime 7.00% (Oct 2026). flycraft.com/aircraft-financing/aircraft-loan-rates", False),
    ("amort", "Amortization period", "years", 15, 15, 20, NUM,
     "Typical 10-20 yr amortization, often with a 5-7 yr balloon refinanced at the time. Model assumes refinance on same terms.", False),
    ("SEC", "Charter revenue (per owned aircraft)"),
    ("hours", "Billable revenue hours per aircraft at maturity", "hrs/yr", 500, 600, 700, NUM,
     "Includes billable repositioning. Dedicated fractional supplemental lift can run 800+ hrs; retail-only charter often 300-450.", True),
    ("months_y1", "Months in revenue service in 2027", "months", 5, 6, 6, NUM,
     "Henry: target revenue flying mid-2027.", False),
    ("ramp1", "Utilization in first year of service (% of mature)", "%", 0.50, 0.60, 0.70, PCT,
     "Ramp while operator builds the aircraft into its overflow rotation.", False),
    ("ramp2", "Utilization in second year (% of mature)", "%", 0.80, 0.90, 1.00, PCT, "", False),
    ("mix", "Share of hours flown as fractional / program overflow", "%", 0.40, 0.50, 0.60, PCT,
     "NetJets, Flexjet, jet card and membership programs. The rest is broker/retail charter.", True),
    ("rate_ovf", "Wholesale rate, overflow / subcontract trips", "$/hr", 6_750, 7_000, 7_250, USD,
     "Wholesale is below retail. NetJets' own midsize lift program retails $8,000-10,900/hr (SherpaReport). Estimate; "
     "get actual subcontract rates from the management company.", True),
    ("rate_ret", "Retail / broker charter rate", "$/hr", 8_000, 8_500, 9_000, USD,
     "Excludes 7.5% federal excise tax (collected from the customer and remitted). Estimate.", True),
    ("rate_g", "Annual charter rate growth", "%", 0.020, 0.030, 0.035, PCT, "", False),
    ("ferry", "Unpaid positioning hours (% of billable)", "%", 0.15, 0.10, 0.08, PCT,
     "Denver base means some empty legs to the coasts. Estimate.", False),
    ("SEC", "Variable operating costs (per flight hour)"),
    ("gph", "Fuel burn", "gal/hr", 285, 270, 260, NUM,
     "Flycraft cites 315 gal/hr block (conservative); typical mission average lower.", False),
    ("fuel", "Jet-A price (contract/volume pricing)", "$/gal", 7.00, 6.50, 6.00, '$#,##0.00',
     "Flycraft used $7.66/gal retail (Oct 2026). Contract fuel cards typically discount.", False),
    ("maint", "Airframe maintenance and parts", "$/hr", 850, 750, 650, USD,
     "Flycraft range $800-1,300/hr incl. unscheduled. Estimate.", False),
    ("engine", "Engine program (2 x PW306D1, ESP)", "$/hr", 700, 660, 620, USD,
     "Flycraft range $275-425 per engine per hour. Engines must be on program for resale value.", False),
    ("apu", "APU program", "$/hr", 100, 80, 70, USD, "Estimate.", False),
    ("trip", "Crew travel, landing, handling fees (not rebilled)", "$/hr", 500, 450, 400, USD,
     "Flycraft range $400-650/hr.", False),
    ("SEC", "Fixed operating costs (per owned aircraft, per year)"),
    ("captains", "Captains per aircraft", "#", 2, 2, 2, NUM, "Chief pilot (Henry's partner) is one of the captains.", False),
    ("fos", "First officers per aircraft", "#", 1, 1, 1, NUM, "Plus contract pilots for peaks.", False),
    ("cap_sal", "Captain salary", "$", 190_000, 175_000, 165_000, USD, "Midsize Part 135 market. Estimate.", False),
    ("fo_sal", "First officer salary", "$", 125_000, 115_000, 105_000, USD, "Estimate.", False),
    ("benefits", "Benefits and payroll tax load", "%", 0.28, 0.25, 0.22, PCT, "Flycraft used 43% (corporate); charter typically lower.", False),
    ("contract", "Contract pilot budget", "$", 90_000, 60_000, 40_000, USD, "Estimate.", False),
    ("train", "Recurrent training per pilot (sim + Part 135)", "$", 40_000, 35_000, 30_000, USD,
     "Flycraft range $13-20K sim per pilot; Part 135 adds checkrides and travel.", False),
    ("hangar", "Hangar at home base (KBJC)", "$", 84_000, 66_000, 54_000, USD,
     "Flycraft range $2,305-5,470/month heated. KBJC has Sheltair; Jet Aviation FBO opening 2028.", False),
    ("ins", "Insurance (hull + $100M+ liability, charter use)", "$", 110_000, 85_000, 70_000, USD,
     "Flycraft: hull 0.15-0.25% of value + liability; charter use adds premium. Get a broker quote.", False),
    ("mgmt_fee", "Management fee (while on manager's certificate)", "$/month", 11_000, 10_000, 8_500, USD,
     "Light jet ~$3K/month to heavy $10K+ (Jet Linx). Charter-heavy midsize assumed higher.", True),
    ("comm", "Manager's commission on charter revenue", "%", 0.12, 0.10, 0.08, PCT,
     "Commonly 10-15% of charter revenue. Negotiate.", True),
    ("other", "Other fixed: CAMP tracking, nav data, Wi-Fi plan, software", "$", 100_000, 80_000, 65_000, USD,
     "Flycraft range $40-60K corporate; charter adds Wi-Fi and scheduling.", False),
    ("conting", "Contingency / unscheduled downtime reserve", "$", 75_000, 50_000, 35_000, USD, "", False),
    ("ga", "Henry's company G&A before own certificate", "$", 110_000, 90_000, 75_000, USD,
     "Accounting, legal, owner-level insurance, chief pilot management stipend.", False),
    ("infl", "Annual cost inflation", "%", 0.040, 0.030, 0.025, PCT, "", False),
    ("wc_months", "Cash reserve to hold (months of fixed cost per aircraft)", "months", 6, 6, 5, NUM,
     "Lenders and management companies usually require an operating reserve.", False),
    ("SEC", "Growth: own Part 135 certificate and third-party management"),
    ("cert_year", "First year operating on own Part 135 certificate", "year", 2037, 2030, 2029, YEAR,
     "FAA certification typically 12-24 months after application. Downside 2037 = stays on the management company certificate for the whole plan.", True),
    ("cert_cost", "Certificate startup cost (year before)", "$", 450_000, 350_000, 275_000, USD,
     "Required staff hired early (Director of Ops, Chief Pilot, Director of Maintenance), manuals, consultants, proving runs.", False),
    ("cert_oh", "Own-certificate overhead (fixed)", "$/yr", 1_000_000, 850_000, 750_000, USD,
     "DO, DOM, ops control/dispatch, SMS, ARGUS/Wyvern audits, sales, accounting.", False),
    ("cert_oh_ac", "Own-certificate overhead per aircraft operated", "$/yr", 60_000, 50_000, 40_000, USD, "", False),
    ("tp_margin", "Net margin per third-party managed aircraft", "$/yr", 150_000, 200_000, 225_000, USD,
     "Management fee + charter commission minus direct staff cost. Estimate.", True),
    ("SEC", "Exit and tax"),
    ("exit_year", "Exit year", "year", 2036, 2036, 2036, YEAR, "Henry: grow the fleet over 5-10 years, then exit. 2027-2036 horizon.", True),
    ("multiple", "EBITDA multiple on management/charter platform", "x", 5.0, 6.0, 6.5, MULT,
     "Applied to third-party management margin only; owned fleet valued at market. Estimate.", True),
    ("sell_cost", "Fleet selling costs at exit", "%", 0.03, 0.02, 0.02, PCT, "Broker commissions, pre-sale inspections.", False),
    ("dep", "Annual decline in aircraft market value", "%", 0.07, 0.05, 0.035, PCT, "Estimate; midsize values were firm 2021-2025.", True),
    ("tax", "Owner's marginal tax rate (illustrative)", "%", 0.37, 0.37, 0.37, PCT,
     "Memo only. Consult a CPA on material participation and passive loss limits.", False),
    ("bonus", "First-year bonus depreciation", "%", 1.0, 1.0, 1.0, PCT,
     "2025 law restored 100% bonus depreciation permanently; used aircraft qualify; >50% qualified business use. globalair.com", False),
]

AR = {}  # key -> row
row = 6
for item in ASSUMPTIONS:
    if item[0] == "SEC":
        section(A, row, item[1], 7)
        row += 1
        continue
    key, label, unit, d, b, u, fmt, note, lever = item
    AR[key] = row
    A.cell(row=row, column=1, value=label).font = BLACK
    A.cell(row=row, column=2, value=unit).font = SUB
    for col, v in zip("CDE", (d, b, u)):
        put(A, f"{col}{row}", v, fmt, fill=KEY_FILL if lever else None)
    put(A, f"F{row}", f"=CHOOSE($C$3,C{row},D{row},E{row})", fmt, bold=True)
    A.cell(row=row, column=7, value=note).font = SUB
    row += 1


def L(key, col="F", sheet=True):
    ref = f"${col}${AR[key]}"
    return f"Assumptions!{ref}" if sheet else ref


# ---------------------------------------------------------------- Fleet Plan
F = wb.create_sheet("Fleet Plan")
setup(F, "Fleet plan by scenario", "Aircraft counts at year end. Owned = financed Latitudes. "
      "Third-party = other owners' jets managed on your certificate (only counts once you hold one).",
      {"A": 44, "B": 10, **{c: 10 for c in YCOLS}})
header(F, 4, ["Item", ""] + [str(y) for y in YEARS])
FLEET = {
    "owned": {1: [1] * 10, 2: [1, 1, 1, 2, 2, 2, 3, 3, 3, 3], 3: [1, 1, 2, 2, 3, 3, 4, 4, 4, 4]},
    "tp": {1: [0] * 10, 2: [0, 0, 0, 1, 3, 5, 7, 9, 11, 12], 3: [0, 0, 1, 3, 5, 7, 9, 11, 12, 14]},
}
FR = {}
r = 5
for key, label in (("owned", "Owned aircraft (year end)"), ("tp", "Third-party managed aircraft (year end)")):
    section(F, r, label, 2 + len(YEARS))
    r += 1
    first = r
    for s, name in ((1, "Downside"), (2, "Base"), (3, "Upside")):
        F.cell(row=r, column=1, value=name).font = BLACK
        for i, c in enumerate(YCOLS):
            put(F, f"{c}{r}", FLEET[key][s][i], NUM, fill=KEY_FILL)
        r += 1
    F.cell(row=r, column=1, value="Live (selected scenario)").font = BOLD
    for c in YCOLS:
        put(F, f"{c}{r}", f"=CHOOSE(Assumptions!$C$3,{c}{first},{c}{first+1},{c}{first+2})", NUM, bold=True)
    FR[key] = r
    r += 2

# ------------------------------------------------------------ Unit Economics
U = wb.create_sheet("Unit Economics")
setup(U, "Unit economics: one Latitude, mature year, on management company certificate",
      "Today's dollars, no inflation. Shows whether a single financed jet carries itself.",
      {"A": 50, "B": 14, "C": 15, "D": 15, "E": 15, "F": 15})
header(U, 4, ["Line item", "", "Downside", "Base", "Upside", "Live"])
UR = {}


def urow(r, key, label, formula_fn, fmt=USD, bold=False, border=False):
    UR[key] = r
    U.cell(row=r, column=1, value=label).font = BOLD if bold else BLACK
    for col in "CDEF":
        c = put(U, f"{col}{r}", formula_fn(col), fmt, bold=bold)
        if border:
            c.border = TOP


def a(key, col):
    return f"Assumptions!${col}${AR[key]}"


r = 5
urow(r, "hours", "Billable hours", lambda c: f"={a('hours', c)}", NUM); r += 1
urow(r, "rate", "Blended rate per billable hour", lambda c: f"={a('mix', c)}*{a('rate_ovf', c)}+(1-{a('mix', c)})*{a('rate_ret', c)}"); r += 1
urow(r, "rev", "Charter revenue", lambda c: f"={c}{UR['hours']}*{c}{UR['rate']}", bold=True); r += 1
urow(r, "comm", "Less manager's commission", lambda c: f"=-{c}{UR['rev']}*{a('comm', c)}"); r += 1
urow(r, "net", "Net charter revenue to owner", lambda c: f"={c}{UR['rev']}+{c}{UR['comm']}", bold=True, border=True); r += 2
urow(r, "fh", "Flight hours incl. unpaid positioning", lambda c: f"={c}{UR['hours']}*(1+{a('ferry', c)})", NUM); r += 1
urow(r, "varhr", "Variable cost per flight hour",
     lambda c: f"={a('gph', c)}*{a('fuel', c)}+{a('maint', c)}+{a('engine', c)}+{a('apu', c)}+{a('trip', c)}"); r += 1
urow(r, "var", "Variable costs", lambda c: f"=-{c}{UR['fh']}*{c}{UR['varhr']}"); r += 2
urow(r, "crew", "Crew salaries and benefits",
     lambda c: f"=-(({a('captains', c)}*{a('cap_sal', c)}+{a('fos', c)}*{a('fo_sal', c)})*(1+{a('benefits', c)})+{a('contract', c)})"); r += 1
urow(r, "train", "Recurrent training", lambda c: f"=-({a('captains', c)}+{a('fos', c)})*{a('train', c)}"); r += 1
urow(r, "hangar", "Hangar", lambda c: f"=-{a('hangar', c)}"); r += 1
urow(r, "ins", "Insurance", lambda c: f"=-{a('ins', c)}"); r += 1
urow(r, "mfee", "Management fee", lambda c: f"=-{a('mgmt_fee', c)}*12"); r += 1
urow(r, "other", "Other fixed", lambda c: f"=-{a('other', c)}"); r += 1
urow(r, "cont", "Contingency", lambda c: f"=-{a('conting', c)}"); r += 1
urow(r, "ga", "Company G&A", lambda c: f"=-{a('ga', c)}"); r += 1
urow(r, "fixed", "Total fixed costs", lambda c: f"=SUM({c}{UR['crew']}:{c}{UR['ga']})", bold=True, border=True); r += 2
urow(r, "ebitda", "EBITDA (operating cash flow before debt)",
     lambda c: f"={c}{UR['net']}+{c}{UR['var']}+{c}{UR['fixed']}", bold=True); r += 1
urow(r, "margin", "EBITDA margin", lambda c: f"=IF({c}{UR['rev']}=0,0,{c}{UR['ebitda']}/{c}{UR['rev']})", PCT); r += 2
urow(r, "loan", "Loan amount", lambda c: f"={a('price', c)}*{a('ltv', c)}"); r += 1
urow(r, "ds", "Annual debt service", lambda c: f"=-PMT({a('rate', c)},{a('amort', c)},-{c}{UR['loan']})"); r += 1
urow(r, "cfads", "Cash flow after debt service", lambda c: f"={c}{UR['ebitda']}+{c}{UR['ds']}", bold=True, border=True); r += 1
urow(r, "int", "Of which: first-year interest", lambda c: f"=-{c}{UR['loan']}*{a('rate', c)}"); r += 1
urow(r, "decl", "First-year decline in aircraft value", lambda c: f"=-{a('price', c)}*{a('dep', c)}"); r += 1
urow(r, "econ", "Economic profit (EBITDA - interest - value decline)",
     lambda c: f"={c}{UR['ebitda']}+{c}{UR['int']}+{c}{UR['decl']}", bold=True); r += 2
urow(r, "contrib", "Contribution per billable hour",
     lambda c: f"={c}{UR['rate']}*(1-{a('comm', c)})-{c}{UR['varhr']}*(1+{a('ferry', c)})"); r += 1
urow(r, "be", "Breakeven billable hours (EBITDA = 0)",
     lambda c: f"=IF({c}{UR['contrib']}<=0,0,-{c}{UR['fixed']}/{c}{UR['contrib']})", NUM); r += 1
urow(r, "be_ds", "Breakeven billable hours incl. debt service",
     lambda c: f"=IF({c}{UR['contrib']}<=0,0,-({c}{UR['fixed']}+{c}{UR['ds']})/{c}{UR['contrib']})", NUM, bold=True); r += 1
urow(r, "reserve", "Cash reserve to hold", lambda c: f"=-{c}{UR['fixed']}/12*{a('wc_months', c)}"); r += 2

section(U, r, "Sensitivity: Live scenario, cash flow after debt service by billable hours", 6); r += 1
header(U, r, ["Billable hours", "", "EBITDA", "Debt service", "Cash after debt", "Per-hour margin"]); r += 1
UR["sens_start"] = r
for h in (300, 400, 500, 600, 700, 800, 900):
    put(U, f"A{r}", h, NUM)
    put(U, f"C{r}", f"=A{r}*$F${UR['contrib']}+$F${UR['fixed']}", USD)
    put(U, f"D{r}", f"=$F${UR['ds']}", USD)
    put(U, f"E{r}", f"=C{r}+D{r}", USD, bold=True)
    put(U, f"F{r}", f"=IF(A{r}=0,0,E{r}/A{r})", USD)
    r += 1

# ------------------------------------------------------- Financing Scenarios
FS = wb.create_sheet("Financing Scenarios")
setup(FS, "Financing scenarios: first aircraft, Live scenario",
      "How leverage changes cash needed and monthly cash flow. Change the LTV row (blue) to test other structures.",
      {"A": 50, "B": 4, **{get_column_letter(3 + i): 14 for i in range(6)}})
LTVS = [0.60, 0.70, 0.75, 0.80, 0.85, 0.90]
LC = [get_column_letter(3 + i) for i in range(len(LTVS))]
header(FS, 4, ["", ""] + ["Scenario " + str(i + 1) for i in range(len(LTVS))])
FSR = {}


def fsrow(r, key, label, fn, fmt=USD, bold=False, border=False):
    FSR[key] = r
    FS.cell(row=r, column=1, value=label).font = BOLD if bold else BLACK
    for col in LC:
        c = put(FS, f"{col}{r}", fn(col), fmt, bold=bold)
        if border:
            c.border = TOP


r = 5
FS.cell(row=r, column=1, value="Loan-to-value").font = BOLD
for col, v in zip(LC, LTVS):
    put(FS, f"{col}{r}", v, PCT, fill=KEY_FILL)
FSR["ltv"] = r; r += 1
fsrow(r, "price", "Purchase price", lambda c: f"={L('price')}"); r += 1
fsrow(r, "loan", "Loan", lambda c: f"={c}{FSR['price']}*{c}{FSR['ltv']}"); r += 1
fsrow(r, "down", "Down payment", lambda c: f"={c}{FSR['price']}-{c}{FSR['loan']}"); r += 1
fsrow(r, "acq", "Acquisition, onboarding and setup costs",
      lambda c: f"={L('prebuy')}+{L('legal')}+{L('onboard')}+{L('refurb')}+{L('init_train')}+{L('entity')}"); r += 1
fsrow(r, "res", "Cash reserve", lambda c: f"='Unit Economics'!$F${UR['reserve']}"); r += 1
fsrow(r, "cash", "Total equity needed to launch", lambda c: f"=SUM({c}{FSR['down']}:{c}{FSR['res']})", bold=True, border=True); r += 2
fsrow(r, "ds", "Annual debt service", lambda c: f"=PMT({L('rate')},{L('amort')},-{c}{FSR['loan']})"); r += 1
fsrow(r, "dsm", "Monthly loan payment", lambda c: f"={c}{FSR['ds']}/12"); r += 1
fsrow(r, "ebitda", "Mature-year EBITDA (Unit Economics, Live)", lambda c: f"='Unit Economics'!$F${UR['ebitda']}"); r += 1
fsrow(r, "cf", "Cash flow after debt service", lambda c: f"={c}{FSR['ebitda']}-{c}{FSR['ds']}", bold=True, border=True); r += 1
fsrow(r, "dscr", "Debt service coverage (EBITDA / debt service)",
      lambda c: f"=IF({c}{FSR['ds']}=0,0,{c}{FSR['ebitda']}/{c}{FSR['ds']})", MULT); r += 1
fsrow(r, "coc", "Cash-on-cash return", lambda c: f"=IF({c}{FSR['cash']}=0,0,{c}{FSR['cf']}/{c}{FSR['cash']})", PCT); r += 1
fsrow(r, "be", "Breakeven billable hours incl. debt service",
      lambda c: f"=IF('Unit Economics'!$F${UR['contrib']}<=0,0,(-'Unit Economics'!$F${UR['fixed']}+{c}{FSR['ds']})/'Unit Economics'!$F${UR['contrib']})",
      NUM, bold=True); r += 2
FS.cell(row=r, column=1, value="Lender reality check").font = BOLD; r += 1
for note in (
    "Credit-based jet loans typically need 15-20% down (80-85% LTV); asset-based loans 30-40% down (AOPA via flycraft.com).",
    "85-90% leverage usually means a personal guarantee, strong outside liquidity, or a second-lien / seller note on top of the senior loan.",
    "Lenders want DSCR of about 1.25x on the business alone, or will underwrite Henry's personal income and liquidity instead.",
):
    FS.cell(row=r, column=1, value=note).font = SUB
    r += 1
r += 1
section(FS, r, "Cash flow after debt service: billable hours (rows) by LTV (columns)", 8); r += 1
header(FS, r, ["Billable hours", ""] + [None] * len(LC))
for col in LC:
    put(FS, f"{col}{r}", f"={col}{FSR['ltv']}", PCT, font=HDR_FONT, fill=HDR_FILL)
r += 1
for h in (400, 500, 600, 700, 800, 900):
    put(FS, f"A{r}", h, NUM)
    for col in LC:
        put(FS, f"{col}{r}",
            f"=$A{r}*'Unit Economics'!$F${UR['contrib']}+'Unit Economics'!$F${UR['fixed']}-{col}${FSR['ds']}", USD)
    r += 1

# --------------------------------------------------------------------- Debt
D = wb.create_sheet("Debt Schedule")
setup(D, "Debt and aircraft value schedule by owned aircraft", "Each owned aircraft gets its own loan at the Live LTV and rate. "
      "Payments start in the purchase year (conservative).", {"A": 34, "B": 14, **{c: 13 for c in YCOLS}})
header(D, 4, ["Item", ""] + [str(y) for y in YEARS])
put(D, "A5", "Year")
for i, c in enumerate(YCOLS):
    put(D, f"{c}5", YEARS[i], YEAR, font=BOLD)
DR = {"begin": [], "int": [], "pay": [], "prin": [], "end": [], "val": []}
r = 7
for k in range(1, MAX_SLOTS + 1):
    section(D, r, f"Aircraft #{k}", 2 + len(YEARS)); r += 1
    D.cell(row=r, column=1, value="Purchase year").font = BLACK
    put(D, f"B{r}", f"=2027+COUNTIF('Fleet Plan'!$C${FR['owned']}:${LASTY}${FR['owned']},\"<{k}\")", YEAR)
    py = f"$B${r}"; r += 1
    D.cell(row=r, column=1, value="Price paid").font = BLACK
    put(D, f"B{r}", f"=IF({py}>2036,0,{L('price')}*(1+{L('price_chg')})^({py}-2027))", USD)
    pp = f"$B${r}"; r += 1
    D.cell(row=r, column=1, value="Loan").font = BLACK
    put(D, f"B{r}", f"={pp}*{L('ltv')}", USD)
    ln = f"$B${r}"; r += 1
    D.cell(row=r, column=1, value="Annual payment").font = BLACK
    put(D, f"B{r}", f"=IF({ln}=0,0,PMT({L('rate')},{L('amort')},-{ln}))", USD)
    pm = f"$B${r}"; r += 1
    rows = {}
    for name in ("begin", "int", "pay", "prin", "end", "val"):
        rows[name] = r
        DR[name].append(r)
        D.cell(row=r, column=1, value={"begin": "Beginning balance", "int": "Interest", "pay": "Payment",
                                       "prin": "Principal", "end": "Ending balance",
                                       "val": "Market value (year end)"}[name]).font = BLACK
        r += 1
    for i, c in enumerate(YCOLS):
        y = f"{c}$5"
        prev_end = "0" if i == 0 else f"{YCOLS[i-1]}{rows['end']}"
        put(D, f"{c}{rows['begin']}", f"=IF({y}={py},{ln},IF({y}>{py},{prev_end},0))", USD)
        put(D, f"{c}{rows['int']}", f"={c}{rows['begin']}*{L('rate')}", USD)
        put(D, f"{c}{rows['pay']}", f"=IF({c}{rows['begin']}>0,MIN({pm},{c}{rows['begin']}+{c}{rows['int']}),0)", USD)
        put(D, f"{c}{rows['prin']}", f"={c}{rows['pay']}-{c}{rows['int']}", USD)
        put(D, f"{c}{rows['end']}", f"={c}{rows['begin']}-{c}{rows['prin']}", USD)
        put(D, f"{c}{rows['val']}", f"=IF({y}>={py},{pp}*(1-{L('dep')})^({y}-{py}+1),0)", USD)
    r += 1
section(D, r, "Fleet totals", 2 + len(YEARS)); r += 1
DT = {}
for name, label in (("int", "Total interest"), ("prin", "Total principal"), ("end", "Total debt outstanding"),
                    ("val", "Total fleet market value")):
    DT[name] = r
    D.cell(row=r, column=1, value=label).font = BOLD
    for c in YCOLS:
        put(D, f"{c}{r}", "=" + "+".join(f"{c}{x}" for x in DR[name]), USD, bold=True)
    r += 1

# ------------------------------------------------------------------ Forecast
FC = wb.create_sheet("Forecast", 1)
setup(FC, "10-year forecast: company P&L, cash flow and equity (Live scenario)",
      "Annual, nominal dollars. Owned jets fly on the management company's certificate until the own-certificate year.",
      {"A": 52, "B": 4, **{c: 13 for c in YCOLS}})
FC["A3"] = "=\"Scenario: \"&Assumptions!$D$3"
FC["A3"].font = GREEN
header(FC, 4, ["Line item", ""] + [str(y) for y in YEARS])
R = {}


def frow(r, key, label, fn, fmt=USD, bold=False, border=False):
    R[key] = r
    FC.cell(row=r, column=1, value=label).font = BOLD if bold else BLACK
    for i, c in enumerate(YCOLS):
        prev = YCOLS[i - 1] if i else None
        cell = put(FC, f"{c}{r}", fn(c, prev, i), fmt, bold=bold)
        if border:
            cell.border = TOP


r = 5
frow(r, "year", "Year", lambda c, p, i: YEARS[i], YEAR); FC[f"C{r}"].font = BOLD
for c in YCOLS:
    FC[f"{c}{r}"].font = BOLD
r += 1
frow(r, "idx", "Years from 2027", lambda c, p, i: f"={c}{R['year']}-2027", NUM); r += 1
frow(r, "cert", "On management company certificate? (1 = yes)", lambda c, p, i: f"=IF({c}{R['year']}<{L('cert_year')},1,0)", NUM); r += 1
frow(r, "cidx", "Cost inflation index", lambda c, p, i: f"=(1+{L('infl')})^{c}{R['idx']}", '0.000'); r += 2

section(FC, r, "Fleet and activity", 12); r += 1
frow(r, "owned", "Owned aircraft (year end)", lambda c, p, i: f"='Fleet Plan'!{c}{FR['owned']}", NUM); r += 1
frow(r, "acy", "Owned aircraft-years in service",
     lambda c, p, i: f"={c}{R['owned']}*{L('months_y1')}/12" if i == 0 else f"=({p}{R['owned']}+{c}{R['owned']})/2", NUM1); r += 1
frow(r, "util", "Utilization factor", lambda c, p, i: f"=IF({c}{R['idx']}=0,{L('ramp1')},IF({c}{R['idx']}=1,{L('ramp2')},1))", PCT); r += 1
frow(r, "hrs", "Billable hours", lambda c, p, i: f"={c}{R['acy']}*{L('hours')}*{c}{R['util']}", NUM); r += 1
frow(r, "fh", "Flight hours incl. positioning", lambda c, p, i: f"={c}{R['hrs']}*(1+{L('ferry')})", NUM); r += 1
frow(r, "tp", "Third-party managed aircraft (year end)",
     lambda c, p, i: f"='Fleet Plan'!{c}{FR['tp']}*(1-{c}{R['cert']})", NUM); r += 1
frow(r, "tpavg", "Third-party managed aircraft (average)",
     lambda c, p, i: "=0" if i == 0 else f"=({p}{R['tp']}+{c}{R['tp']})/2", NUM1); r += 2

section(FC, r, "Revenue", 12); r += 1
frow(r, "r_ovf", "Overflow / subcontract revenue",
     lambda c, p, i: f"={c}{R['hrs']}*{L('mix')}*{L('rate_ovf')}*(1+{L('rate_g')})^{c}{R['idx']}"); r += 1
frow(r, "r_ret", "Broker / retail charter revenue",
     lambda c, p, i: f"={c}{R['hrs']}*(1-{L('mix')})*{L('rate_ret')}*(1+{L('rate_g')})^{c}{R['idx']}"); r += 1
frow(r, "r_tp", "Third-party management margin (own certificate)",
     lambda c, p, i: f"={c}{R['tpavg']}*{L('tp_margin')}*{c}{R['cidx']}"); r += 1
frow(r, "rev", "Total revenue", lambda c, p, i: f"=SUM({c}{R['r_ovf']}:{c}{R['r_tp']})", bold=True, border=True); r += 2

section(FC, r, "Operating costs", 12); r += 1
frow(r, "c_var", "Variable flight costs (fuel, maintenance, engines, APU, trip)",
     lambda c, p, i: f"={c}{R['fh']}*({L('gph')}*{L('fuel')}+{L('maint')}+{L('engine')}+{L('apu')}+{L('trip')})*{c}{R['cidx']}"); r += 1
frow(r, "c_crew", "Crew salaries, benefits, contract pilots",
     lambda c, p, i: f"={c}{R['acy']}*(({L('captains')}*{L('cap_sal')}+{L('fos')}*{L('fo_sal')})*(1+{L('benefits')})+{L('contract')})*{c}{R['cidx']}"); r += 1
frow(r, "c_train", "Recurrent training",
     lambda c, p, i: f"={c}{R['acy']}*({L('captains')}+{L('fos')})*{L('train')}*{c}{R['cidx']}"); r += 1
frow(r, "c_fix", "Hangar, insurance, other fixed, contingency",
     lambda c, p, i: f"={c}{R['acy']}*({L('hangar')}+{L('ins')}+{L('other')}+{L('conting')})*{c}{R['cidx']}"); r += 1
frow(r, "c_mfee", "Management fees (on manager's certificate)",
     lambda c, p, i: f"={c}{R['cert']}*{c}{R['acy']}*{L('mgmt_fee')}*12*{c}{R['cidx']}"); r += 1
frow(r, "c_comm", "Manager's charter commission",
     lambda c, p, i: f"={c}{R['cert']}*({c}{R['r_ovf']}+{c}{R['r_ret']})*{L('comm')}"); r += 1
frow(r, "c_ga", "Company G&A (before own certificate)",
     lambda c, p, i: f"={c}{R['cert']}*{L('ga')}*{c}{R['cidx']}"); r += 1
frow(r, "c_cert", "Own-certificate overhead",
     lambda c, p, i: f"=(1-{c}{R['cert']})*({L('cert_oh')}+{L('cert_oh_ac')}*({c}{R['acy']}+{c}{R['tpavg']}))*{c}{R['cidx']}"); r += 1
frow(r, "opex", "Total operating costs", lambda c, p, i: f"=SUM({c}{R['c_var']}:{c}{R['c_cert']})", bold=True, border=True); r += 2

frow(r, "ebitda", "EBITDA", lambda c, p, i: f"={c}{R['rev']}-{c}{R['opex']}", bold=True); r += 1
frow(r, "margin", "EBITDA margin", lambda c, p, i: f"=IF({c}{R['rev']}=0,0,{c}{R['ebitda']}/{c}{R['rev']})", PCT); r += 1
frow(r, "onetime", "One-time: own-certificate startup",
     lambda c, p, i: f"=IF({c}{R['year']}={L('cert_year')}-1,{L('cert_cost')},0)"); r += 1
frow(r, "interest", "Interest", lambda c, p, i: f"='Debt Schedule'!{c}{DT['int']}"); r += 1
frow(r, "principal", "Principal repayment", lambda c, p, i: f"='Debt Schedule'!{c}{DT['prin']}"); r += 1
frow(r, "cfo", "Cash flow after debt service", lambda c, p, i: f"={c}{R['ebitda']}-{c}{R['onetime']}-{c}{R['interest']}-{c}{R['principal']}",
     bold=True, border=True); r += 2

section(FC, r, "Aircraft purchases and owner equity", 12); r += 1
frow(r, "newac", "Aircraft purchased", lambda c, p, i: f"={c}{R['owned']}" if i == 0 else f"={c}{R['owned']}-{p}{R['owned']}", NUM); r += 1
frow(r, "price", "Price per aircraft", lambda c, p, i: f"={L('price')}*(1+{L('price_chg')})^{c}{R['idx']}"); r += 1
frow(r, "capex", "Aircraft purchases (total price)", lambda c, p, i: f"={c}{R['newac']}*{c}{R['price']}"); r += 1
frow(r, "newdebt", "Less: new loans", lambda c, p, i: f"=-{c}{R['capex']}*{L('ltv')}"); r += 1
frow(r, "acqc", "Acquisition, onboarding, refurb, training",
     lambda c, p, i: f"={c}{R['newac']}*({L('prebuy')}+{L('legal')}+{L('onboard')}+{L('refurb')}+{L('init_train')})*{c}{R['cidx']}"); r += 1
frow(r, "setup", "Company setup", lambda c, p, i: f"={L('entity')}" if i == 0 else "=0"); r += 1
frow(r, "acqeq", "Equity needed for purchases", lambda c, p, i: f"=SUM({c}{R['capex']}:{c}{R['setup']})", bold=True, border=True); r += 2
frow(r, "bcash", "Beginning cash", lambda c, p, i: "=0" if i == 0 else f"={p}{R['ecash']}" if 'ecash' in R else None); r += 1
frow(r, "mincash", "Minimum cash reserve",
     lambda c, p, i: f"={c}{R['owned']}*'Unit Economics'!$F${UR['reserve']}*{c}{R['cidx']}"); r += 1
frow(r, "neweq", "Owner equity contributed",
     lambda c, p, i: f"=MAX(0,{c}{R['mincash']}-({c}{R['bcash']}+{c}{R['cfo']}-{c}{R['acqeq']}))", bold=True); r += 1
frow(r, "ecash", "Ending cash", lambda c, p, i: f"={c}{R['bcash']}+{c}{R['cfo']}-{c}{R['acqeq']}+{c}{R['neweq']}", bold=True, border=True); r += 1
# beginning cash references ending cash, which is defined after it
for i, c in enumerate(YCOLS):
    FC[f"{c}{R['bcash']}"] = "=0" if i == 0 else f"={YCOLS[i-1]}{R['ecash']}"
    FC[f"{c}{R['bcash']}"].font = BLACK
    FC[f"{c}{R['bcash']}"].number_format = USD
frow(r, "cumeq", "Cumulative owner equity", lambda c, p, i: f"={c}{R['neweq']}" if i == 0 else f"={p}{R['cumeq']}+{c}{R['neweq']}", bold=True); r += 2

section(FC, r, "Balance sheet view (year end)", 12); r += 1
frow(r, "fleetval", "Fleet market value", lambda c, p, i: f"='Debt Schedule'!{c}{DT['val']}"); r += 1
frow(r, "debt", "Debt outstanding", lambda c, p, i: f"='Debt Schedule'!{c}{DT['end']}"); r += 1
frow(r, "nav", "Net asset value (fleet + cash - debt)", lambda c, p, i: f"={c}{R['fleetval']}+{c}{R['ecash']}-{c}{R['debt']}", bold=True, border=True); r += 1
frow(r, "ltvnow", "Loan-to-value on fleet", lambda c, p, i: f"=IF({c}{R['fleetval']}=0,0,{c}{R['debt']}/{c}{R['fleetval']})", PCT); r += 2

section(FC, r, "Memo: illustrative owner tax effect (not in cash flow; consult a CPA)", 12); r += 1
frow(r, "taxdep", "Tax depreciation (bonus in purchase year)", lambda c, p, i: f"={c}{R['capex']}*{L('bonus')}"); r += 1
frow(r, "taxinc", "Taxable income (loss) passed to owners",
     lambda c, p, i: f"={c}{R['ebitda']}-{c}{R['onetime']}-{c}{R['interest']}-{c}{R['taxdep']}"); r += 1
frow(r, "taxfx", "Tax saved (owed) at owner's rate, if losses are usable",
     lambda c, p, i: f"=-{c}{R['taxinc']}*{L('tax')}", bold=True); r += 1
FC.cell(row=r, column=1, value="Bonus depreciation is recaptured as ordinary income when aircraft are sold at exit. "
        "Losses may be limited by passive-activity and at-risk rules unless Henry materially participates.").font = SUB
r += 2

section(FC, r, "Equity cash flows for IRR", 12); r += 1
frow(r, "exitflag", "Exit year flag", lambda c, p, i: f"=IF({c}{R['year']}={L('exit_year')},1,0)", NUM); r += 1
frow(r, "eqflow", "Owner cash flow (contributions negative, exit proceeds positive)",
     lambda c, p, i: f"=IF({c}{R['year']}>{L('exit_year')},0,-{c}{R['neweq']}+{c}{R['exitflag']}*Exit!$C$15)", bold=True); r += 1

# ---------------------------------------------------------------------- Exit
E = wb.create_sheet("Exit")
setup(E, "Exit valuation (Live scenario)", "Fleet sold at market, debt repaid, management platform sold at an EBITDA multiple.",
      {"A": 52, "B": 4, "C": 18, "D": 70})
header(E, 4, ["Item", "", "Value", "Note"])
yr_rng = f"Forecast!$C${R['year']}:${LASTY}${R['year']}"


def at_exit(key):
    return f"INDEX(Forecast!$C${R[key]}:${LASTY}${R[key]},MATCH({L('exit_year')},{yr_rng},0))"


EXIT_ROWS = [
    (5, "Exit year", f"={L('exit_year')}", YEAR, ""),
    (6, "Fleet market value", f"={at_exit('fleetval')}", USD, "Debt Schedule, year-end market value"),
    (7, "Less selling costs", f"=-C6*{L('sell_cost')}", USD, ""),
    (8, "Third-party management margin in exit year", f"={at_exit('r_tp')}", USD, "Recurring platform earnings"),
    (9, "Platform value (margin x multiple)", f"=C8*{L('multiple')}", USD, "Buyers pay for managed fleet and certificate"),
    (10, "Enterprise value", "=C6+C7+C9", USD, ""),
    (11, "Less debt outstanding", f"=-{at_exit('debt')}", USD, ""),
    (12, "Plus cash on hand", f"={at_exit('ecash')}", USD, ""),
    (13, "Equity value at exit (before tax)", "=SUM(C10:C12)", USD, ""),
    (14, "Less illustrative tax on depreciation recapture", f"=-MAX(0,C6+C7-{at_exit('fleetval')}*0)*0", USD,
     "Set to zero here: depends on Henry's tax position. See Forecast memo and talk to a CPA."),
    (15, "Net exit proceeds to owners", "=C13+C14", USD, ""),
    (17, "Total owner equity contributed", f"=SUMPRODUCT((Forecast!$C${R['year']}:${LASTY}${R['year']}<={L('exit_year')})*Forecast!$C${R['neweq']}:${LASTY}${R['neweq']})",
     USD, ""),
    (18, "Multiple on invested equity (MOIC)", "=IF(C17=0,0,C15/C17)", MULT, ""),
    (19, "Equity IRR", f"=IFERROR(IRR(Forecast!$C${R['eqflow']}:${LASTY}${R['eqflow']}),\"n/a\")", PCT,
     "Ignores the tax memo; including usable tax losses would raise it."),
    (20, "Peak cumulative equity", f"=MAX(Forecast!$C${R['cumeq']}:${LASTY}${R['cumeq']})", USD, "Cash Henry and partners must be able to fund"),
]
for rr, label, f, fmt, note in EXIT_ROWS:
    E.cell(row=rr, column=1, value=label).font = BOLD if rr in (10, 13, 15, 18, 19) else BLACK
    put(E, f"C{rr}", f, fmt, bold=rr in (13, 15, 18, 19))
    E.cell(row=rr, column=4, value=note).font = SUB
E["C14"] = "=0"
E["C14"].font = BLACK
E["C14"].number_format = USD

# --------------------------------------------------------------- Startup Budget
S = wb.create_sheet("Startup Budget", 1)
setup(S, "Startup budget: first aircraft (Live scenario)", "Uses and sources of cash to get Jet #1 flying revenue trips.",
      {"A": 52, "B": 4, "C": 16, "D": 60})
header(S, 4, ["Uses of cash", "", "Amount", "Note"])
SB = [
    ("Purchase price", f"={L('price')}", "Assumptions"),
    ("Pre-buy inspection", f"={L('prebuy')}", ""),
    ("Closing legal, escrow, title, registration", f"={L('legal')}", ""),
    ("Part 135 onboarding, conformity, Wi-Fi/avionics", f"={L('onboard')}", ""),
    ("Interior/paint refresh", f"={L('refurb')}", ""),
    ("Initial crew training and hiring", f"={L('init_train')}", ""),
    ("Company formation, legal, accounting, insurance setup", f"={L('entity')}", ""),
    ("Cash reserve (operating)", f"='Unit Economics'!$F${UR['reserve']}", "Months of fixed cost per Assumptions"),
]
r = 5
for label, f, note in SB:
    S.cell(row=r, column=1, value=label).font = BLACK
    put(S, f"C{r}", f, USD)
    S.cell(row=r, column=4, value=note).font = SUB
    r += 1
S.cell(row=r, column=1, value="Total uses").font = BOLD
put(S, f"C{r}", f"=SUM(C5:C{r-1})", USD, bold=True).border = TOP
tot = r
r += 2
header(S, r, ["Sources of cash", "", "Amount", "Note"]); r += 1
S.cell(row=r, column=1, value="Aircraft loan").font = BLACK
put(S, f"C{r}", f"={L('price')}*{L('ltv')}", USD)
S.cell(row=r, column=4, value="Senior secured loan at Live LTV").font = SUB
loan_r = r; r += 1
S.cell(row=r, column=1, value="Owner equity (Henry + partners)").font = BLACK
put(S, f"C{r}", f"=C{tot}-C{loan_r}", USD)
eq_r = r; r += 1
S.cell(row=r, column=1, value="Total sources").font = BOLD
put(S, f"C{r}", f"=C{loan_r}+C{eq_r}", USD, bold=True).border = TOP
r += 2
S.cell(row=r, column=1, value="Equity as % of total uses").font = BLACK
put(S, f"C{r}", f"=C{eq_r}/C{tot}", PCT)
r += 2
header(S, r, ["First full year operating budget (2028)", "", "Amount", "Note"]); r += 1
col28 = YCOLS[1]
for label, key in (("Charter revenue", None), ("Variable flight costs", "c_var"), ("Crew", "c_crew"),
                   ("Training", "c_train"), ("Hangar, insurance, other fixed", "c_fix"), ("Management fees", "c_mfee"),
                   ("Manager's commission", "c_comm"), ("Company G&A", "c_ga"), ("EBITDA", "ebitda"),
                   ("Debt service", None), ("Cash flow after debt service", "cfo")):
    S.cell(row=r, column=1, value=label).font = BOLD if label in ("EBITDA", "Cash flow after debt service") else BLACK
    if label == "Charter revenue":
        f = f"=Forecast!{col28}{R['r_ovf']}+Forecast!{col28}{R['r_ret']}"
    elif label == "Debt service":
        f = f"=-(Forecast!{col28}{R['interest']}+Forecast!{col28}{R['principal']})"
    elif key in ("ebitda", "cfo"):
        f = f"=Forecast!{col28}{R[key]}"
    else:
        f = f"=-Forecast!{col28}{R[key]}"
    put(S, f"C{r}", f, USD, bold=label in ("EBITDA", "Cash flow after debt service"))
    S.cell(row=r, column=4, value="From Forecast, 2028 column" if label == "Charter revenue" else "").font = SUB
    r += 1

# ------------------------------------------------------------------ Dashboard
Z = wb.create_sheet("Dashboard", 0)
setup(Z, "Jet overflow charter business: dashboard", "Change the scenario on the Assumptions sheet (cell C3). All figures update.",
      {"A": 52, "B": 4, "C": 18, "D": 60})
put(Z, "A3", "=\"Scenario shown: \"&Assumptions!$D$3")
header(Z, 5, ["Metric", "", "Value", "What it means"])
DASH = [
    ("Purchase price, Jet #1", f"={L('price')}", USD, ""),
    ("Equity needed to launch", f"='Startup Budget'!C{eq_r}", USD, "Down payment + startup costs + reserve"),
    ("Aircraft loan", f"='Startup Budget'!C{loan_r}", USD, ""),
    ("Mature-year EBITDA, one jet", f"='Unit Economics'!F{UR['ebitda']}", USD, "Before debt"),
    ("Annual debt service, one jet", f"=-'Unit Economics'!F{UR['ds']}", USD, ""),
    ("Cash flow after debt, one jet", f"='Unit Economics'!F{UR['cfads']}", USD, "Negative = owners fund the gap"),
    ("Breakeven billable hours (EBITDA)", f"='Unit Economics'!F{UR['be']}", NUM, ""),
    ("Breakeven billable hours incl. debt", f"='Unit Economics'!F{UR['be_ds']}", NUM, "Key target for the management company"),
    ("Peak cumulative owner equity (10 yrs)", "=Exit!C20", USD, "Total cash Henry and partners must fund"),
    ("Net exit proceeds", "=Exit!C15", USD, ""),
    ("Multiple on invested equity", "=Exit!C18", MULT, ""),
    ("Equity IRR", "=Exit!C19", PCT, "Before owner tax effects"),
    ("Owned aircraft at exit", f"={at_exit('owned')}", NUM, ""),
    ("Third-party managed aircraft at exit", f"={at_exit('tp')}", NUM, ""),
    ("Revenue in exit year", f"={at_exit('rev')}", USD, ""),
    ("EBITDA in exit year", f"={at_exit('ebitda')}", USD, ""),
]
r = 6
for label, f, fmt, note in DASH:
    Z.cell(row=r, column=1, value=label).font = BLACK
    put(Z, f"C{r}", f, fmt, bold=True)
    Z.cell(row=r, column=4, value=note).font = SUB
    r += 1
r += 1
Z.cell(row=r, column=1, value="Legend").font = BOLD; r += 1
for txt, font in (("Blue text: input you can change", BLUE), ("Black text: formula", BLACK),
                  ("Green text: link to another sheet", GREEN)):
    Z.cell(row=r, column=1, value=txt).font = font
    r += 1
Z.cell(row=r, column=1, value="Yellow fill: key lever").fill = KEY_FILL
r += 1
Z.cell(row=r, column=1, value="All estimates must be verified with quotes from lenders, the management company, insurers and an aircraft broker.").font = SUB

for ws in wb.worksheets:
    ws.freeze_panes = "B5" if ws.title in ("Forecast", "Debt Schedule", "Fleet Plan") else None
    for row_ in ws.iter_rows():
        for c in row_:
            if c.font is None or c.font.name != FONT:
                c.font = Font(name=FONT, size=c.font.size if c.font else 10, bold=c.font.bold if c.font else False,
                              italic=c.font.italic if c.font else False, color=c.font.color if c.font else None)

wb.save(OUT)
print("saved", OUT)
