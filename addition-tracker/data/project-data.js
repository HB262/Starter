// ─────────────────────────────────────────────────────────────────────────────
//  HOME ADDITION TRACKER: STARTING DATA
//
//  The 3D model is traced from the "Ready for Construction" set
//  (BLD-2024-01595): footprint from sheet A1.3, roof from A1.4, heights from
//  the addition cross section. The BUDGET and SCHEDULE are still PLACEHOLDERS
//  (the plan set has no costs or dates). Replace them with the contractor's
//  bid and schedule, then flip the flags in `placeholder` to false.
//
//  This file is the seed. Changes made in the app (expenses, delays, log
//  entries, photos) are saved in the browser. Data → Export downloads them as
//  JSON; Data → Import loads them on another device; Data → Reset reloads this
//  file and discards browser changes.
//
//  Units: feet, US dollars, working days (Mon–Fri).
// ─────────────────────────────────────────────────────────────────────────────

export default {
  placeholder: { budget: true, schedule: true, model: false },

  project: {
    name: "3315 S. Columbine Cir. Remodel & Addition",
    address: "3315 S. Columbine Cir., Englewood, CO 80113",
    permit: "BLD-2024-01595 (Arapahoe County)",
    architect: "GMH Ltd. (Brian Ostler)",
    structural: "Denver Structures (Joel Kauffman, PE)",
    contractor: "On Point Saliency (Rod Cruce), Class-B GEN25-0096, (720) 969-6061",
    startDate: "2026-11-16", // PLACEHOLDER: first working day on site
  },

  // ── Building permit ──────────────────────────────────────────────────────
  // Number, address and scope are from the permit submittal and the Ready for
  // Construction set. Status, dates, valuation and fees are blank until they
  // are copied from the county's Accela Citizen Access record (needs a login).
  // Inspections are the usual Arapahoe County residential sequence; confirm
  // against the permit card. `taskId` links an inspection to a schedule task.
  // `status`: "Not scheduled" | "Scheduled" | "Passed" | "Partial" | "Failed" | "Not required"
  permit: {
    number: "BLD-2024-01595",
    jurisdiction: "Arapahoe County Public Works & Development, Building Division",
    portalUrl: "https://aca-prod.accela.com/ARAPAHOE/Default.aspx",
    address: "3315 S Columbine Cir, Englewood, CO 80113-7606",
    type: "Residential addition & remodel",
    scope: "Single-story bedroom wing with basement and crawl space, attached 2-car garage, re-roof of the existing house in standing seam metal, new gas service and sanitary lateral to the addition.",
    codes: "2021 IRC, 2021 IPC, 2021 IFGC, 2020 NEC, 2021 IECC (climate zone 5B)",
    status: "",
    applied: "",
    issued: "",
    expires: "",
    valuation: null,
    fees: null,
    contractor: "",
    notes: "",
    inspections: [
      { id: "i-footing",     name: "Footing / caisson",            taskId: "foundation", status: "Not scheduled" },
      { id: "i-foundation",  name: "Foundation walls",             taskId: "insp-fdn",   status: "Not scheduled" },
      { id: "i-drain",       name: "Perimeter drain & damproofing", taskId: "waterproof", status: "Not scheduled" },
      { id: "i-underslab",   name: "Underground / under-slab plumbing", taskId: "framing", status: "Not scheduled" },
      { id: "i-framing",     name: "Rough framing",                taskId: "insp-rough", status: "Not scheduled" },
      { id: "i-r-elec",      name: "Rough electrical",             taskId: "insp-rough", status: "Not scheduled" },
      { id: "i-r-plumb",     name: "Rough plumbing",               taskId: "insp-rough", status: "Not scheduled" },
      { id: "i-r-mech",      name: "Rough mechanical & gas",       taskId: "insp-rough", status: "Not scheduled" },
      { id: "i-roof",        name: "Roof sheathing / ice & water", taskId: "roofing",    status: "Not scheduled" },
      { id: "i-insulation",  name: "Insulation",                   taskId: "insulation", status: "Not scheduled" },
      { id: "i-drywall",     name: "Drywall / fire separation",    taskId: "drywall",    status: "Not scheduled" },
      { id: "i-f-elec",      name: "Final electrical",             taskId: "final",      status: "Not scheduled" },
      { id: "i-f-plumb",     name: "Final plumbing",               taskId: "final",      status: "Not scheduled" },
      { id: "i-f-mech",      name: "Final mechanical",             taskId: "final",      status: "Not scheduled" },
      { id: "i-f-bldg",      name: "Final building",               taskId: "final",      status: "Not scheduled" },
    ],
  },

  // ── 3D model ─────────────────────────────────────────────────────────────
  // Plan coordinates in feet: +x = east, +y = north (street side). Origin is
  // the north eave corner of the new bedroom wing. z = 0 is finished grade.
  //
  // volumes: walls extruded from a footprint polygon (outside face of wall).
  //   floor/plate: heights above grade of the floor and the top of the wall.
  //   openings: on footprint edge `edge` (edge i runs from point i to i+1),
  //     `offset` ft from the start of that edge, `sill` above the floor.
  //   sharedEdges: edges that abut another volume (not drawn).
  // roofs: hip roofs over a rectangular eave outline (4 corners, in order);
  //   type "gable" puts the ridge along eave[0]→eave[1]; type "outline" is a
  //   hip roof over any outline, all slopes at the same pitch.
  //   `eaveZ` is the height of the eave edge; `pitch` is rise per 12" of run.
  model: {
    // Shown under the 3D legend, so a viewer can tell which model version loaded.
    revision: "Oct 31, existing roof with one continuous ridge",
    materials: {
      siding: "#d9d4c7",      // Hardie vertical board & batten, color TBD
      brick: "#8a5a44",       // full brick veneer wainscot
      roof: "#4a3f35",        // standing seam metal, dark bronze
      trim: "#3b332c",        // bronze-clad window frames
      glass: "#7fa7c4",
      garageDoor: "#5b5249",
      existingWalls: "#b9b2a6",
      existingRoof: "#7c7770",
      foundation: "#9c9a94",
    },
    volumes: [
      {
        id: "wing",
        label: "Bedroom wing (new)",
        kind: "new",
        footprint: [[-0.31, -2.1], [-30.46, -24.45], [-19.74, -38.91], [-27.7, -44.81], [-14.93, -62.04], [23.18, -33.79]],
        floor: 3.0,          // main floor ≈ 3'-3" above grade (5401.45 vs 5398.2)
        plate: 13.1,         // 10'-1" plate
        basementDepth: 9.5,  // basement + crawl below; drawn under grade in Progress view
        wainscot: 3.0,       // brick veneer height above floor
        sharedEdges: [4, 5], // SE wall abuts the existing house; NE side is open to the garage
        // The shop area (NE end of the wing, under the wing roof) is open to the
        // garage and sits at garage slab level, so the raised floor stops at the
        // shop/bedroom wall and the shop gets its own slab at grade.
        foundationFootprint: [[-9.47, -8.89], [-30.46, -24.45], [-19.74, -38.91], [-27.7, -44.81], [-14.93, -62.04], [23.18, -33.79], [18.8, -27.9], [4.6, -27.9]],
        lowSlabs: [
          // walls: footprint-line edges of this slab that need siding below the wing floor
          { label: "Shop area slab (garage level)", poly: [[-0.31, -2.1], [-9.47, -8.89], [4.6, -27.9], [18.8, -27.9]], top: 0, walls: [0] },
        ],
        openings: [
          { edge: 0, offset: 4.5,  width: 5, height: 6, sill: 2, type: "window", label: "W6 5'×6' fixed" },
          { edge: 0, offset: 15.5, width: 5, height: 6, sill: 2, type: "window", label: "W1 5'×6' casement egress (Bedroom 101)" },
          { edge: 0, offset: 29,   width: 5, height: 6, sill: 2, type: "window", label: "W1 5'×6' casement egress (Bedroom 100)" },
          { edge: 1, offset: 6.5,  width: 5, height: 6, sill: 2, type: "window", label: "5'×6' casement" },
          { edge: 3, offset: 7,    width: 8, height: 6, sill: 2, type: "window", label: "8'×4' bay (Play room)" },
          { edge: 3, offset: 16.5, width: 3, height: 6.67, sill: 0, type: "door", label: "Play room door" },
        ],
      },
      {
        id: "garage",
        label: "2-car garage (new)",
        kind: "new",
        footprint: [[-0.31, -2.1], [31.1, -2.1], [31.1, -27.92], [23.18, -33.79]],
        floor: 0.0,
        plate: 8.1,
        wainscot: 2.0,
        sharedEdges: [3],    // SW side opens to the wing (girder truss line)
        openings: [
          { edge: 0, offset: 4.65, width: 8,  height: 8, sill: 0, type: "garage", label: "DG1 8' overhead door" },
          { edge: 0, offset: 13.9, width: 16, height: 8, sill: 0, type: "garage", label: "DG2 16' overhead door" },
          { edge: 1, offset: 4.2,  width: 5, height: 6, sill: 2.5, type: "window", label: "W2 5'×6' fixed" },
          { edge: 1, offset: 16.3, width: 5, height: 6, sill: 2.5, type: "window", label: "W2 5'×6' fixed" },
        ],
      },
      {
        id: "existing-mid",
        label: "Existing house (re-roofed)",
        kind: "existing",
        footprint: [[15.55, -39.45], [-10.16, -58.51], [11.31, -87.47], [37.02, -68.41]],
        floor: 3.0,
        plate: 11.0,
      },
      {
        id: "existing-west",
        label: "Existing house",
        kind: "existing",
        footprint: [[-18.3, -71.5], [11.7, -71.5], [11.7, -97.1], [-18.3, -97.1]],
        floor: 3.0,
        plate: 11.0,
      },
      {
        id: "existing-south",
        label: "Existing house",
        kind: "existing",
        footprint: [[1.5, -70.5], [34.7, -70.5], [34.7, -118.7], [1.5, -118.7]],
        floor: 3.0,
        plate: 11.0,
      },
    ],
    // Posts carrying the new entry roof (bottom/top heights in feet above grade).
    posts: [
      { at: [40.3, -49.3], from: 3.0, to: 10.4, size: 0.75, label: "Entry post" },
      { at: [40.3, -68.2], from: 3.0, to: 10.4, size: 0.75, label: "Entry post" },
    ],
    roofs: [
      { id: "wing-main",  kind: "new", eave: [[0, 0], [-32.56, -24.13], [-7.28, -58.24], [25.28, -34.1]],      eaveZ: 12.2, pitch: 7 },
      { id: "wing-low",   kind: "new", eave: [[10.72, -14.46], [-29.8, -44.5], [-15.24, -64.14], [25.28, -34.1]], eaveZ: 12.2, pitch: 7 },
      { id: "garage",     kind: "new", eave: [[0.6, -0.8], [32.6, -0.8], [32.6, -28.65], [0.6, -28.65]],      eaveZ: 7.5,  pitch: 5 },
      // The existing house is one roof: a 5/12 hip over the whole outline (the
      // NW wing, the south block and the west block), with one ridge that runs
      // on through the bend. Outline traced from the drone photo and the aerial.
      { id: "existing", kind: "existing", type: "outline", eave: [[12.57, -34.25], [35.7, -65.46], [35.7, -120.2], [0.5, -120.2], [0.5, -98.6], [-19.8, -98.6], [-19.8, -70.0], [-4.75, -70.0], [-15.71, -55.22]], eaveZ: 10.4, pitch: 5 },
      // New covered entry over the existing stoop (A3.2 east elevation): 4/12 gable
      // facing east, about 21 ft wide, on posts; the back end dies into the
      // existing roof. Ridge runs along eave[0]→eave[1].
      { id: "entry", kind: "new", type: "gable", label: "New covered entry (4/12 gable)", eave: [[20, -48], [41.5, -48], [41.5, -69.5], [20, -69.5]], eaveZ: 10.4, pitch: 4 },
    ],
    // Which schedule task completes each part of the new construction. In
    // Progress view a part is a ghost until its task starts, translucent while
    // in progress, and solid at 100%.
    phases: {
      foundation: "foundation",
      framing: "framing",
      roof: "roofing",
      openings: "windows",
      siding: "siding",
      drywall: "drywall",
      flooring: "flooring",
      fixtures: "cabinets",
    },

    // Interior, traced from the 1st floor plan (sheet A1.3). Approximate.
    // Points are [u, v] in a frame (`wing`: u runs along the NW wall from the
    // north corner toward the west corner, v runs from that wall toward the
    // existing house) or [x, y] in plan coordinates when frame is "plan".
    // walls: centerlines with door gaps `doors: [[from, to], ...]` measured
    //   along the wall from its first point. Height is floor to ceiling.
    // rooms: floor areas with finish (carpet | wood | tile | rubber); `at` places the label.
    // fixtures: simple boxes [[u0, v0], [u1, v1], height].
    interior: {
      frames: { wing: { origin: [-0.31, -2.1], u: [-0.8034, -0.5955], v: [0.5955, -0.8034] } },
      floor: 3.0,
      ceiling: 13.1,
      doorHeight: 6.67,
      cutHeight: 8.0, // the "Inside" view slices walls here
      walls: [
        // shop / bedroom wing wall and hall 103 west side
        { frame: "wing", a: [11.4, 0.3], b: [11.4, 36.6] },
        // between the bedrooms
        { frame: "wing", a: [24.6, 0.3], b: [24.6, 19] },
        // bedrooms / hallway 103 (doors to 101 and 100)
        { frame: "wing", a: [11.4, 19], b: [37.5, 19], doors: [[9.4, 12.4], [13.9, 16.9]] },
        // bedroom 101 closet
        { frame: "wing", a: [14.5, 15.1], b: [20.4, 15.1], doors: [[1, 5]] },
        { frame: "wing", a: [14.5, 15.1], b: [14.5, 19] },
        { frame: "wing", a: [20.4, 15.1], b: [20.4, 19] },
        // bedroom 100 closet
        { frame: "wing", a: [24.6, 3.8], b: [33.4, 3.8], doors: [[2, 6.5]] },
        { frame: "wing", a: [33.4, 0.3], b: [33.4, 3.8] },
        // hallway 103 / bathroom 105 (bath door)
        { frame: "wing", a: [15.6, 23.5], b: [29.2, 23.5], doors: [[6.6, 9.1]] },
        // hall side of the WC and powder room
        { frame: "wing", a: [15.6, 23.5], b: [15.6, 36] },
        { frame: "wing", a: [15.6, 28.5], b: [20.8, 28.5] },
        { frame: "wing", a: [20.8, 23.5], b: [20.8, 36], doors: [[0.6, 3.1]] },
        // powder room 106 door to the south hall
        { frame: "wing", a: [15.6, 36], b: [24, 36], doors: [[1.2, 3.7]] },
        // bathroom east wall (play room built-in on the other side)
        { frame: "wing", a: [29.2, 23.5], b: [29.2, 39.2], doors: [[13, 15]] },
        // bath / toy closet
        { frame: "wing", a: [20.8, 35.5], b: [29.2, 35.5] },
        { frame: "wing", a: [24, 35.5], b: [24, 39.2] },
        // laundry 107 south wall (shelf / built-in) and the garage demising wall
        { frame: "wing", a: [3.6, 32], b: [11.4, 32], doors: [[4.6, 7.2]] },
        { frame: "plan", a: [4.6, -27.9], b: [31.1, -27.9], doors: [[8.9, 11.9]], fire: true, top: 8.1 },
        // laundry / hallway 108
        { frame: "plan", a: [15.2, -27.9], b: [15.2, -30.0] },
      ],
      rooms: [
        { name: "Bedroom 101", frame: "wing", finish: "carpet", poly: [[11.4, 0], [24.6, 0], [24.6, 19], [11.4, 19]] },
        { name: "Bedroom 100", frame: "wing", finish: "carpet", poly: [[24.6, 0], [37.5, 0], [37.5, 19], [24.6, 19]] },
        { name: "Hallway 103", frame: "wing", finish: "wood", at: [13.5, 29], poly: [[11.4, 19], [31.5, 19], [31.5, 23.5], [15.6, 23.5], [15.6, 36], [24, 36], [24, 39.4], [11.4, 39.4]] },
        { name: "Bathroom 105", frame: "wing", finish: "tile", at: [24.5, 27], poly: [[15.6, 23.5], [29.2, 23.5], [29.2, 35.5], [20.8, 35.5], [20.8, 28.5], [15.6, 28.5]] },
        { name: "Powder room 106", frame: "wing", finish: "tile", at: [18.2, 33.5], poly: [[15.6, 28.5], [20.8, 28.5], [20.8, 36], [15.6, 36]] },
        { name: "Toy closet", frame: "wing", finish: "wood", poly: [[24, 35.5], [29.2, 35.5], [29.2, 39.4], [24, 39.4]] },
        { name: "Play room 104", frame: "wing", finish: "wood", poly: [[31.5, 19], [37.5, 19], [37.5, 18], [47.4, 18], [47.4, 39.4], [29.2, 39.4], [29.2, 23.5], [31.5, 23.5]] },
        { name: "Shop area (open to the garage)", frame: "wing", finish: "rubber", floor: 0, poly: [[0.3, 0], [11.4, 0], [11.4, 23.66], [0.3, 31.9]] },
        { name: "Laundry 107", frame: "plan", finish: "tile", poly: [[4.6, -27.9], [15.2, -27.9], [15.2, -30.0], [15.5, -30.2], [9.6, -34.6]] },
        { name: "Hallway 108", frame: "wing", finish: "tile", at: [6, 36.5], poly: [[0.3, 31.9], [3.6, 30.3], [3.6, 32], [11.4, 32], [11.4, 39.4], [0.3, 39.4]] },
      ],
      fixtures: [
        { label: "Double vanity", frame: "wing", box: [[27.2, 24.2], [29.0, 28.8]], h: 2.8, color: "#e8e2d6" },
        { label: "Shower", frame: "wing", box: [[23.5, 31], [28.5, 35.3]], h: 7, glass: true },
        { label: "Toilet", frame: "wing", box: [[17.7, 25.6], [19.3, 27.9]], h: 1.4, color: "#f4f2ee" },
        { label: "Toilet", frame: "wing", box: [[17.7, 29.8], [19.3, 32.1]], h: 1.4, color: "#f4f2ee" },
        { label: "Entertainment center / wet bar (built-in)", frame: "wing", box: [[29.4, 24.2], [31.4, 35]], h: 7, color: "#7b5a3c" },
        { label: "Washer & dryer", frame: "plan", box: [[8.7, -28.2], [13.6, -30.4]], h: 3.2, color: "#e9e9e6" },
        { label: "Steps down to the garage (5 risers)", frame: "plan", box: [[13.3, -24.6], [16.7, -27.7]], h: 0, steps: 5, color: "#9c9a94" },
      ],
    },
  },

  // ── Budget (PLACEHOLDER figures) ─────────────────────────────────────────
  budget: [
    { id: "b-design",     category: "Soft costs",        item: "Architect, structural & truss engineering", budget: 18000 },
    { id: "b-permits",    category: "Soft costs",        item: "Permits, plan review & tap fees",           budget: 6000 },
    { id: "b-demo",       category: "Site & foundation", item: "Demolition & site prep",                    budget: 12000 },
    { id: "b-excavation", category: "Site & foundation", item: "Excavation, backfill & grading",            budget: 18000 },
    { id: "b-foundation", category: "Site & foundation", item: "Basement walls, footings & garage slab",    budget: 45000 },
    { id: "b-waterproof", category: "Site & foundation", item: "Waterproofing, drain tile & sump",          budget: 8000 },
    { id: "b-framing",    category: "Structure",         item: "Framing, beams & engineered trusses",       budget: 60000 },
    { id: "b-roof",       category: "Structure",         item: "Standing seam metal roof (incl. re-roof)",  budget: 42000 },
    { id: "b-windows",    category: "Exterior",          item: "Milgard bronze-clad windows & doors",       budget: 32000 },
    { id: "b-garagedoor", category: "Exterior",          item: "Garage doors & openers",                    budget: 9000 },
    { id: "b-siding",     category: "Exterior",          item: "Hardie board & batten siding",              budget: 24000 },
    { id: "b-brick",      category: "Exterior",          item: "Brick veneer wainscot",                     budget: 14000 },
    { id: "b-electrical", category: "Systems",           item: "Electrical (incl. sub panels)",             budget: 22000 },
    { id: "b-plumbing",   category: "Systems",           item: "Plumbing (incl. new sanitary lateral)",     budget: 20000 },
    { id: "b-hvac",       category: "Systems",           item: "HVAC: furnace, ducting, water heater",      budget: 18000 },
    { id: "b-insulation", category: "Interior",          item: "Spray foam & batt insulation",              budget: 14000 },
    { id: "b-drywall",    category: "Interior",          item: "Drywall, texture & paint",                  budget: 22000 },
    { id: "b-flooring",   category: "Interior",          item: "Flooring & tile",                           budget: 20000 },
    { id: "b-bath",       category: "Interior",          item: "Bath & laundry fixtures, cabinets, counters", budget: 24000 },
    { id: "b-trim",       category: "Interior",          item: "Interior doors & trim",                     budget: 10000 },
    { id: "b-contingency",category: "Contingency",       item: "Contingency (10%)",                         budget: 44000 },
  ],

  // Actual spend. `budgetId` links each expense to a budget line.
  expenses: [
    { id: "e1", date: "2024-03-02", budgetId: "b-design", amount: 9000, vendor: "GMH Ltd. (PLACEHOLDER amount)", note: "Design deposit" },
    { id: "e2", date: "2025-09-17", budgetId: "b-design", amount: 7500, vendor: "GMH Ltd. (PLACEHOLDER amount)", note: "Construction set" },
    { id: "e3", date: "2026-02-06", budgetId: "b-permits", amount: 4200, vendor: "Arapahoe County (PLACEHOLDER amount)", note: "Building permit BLD-2024-01595" },
  ],

  // ── Contract payments (Fixed Price Construction Agreement, Section 6) ────
  payments: [
    { id: "pay-1", kind: "draw", name: "Initial payment", trigger: "Before sitework begins", covers: "Sitework, demolition, excavation, utilities, foundation, and procurement package 1 (steel, framing & trusses, windows & doors, timber, roof).", amount: 250000, status: "Paid", dueDate: "", paidDate: "2026-08-26", note: "", expenseId: "" },
    { id: "pay-2", kind: "draw", name: "1st progress payment", trigger: "After the foundation is poured", covers: "Framing, roofing, exterior siding finishes, and procurement package 2 (brick, stained Hardie siding & trim, drywall, interior materials).", amount: 250000, status: "Upcoming", dueDate: "", paidDate: "", note: "", expenseId: "" },
    { id: "pay-3", kind: "draw", name: "2nd progress payment", trigger: "After drywall and interior painting", covers: "MEP rough-ins, insulation, painting, flooring, and procurement package 3 (electrical & plumbing fixtures, cabinetry, hardware).", amount: 150000, status: "Upcoming", dueDate: "", paidDate: "", note: "", expenseId: "" },
    { id: "pay-4", kind: "draw", name: "3rd progress payment", trigger: "Before hardwood sand-and-finish", covers: "MEP trim-outs, hardware installation, and final finishes.", amount: 150000, status: "Upcoming", dueDate: "", paidDate: "", note: "", expenseId: "" },
    { id: "pay-5", kind: "draw", name: "Final payment", trigger: "After final inspection and completion", covers: "Due once the final inspection passes; punch-list items may be held back until done.", amount: 42852.12, status: "Upcoming", dueDate: "", paidDate: "", note: "", expenseId: "" },
  ],

  // ── Schedule (PLACEHOLDER durations) ─────────────────────────────────────
  // `duration` is in working days. A task starts the working day after all of
  // its `dependsOn` tasks finish (or on the project start date if none).
  // `delays` push the task, and everything after it, later:
  //   { days, kind: "start" | "extend", reason, date }
  //   "start"  = task starts later (e.g. waiting on an inspection)
  //   "extend" = task takes longer (e.g. snow days mid-task)
  tasks: [
    // Permitting: pinned to actual dates (`startDate`/`endDate`). `permitField` steps follow the Permit tab's dates.
    {"id": "p-soils", "name": "Soils & foundation report (Kordziel)", "phase": "Permitting", "startDate": "2023-01-25", "duration": 1, "milestone": true, "dependsOn": [], "progress": 100, "delays": [], "note": "Kordziel Engineering #2599. Needed for the permit submittal."},
    {"id": "p-apply", "name": "Permit application submitted", "phase": "Permitting", "startDate": "2024-12-02", "permitField": "applied", "duration": 1, "milestone": true, "dependsOn": ["p-soils"], "progress": 100, "delays": [], "note": "PLACEHOLDER date: the permit number shows a 2024 application. Enter the real date on the Permit tab."},
    {"id": "p-review1", "name": "Plan review 1 → resubmittal with narrative", "phase": "Permitting", "startDate": "2024-12-03", "endDate": "2025-03-10", "duration": 1, "dependsOn": ["p-apply"], "progress": 100, "delays": [], "note": "Ends with GMH's written narrative (3/10/2025): EV charger dropped, lofts and gas fireplace deleted, metal roof."},
    {"id": "p-asbestos", "name": "CDPHE asbestos release", "phase": "Permitting", "startDate": "2025-03-17", "duration": 1, "milestone": true, "dependsOn": [], "progress": 100, "delays": [], "note": "Released by email after the Ascend Environmental inspection."},
    {"id": "p-review2", "name": "Plan review 2 → rev 3 drawings", "phase": "Permitting", "startDate": "2025-03-11", "endDate": "2025-06-24", "duration": 1, "dependsOn": ["p-review1"], "progress": 100, "delays": [], "note": "County redlines 4/29/2025; GMH response 6/15 and rev 3 set signed 6/24/2025."},
    {"id": "p-review3", "name": "Plan review 3 → corrections", "phase": "Permitting", "startDate": "2025-06-25", "endDate": "2025-09-12", "duration": 1, "dependsOn": ["p-review2"], "progress": 100, "delays": [], "note": "County redlines 9/11/2025; A1.2, AD4, S3, A4.0–A4.1 resubmitted 9/12."},
    {"id": "p-approved", "name": "Final review → Ready for Construction set", "phase": "Permitting", "startDate": "2025-09-15", "endDate": "2026-02-06", "duration": 1, "dependsOn": ["p-review3"], "progress": 100, "delays": [], "note": "Ready for Construction set issued 2/6/2026."},
    {"id": "p-contractor", "name": "Contractor information form filed", "phase": "Permitting", "startDate": "2026-05-28", "duration": 1, "milestone": true, "dependsOn": ["p-approved"], "progress": 100, "delays": [], "note": "On Point Saliency (GC), Walk on Water Plumbing; electrical and mechanical subs TBD."},
    {"id": "p-contract", "name": "Construction contract signed", "phase": "Permitting", "startDate": "2026-08-23", "duration": 1, "milestone": true, "dependsOn": ["p-contractor"], "progress": 100, "delays": [], "note": "Fixed Price Construction Agreement with On Point Saliency."},
    {"id": "p-issued", "name": "Permit issued", "phase": "Permitting", "startDate": "2026-09-23", "permitField": "issued", "duration": 1, "milestone": true, "dependsOn": ["p-approved", "p-contractor"], "progress": 100, "delays": [], "note": "PLACEHOLDER date: enter the issue date on the Permit tab and this moves to match."},
    { id: "demo",        name: "Demolition & site prep",              phase: "Site & foundation", duration: 8,  dependsOn: ["p-issued", "p-contract"],                          progress: 0, delays: [] },
    { id: "excavation",  name: "Excavation for basement & crawl",     phase: "Site & foundation", duration: 5,  dependsOn: ["demo"],                    progress: 0, delays: [] },
    { id: "foundation",  name: "Footings, basement walls & garage slab", phase: "Site & foundation", duration: 15, dependsOn: ["excavation"],          progress: 0, delays: [] },
    { id: "insp-fdn",    name: "Foundation inspection",               phase: "Site & foundation", duration: 1,  dependsOn: ["foundation"],              progress: 0, delays: [], milestone: true },
    { id: "waterproof",  name: "Waterproofing, drain tile & backfill", phase: "Site & foundation", duration: 5, dependsOn: ["insp-fdn"],                progress: 0, delays: [] },
    { id: "framing",     name: "Floor & wall framing, beams",         phase: "Structure",         duration: 15, dependsOn: ["waterproof"],              progress: 0, delays: [] },
    { id: "trusses",     name: "Set trusses & sheath roof",           phase: "Structure",         duration: 5,  dependsOn: ["framing"],                 progress: 0, delays: [] },
    { id: "roofing",     name: "Standing seam roof (new + re-roof)",  phase: "Structure",         duration: 8,  dependsOn: ["trusses"],                 progress: 0, delays: [] },
    { id: "windows",     name: "Windows, exterior & garage doors",    phase: "Exterior",          duration: 5,  dependsOn: ["trusses"],                 progress: 0, delays: [] },
    { id: "rough-mep",   name: "Rough electrical, plumbing, HVAC",    phase: "Systems",           duration: 12, dependsOn: ["roofing", "windows"],      progress: 0, delays: [] },
    { id: "insp-rough",  name: "Framing & rough-in inspections",      phase: "Systems",           duration: 2,  dependsOn: ["rough-mep"],               progress: 0, delays: [], milestone: true },
    { id: "siding",      name: "Brick wainscot, siding & trim",       phase: "Exterior",          duration: 15, dependsOn: ["windows"],                 progress: 0, delays: [] },
    { id: "insulation",  name: "Insulation & insulation inspection",  phase: "Interior",          duration: 4,  dependsOn: ["insp-rough"],              progress: 0, delays: [] },
    { id: "drywall",     name: "Drywall, texture & paint",            phase: "Interior",          duration: 15, dependsOn: ["insulation"],              progress: 0, delays: [] },
    { id: "flooring",    name: "Flooring & tile",                     phase: "Interior",          duration: 8,  dependsOn: ["drywall"],                 progress: 0, delays: [] },
    { id: "cabinets",    name: "Cabinets, counters & fixtures",       phase: "Interior",          duration: 6,  dependsOn: ["flooring"],                progress: 0, delays: [] },
    { id: "finish-mep",  name: "Finish electrical, plumbing, HVAC",   phase: "Systems",           duration: 5,  dependsOn: ["cabinets"],                progress: 0, delays: [] },
    { id: "trim",        name: "Interior doors & trim",               phase: "Interior",          duration: 6,  dependsOn: ["flooring"],                progress: 0, delays: [] },
    { id: "exterior",    name: "Driveway, grading & landscape",       phase: "Exterior",          duration: 6,  dependsOn: ["siding"],                  progress: 0, delays: [] },
    { id: "final",       name: "Final inspection & punch list",       phase: "Closeout",          duration: 5,  dependsOn: ["trim", "finish-mep", "exterior"], progress: 0, delays: [], milestone: true },
  ],

  // ── Event log ────────────────────────────────────────────────────────────
  // `type`: "note" | "milestone" | "issue" | "inspection" | "delivery" | "delay" | "payment"
  events: [
    { id: "ev1", date: "2025-09-17", type: "milestone", title: "Construction set signed", note: "Architect's stamped set (GMH Ltd., Brian Ostler).", photos: [] },
    { id: "ev2", date: "2026-02-06", type: "milestone", title: "Ready for Construction set issued", note: "BLD-2024-01595. Architectural, structural, truss and mechanical packages.", photos: [] },
  ],
};
