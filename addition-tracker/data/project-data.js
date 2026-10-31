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
    contractor: "TBD",
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
  // roofs: hip roofs over a rectangular eave outline (4 corners, in order).
  //   `eaveZ` is the height of the eave edge; `pitch` is rise per 12" of run.
  model: {
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
        sharedEdges: [4],    // SE wall abuts the existing house
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
        footprint: [[21.57, -34.98], [3.1, -48.68], [26.65, -80.45], [45.12, -66.76]],
        floor: 3.0,
        plate: 11.0,
      },
      {
        id: "existing-west",
        label: "Existing house",
        kind: "existing",
        footprint: [[-12.3, -70.9], [23.5, -70.9], [23.5, -94.2], [-12.3, -94.2]],
        floor: 3.0,
        plate: 11.0,
      },
      {
        id: "existing-south",
        label: "Existing house",
        kind: "existing",
        footprint: [[6.3, -63.0], [37.7, -63.0], [37.7, -115.1], [6.3, -115.1]],
        floor: 3.0,
        plate: 11.0,
      },
    ],
    roofs: [
      { id: "wing-main",  kind: "new", eave: [[0, 0], [-32.56, -24.13], [-7.28, -58.24], [25.28, -34.1]],      eaveZ: 12.2, pitch: 7 },
      { id: "wing-low",   kind: "new", eave: [[10.72, -14.46], [-29.8, -44.5], [-15.24, -64.14], [25.28, -34.1]], eaveZ: 12.2, pitch: 7 },
      { id: "garage",     kind: "new", eave: [[0.6, -0.8], [32.6, -0.8], [32.6, -28.65], [0.6, -28.65]],      eaveZ: 7.5,  pitch: 5 },
      { id: "existing-mid",   kind: "existing", eave: [[22.21, -33.33], [1.33, -48.81], [26.34, -82.55], [47.22, -67.07]], eaveZ: 10.4, pitch: 5 },
      { id: "existing-west",  kind: "existing", eave: [[-13.8, -69.4], [25, -69.4], [25, -95.7], [-13.8, -95.7]],          eaveZ: 10.4, pitch: 5 },
      { id: "existing-south", kind: "existing", eave: [[4.8, -61.5], [39.2, -61.5], [39.2, -116.6], [4.8, -116.6]],        eaveZ: 10.4, pitch: 5 },
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

  // ── Schedule (PLACEHOLDER durations) ─────────────────────────────────────
  // `duration` is in working days. A task starts the working day after all of
  // its `dependsOn` tasks finish (or on the project start date if none).
  // `delays` push the task, and everything after it, later:
  //   { days, kind: "start" | "extend", reason, date }
  //   "start"  = task starts later (e.g. waiting on an inspection)
  //   "extend" = task takes longer (e.g. snow days mid-task)
  tasks: [
    { id: "demo",        name: "Demolition & site prep",              phase: "Site & foundation", duration: 8,  dependsOn: [],                          progress: 0, delays: [] },
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
