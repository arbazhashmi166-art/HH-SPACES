import {
  defaultRateCatalog as curatedRateCatalog,
  rateCategories,
  type RateBand,
  type RateCategory,
  type RateHistoryPoint,
  type RateItem,
  type RateItemDetails,
  type RateMatrix,
  type RateUnit
} from "./rate-catalog";

type WorkGroup = {
  category: RateCategory;
  subcategory: string;
  unit: RateUnit;
  labourStandard: number;
  materialStandard: number;
  productivity: number;
  skilled: number;
  helpers: number;
  machine: string;
  formula: string;
  materialFormula: string;
  tools: string[];
  sequence: string[];
  checklist: string[];
  exclusions: string[];
  warranty: string;
  completion: string;
  qualityGrade: string;
  brand: string;
  gst: number;
  wastage: number;
  minQty: number;
  aliases: string[];
  items: string[];
};

type RequiredProfile = Pick<
  WorkGroup,
  | "unit"
  | "labourStandard"
  | "materialStandard"
  | "productivity"
  | "skilled"
  | "helpers"
  | "machine"
  | "formula"
  | "materialFormula"
  | "tools"
  | "sequence"
  | "checklist"
  | "exclusions"
  | "warranty"
  | "completion"
  | "qualityGrade"
  | "brand"
  | "gst"
  | "wastage"
  | "minQty"
  | "aliases"
>;

const rateValidityDate = "2026-07-16";

const defaultProfile: RequiredProfile = {
  unit: "sqft",
  labourStandard: 35,
  materialStandard: 45,
  productivity: 250,
  skilled: 1,
  helpers: 1,
  machine: "Hand tools",
  formula: "Measured actual finished quantity",
  materialFormula: "Material quantity = measured quantity x standard consumption x wastage",
  tools: ["Tape", "Laser level", "Hand tools"],
  sequence: ["Inspect site", "Measure quantity", "Prepare surface", "Execute work", "Check quality", "Clean area"],
  checklist: ["Line and level checked", "Material approved", "Edges finished", "Area cleaned"],
  exclusions: ["Major hidden repair", "Premium brand upgrade", "Night work", "Permission charges"],
  warranty: "Workmanship warranty as per final quotation",
  completion: "Depends on quantity and site access",
  qualityGrade: "Standard",
  brand: "Market standard",
  gst: 18,
  wastage: 8,
  minQty: 100,
  aliases: []
};

const profileOverrides: Partial<Record<RateCategory, Partial<RequiredProfile>>> = {
  "Site Preparation": {
    unit: "lot",
    labourStandard: 1200,
    materialStandard: 250,
    productivity: 1,
    skilled: 1,
    helpers: 2,
    machine: "As required",
    formula: "Lump sum or visit based",
    materialFormula: "Consumables and protection material as per site",
    tools: ["Laser measure", "Level tube", "Marker", "Safety tape"],
    completion: "Same day for small sites",
    minQty: 1,
    aliases: ["preliminary", "site setup", "mobilisation"]
  },
  Demolition: {
    labourStandard: 38,
    materialStandard: 12,
    productivity: 180,
    skilled: 1,
    helpers: 3,
    machine: "Breaker or cutter when required",
    formula: "Measured dismantled area or quantity",
    materialFormula: "Debris bags, blades, fuel and disposal allowance",
    tools: ["Breaker", "Hammer", "Cutter", "Safety gear", "Debris bags"],
    completion: "150-250 sqft per team per day",
    wastage: 0,
    aliases: ["dismantling", "breaking", "removal"]
  },
  Excavation: {
    unit: "cum",
    labourStandard: 520,
    materialStandard: 130,
    productivity: 8,
    skilled: 1,
    helpers: 4,
    machine: "JCB or manual tools",
    formula: "Length x width x depth",
    materialFormula: "Fuel, shutter support, dewatering and disposal as needed",
    tools: ["Spade", "Pickaxe", "JCB", "Plate compactor"],
    minQty: 5,
    gst: 18,
    aliases: ["earthwork", "digging"]
  },
  "RCC Work": {
    labourStandard: 78,
    materialStandard: 182,
    productivity: 220,
    skilled: 2,
    helpers: 4,
    machine: "Mixer, vibrator, pump optional",
    formula: "Measured concrete area or volume as per item",
    materialFormula: "Cement, sand, aggregate/RMC, curing and admixture as per mix design",
    tools: ["Mixer", "Needle vibrator", "Level", "Trowel"],
    warranty: "Structural warranty depends on design and material control",
    aliases: ["concrete", "rcc", "structure"]
  },
  "Reinforcement Steel": {
    unit: "kg",
    labourStandard: 12,
    materialStandard: 0,
    productivity: 250,
    skilled: 1,
    helpers: 2,
    machine: "Bar bending machine when required",
    formula: "Steel weight from bar bending schedule",
    materialFormula: "Binding wire = steel weight x 0.9% to 1.2%",
    tools: ["Bar cutter", "Bar bender", "Binding hook"],
    wastage: 3,
    minQty: 100,
    aliases: ["rebar", "steel binding", "bar bending"]
  },
  Formwork: {
    labourStandard: 75,
    materialStandard: 0,
    productivity: 180,
    skilled: 2,
    helpers: 3,
    machine: "Props and staging",
    formula: "Contact area of shuttering",
    materialFormula: "Shuttering oil, plywood/steel rent and consumables as per cycle",
    tools: ["Props", "Span", "Plywood", "Hammer", "Level"],
    wastage: 5,
    aliases: ["shuttering", "centering", "staging"]
  },
  "Brick Work": {
    labourStandard: 35,
    materialStandard: 95,
    productivity: 140,
    skilled: 1,
    helpers: 2,
    formula: "Wall length x height",
    materialFormula: "Bricks/blocks, cement/sand or adhesive based on wall type",
    tools: ["Line dori", "Plumb bob", "Trowel", "Level"],
    aliases: ["masonry", "wall work"]
  },
  Plaster: {
    labourStandard: 18,
    materialStandard: 22,
    productivity: 450,
    skilled: 1,
    helpers: 2,
    formula: "Wall or ceiling surface area",
    materialFormula: "Cement bags = area/70 to 110 based on thickness; sand = area/20 to 35 cft",
    tools: ["Ghamela", "Trowel", "Level patti", "Sponge"],
    wastage: 7,
    aliases: ["cement plaster", "gypsum plaster", "render"]
  },
  Flooring: {
    labourStandard: 45,
    materialStandard: 85,
    productivity: 220,
    skilled: 1,
    helpers: 2,
    formula: "Floor area plus wastage",
    materialFormula: "Screed, adhesive, grout or finish material as selected",
    tools: ["Level", "Trowel", "Cutting machine", "Spacer"],
    aliases: ["floor", "screed"]
  },
  Tiling: {
    labourStandard: 45,
    materialStandard: 135,
    productivity: 140,
    skilled: 1,
    helpers: 1,
    formula: "Area = length x height or length x width; add wastage",
    materialFormula: "Tiles + adhesive 1 bag per 45-60 sqft + grout 1 kg per 60-90 sqft",
    tools: ["Tile cutter", "Laser level", "Spacer", "Notched trowel", "Rubber mallet"],
    aliases: ["tile", "dado", "bathroom tile"]
  },
  "Natural Stone": {
    labourStandard: 95,
    materialStandard: 520,
    productivity: 80,
    skilled: 1,
    helpers: 2,
    formula: "Actual stone area or running edge length",
    materialFormula: "Stone slab, adhesive/mortar, polishing and edge wastage",
    tools: ["Stone cutter", "Polisher", "Lifter", "Level"],
    wastage: 12,
    aliases: ["stone", "countertop", "slab"]
  },
  Granite: {
    labourStandard: 120,
    materialStandard: 580,
    productivity: 65,
    skilled: 1,
    helpers: 2,
    formula: "Stone area plus cutouts and edge length",
    materialFormula: "Granite slab, adhesive, polish, cutout charges and wastage",
    tools: ["Granite cutter", "Polishing pads", "Lifter"],
    wastage: 12,
    aliases: ["counter", "platform", "granite top"]
  },
  Marble: {
    labourStandard: 100,
    materialStandard: 560,
    productivity: 75,
    skilled: 1,
    helpers: 2,
    formula: "Stone area plus wastage",
    materialFormula: "Marble slab, mortar, polish, filling and wastage",
    tools: ["Cutter", "Polisher", "Level"],
    wastage: 15,
    aliases: ["marble", "stone floor"]
  },
  Waterproofing: {
    labourStandard: 35,
    materialStandard: 75,
    productivity: 300,
    skilled: 1,
    helpers: 1,
    formula: "Surface area including upturns and corners",
    materialFormula: "Chemical litres = area/25 to 45; cement and mesh as system requires",
    tools: ["Brush", "Roller", "Scraper", "Moisture meter"],
    warranty: "Warranty depends on product system, surface preparation and flood test",
    aliases: ["waterproof", "leakage", "coating"]
  },
  "Waterproof Coating": {
    labourStandard: 30,
    materialStandard: 70,
    productivity: 350,
    skilled: 1,
    helpers: 1,
    formula: "Coated surface area",
    materialFormula: "Primer + coating consumption as per product data sheet",
    tools: ["Roller", "Brush", "Airless spray optional"],
    warranty: "Depends on coating system and warranty layer thickness",
    aliases: ["roof coating", "pu coating", "acrylic coating"]
  },
  POP: {
    labourStandard: 35,
    materialStandard: 70,
    productivity: 180,
    skilled: 1,
    helpers: 1,
    formula: "Finished area or running feet for moulding",
    materialFormula: "POP bags = area/70 to 90; frame, mesh and screws as design requires",
    tools: ["Trowel", "Mould", "Level", "Sanding tools"],
    aliases: ["punning", "moulding", "pop"]
  },
  "False Ceiling": {
    labourStandard: 38,
    materialStandard: 87,
    productivity: 180,
    skilled: 1,
    helpers: 2,
    formula: "Ceiling plan area plus design drops and grooves",
    materialFormula: "Board/panel, GI channel, screws, joint tape, compound",
    tools: ["Screw gun", "Laser level", "Cutter", "Scaffold"],
    aliases: ["ceiling", "gypsum", "grid ceiling"]
  },
  Carpentry: {
    labourStandard: 350,
    materialStandard: 1250,
    productivity: 35,
    skilled: 1,
    helpers: 1,
    formula: "Front elevation sqft or actual finished area",
    materialFormula: "Plywood/MDF/HDHMR sheets, laminate, edge band, hardware and wastage",
    tools: ["Circular saw", "Router", "Drill", "Clamps"],
    wastage: 12,
    aliases: ["carpenter", "woodwork", "joinery"]
  },
  Furniture: {
    labourStandard: 320,
    materialStandard: 1130,
    productivity: 32,
    skilled: 1,
    helpers: 1,
    formula: "Finished furniture sqft or running cabinet size",
    materialFormula: "Sheets, laminate/veneer, edge band, hardware, adhesive, screws",
    tools: ["Panel saw", "Drill", "Edge band trimmer"],
    wastage: 12,
    aliases: ["furniture", "unit", "cabinet"]
  },
  "Modular Kitchen": {
    labourStandard: 450,
    materialStandard: 1650,
    productivity: 28,
    skilled: 2,
    helpers: 1,
    formula: "Cabinet front sqft or running feet with height",
    materialFormula: "Plywood/HDHMR, laminate/acrylic, hardware baskets and installation",
    tools: ["Drill", "Level", "Jigsaw", "Edge tools"],
    wastage: 14,
    aliases: ["kitchen", "cabinet", "tandem"]
  },
  Painting: {
    labourStandard: 10,
    materialStandard: 22,
    productivity: 650,
    skilled: 1,
    helpers: 1,
    formula: "Wall or ceiling surface area per coat",
    materialFormula: "Primer litres = area/120; paint litres = area/90 per coat; putty kg = area/18",
    tools: ["Roller", "Brush", "Sander", "Scraper"],
    aliases: ["paint", "putty", "texture"]
  },
  Plumbing: {
    unit: "point",
    labourStandard: 550,
    materialStandard: 1250,
    productivity: 5,
    skilled: 1,
    helpers: 1,
    formula: "Count of plumbing points or running length",
    materialFormula: "Pipe length, fittings, valves and test consumables by point type",
    tools: ["Pipe cutter", "Welding machine", "Pressure pump", "Chasing cutter"],
    aliases: ["cpvc", "upvc", "sanitary", "pipe"]
  },
  Electrical: {
    unit: "point",
    labourStandard: 350,
    materialStandard: 600,
    productivity: 10,
    skilled: 1,
    helpers: 1,
    formula: "Point count, running wire length or DB quantity",
    materialFormula: "Wire length, conduit, box, switch/socket, MCB and accessories by load",
    tools: ["Tester", "Chasing cutter", "Crimper", "Drill"],
    aliases: ["electric", "wiring", "point"]
  },
  HVAC: {
    unit: "nos",
    labourStandard: 1800,
    materialStandard: 2200,
    productivity: 2,
    skilled: 1,
    helpers: 1,
    machine: "Core cutter and vacuum pump when required",
    formula: "Count of units, duct area or copper running feet",
    materialFormula: "Copper pipe, drain pipe, insulation, brackets, gas and electrical support",
    tools: ["Vacuum pump", "Core cutter", "Flaring kit", "Gauge manifold"],
    aliases: ["ac", "ventilation", "duct"]
  },
  Aluminium: {
    labourStandard: 80,
    materialStandard: 500,
    productivity: 60,
    formula: "Opening area in sqft",
    materialFormula: "Aluminium section, glass, rollers, locks, sealant",
    tools: ["Cutting saw", "Drill", "Rivet gun"],
    aliases: ["window", "sliding", "aluminium"]
  },
  Glass: {
    labourStandard: 120,
    materialStandard: 780,
    productivity: 45,
    formula: "Glass area and fitting count",
    materialFormula: "Glass, hardware, patch fitting, silicone and consumables",
    tools: ["Glass lifter", "Drill", "Suction cups"],
    aliases: ["glass", "mirror", "partition"]
  },
  Fabrication: {
    labourStandard: 180,
    materialStandard: 570,
    productivity: 50,
    skilled: 1,
    helpers: 1,
    machine: "Welding machine and grinder",
    formula: "Weight, running feet, or finished area",
    materialFormula: "MS/SS section, welding rods, primer, paint and wastage",
    tools: ["Welding machine", "Grinder", "Gas cutter"],
    wastage: 8,
    aliases: ["fabrication", "steel", "welding"]
  },
  "Low Voltage": {
    unit: "point",
    labourStandard: 300,
    materialStandard: 650,
    productivity: 12,
    formula: "Point count and cable length",
    materialFormula: "Cable, conduit, box, connectors, rack accessories",
    tools: ["Crimper", "Cable tester", "Drill"],
    aliases: ["cctv", "lan", "data", "security"]
  },
  "Fire Fighting": {
    unit: "point",
    labourStandard: 650,
    materialStandard: 1600,
    productivity: 5,
    skilled: 1,
    helpers: 2,
    formula: "Point count, pipe length, or equipment quantity",
    materialFormula: "Pipes, fittings, sprinklers, valves, detectors and panel accessories",
    tools: ["Threading machine", "Pressure pump", "Tester"],
    aliases: ["fire", "sprinkler", "alarm"]
  },
  Roofing: {
    labourStandard: 80,
    materialStandard: 220,
    productivity: 220,
    formula: "Roof plan area including overlap",
    materialFormula: "Sheet/panel, fasteners, flashing, frame and wastage",
    tools: ["Drill", "Cutting tool", "Safety harness"],
    aliases: ["roof", "sheet", "shed"]
  },
  "External Works": {
    labourStandard: 55,
    materialStandard: 110,
    productivity: 180,
    formula: "Area, length or quantity by external item",
    materialFormula: "Civil material, pavers, kerb, pipe or landscape material as item requires",
    tools: ["Level", "Compactor", "Masonry tools"],
    aliases: ["external", "compound", "paver", "landscape"]
  },
  Elevation: {
    labourStandard: 95,
    materialStandard: 220,
    productivity: 120,
    skilled: 1,
    helpers: 2,
    machine: "Scaffold or rope access when required",
    formula: "Elevation surface area or running moulding length",
    materialFormula: "Cladding, paint, texture, sealant, frame and wastage",
    tools: ["Scaffold", "Cutter", "Drill", "Level"],
    aliases: ["facade", "elevation", "cladding"]
  },
  "Repair Maintenance": {
    unit: "visit",
    labourStandard: 1200,
    materialStandard: 600,
    productivity: 1,
    formula: "Visit, defect count or affected area",
    materialFormula: "Repair material as per defect after inspection",
    tools: ["Inspection kit", "Hand tools", "Sealant gun"],
    aliases: ["repair", "maintenance", "amc"]
  },
  "Cleaning Handover": {
    labourStandard: 6,
    materialStandard: 3,
    productivity: 1000,
    skilled: 0,
    helpers: 3,
    formula: "Cleaned floor or surface area",
    materialFormula: "Cleaning chemicals, pads, bags and machine rent if required",
    tools: ["Vacuum", "Scrubber", "Wiper", "Cleaning kit"],
    gst: 18,
    aliases: ["cleaning", "handover", "deep clean"]
  },
  "Interior Work": {
    labourStandard: 220,
    materialStandard: 780,
    productivity: 80,
    formula: "Area, running feet or lump sum package",
    materialFormula: "Decor material, frame, panel, adhesive and finishing material",
    tools: ["Laser level", "Drill", "Cutter"],
    aliases: ["interior", "2bhk", "fitout"]
  },
  "Exterior Work": {
    labourStandard: 80,
    materialStandard: 160,
    productivity: 180,
    formula: "Exterior surface area or quantity",
    materialFormula: "Weather-proof material, scaffold, primer and finish coat",
    tools: ["Scaffold", "Roller", "Cutter"],
    aliases: ["exterior", "outside", "facade"]
  },
  "Labour Supply": {
    unit: "day",
    labourStandard: 850,
    materialStandard: 0,
    productivity: 1,
    skilled: 1,
    helpers: 0,
    formula: "Worker count x days",
    materialFormula: "No material included",
    tools: ["Worker tools as per trade"],
    gst: 0,
    aliases: ["worker", "wages", "labour"]
  }
};

const tileSizes = ["Mosaic", "1x1", "1x2", "2x2", "2x4", "4x4", "300x450 mm", "300x600 mm", "600x600 mm", "600x1200 mm", "800x1600 mm", "1200x2400 mm", "Large Format"];
const tileTypes = ["Ceramic", "Vitrified", "Double Charge", "Glazed Vitrified", "Full Body Vitrified", "Porcelain", "Digital", "Subway", "Mosaic", "Glass Mosaic", "Cement", "Anti Skid", "Parking", "Outdoor", "Elevation", "Terracotta", "Wooden Finish", "Book Match", "Highlighter"];

const workGroups: WorkGroup[] = [
  group("Site Preparation", "Inspection, setup and protection", ["Site Inspection", "Site Measurement", "Site Survey", "Level Survey", "Marking And Layout", "Centre-Line Marking", "Benchmark Fixing", "Soil Testing", "Temporary Site Office", "Temporary Storage Shed", "Temporary Worker Accommodation", "Temporary Electricity Connection", "Temporary Water Connection", "Site Barricading", "Safety Net Installation", "Safety Signage", "Material Shifting", "Loading And Unloading", "Manual Material Lifting", "Machine Material Lifting", "Debris Shifting", "Debris Disposal", "Municipal Dumping Charges", "Floor Protection", "Lift Protection", "Passage Protection", "Existing Furniture Protection", "Scaffolding", "Bamboo Scaffolding", "Steel Scaffolding", "Mobile Scaffolding", "Working Platform", "Night-Shift Charges", "Height-Work Charges", "Restricted-Site Charges", "Society Working-Hour Charges", "Site Supervision", "Engineer Visit", "Architect Coordination", "Daily Cleaning", "Final Cleaning"]),
  group("Demolition", "Dismantling and debris", ["Brick-Wall Demolition", "AAC-Block Demolition", "RCC Wall Cutting", "RCC Slab Cutting", "RCC Beam Cutting", "RCC Column Cutting", "Concrete Breaking", "Floor Tile Removal", "Wall Tile Removal", "Marble Removal", "Granite Removal", "Kota Stone Removal", "Mosaic-Floor Removal", "IPS-Floor Removal", "Existing Plaster Removal", "POP Removal", "False-Ceiling Removal", "Gypsum Partition Removal", "Wooden Partition Removal", "Glass-Partition Removal", "Door Removal", "Door-Frame Removal", "Window Removal", "Kitchen-Platform Demolition", "Basin-Counter Demolition", "Bathroom Demolition", "Plumbing-Line Removal", "Electrical Wiring Removal", "Sanitary Fitting Removal", "Waterproofing-Layer Removal", "Terrace-Coba Removal", "Chajja Demolition", "Stair Demolition", "Core Cutting", "Wall Chasing", "Floor Chasing", "Controlled Demolition", "Debris Bagging", "Debris Lowering", "Debris Transport"]),
  group("Excavation", "Earthwork and filling", ["Manual Excavation", "Machine Excavation", "Foundation Excavation", "Column-Pit Excavation", "Trench Excavation", "Septic-Tank Excavation", "Underground-Tank Excavation", "Lift-Pit Excavation", "Hard-Soil Excavation", "Soft-Soil Excavation", "Murum Excavation", "Rock Excavation", "Dewatering", "Soil Refilling", "Selected-Earth Filling", "Murum Filling", "Sand Filling", "Layer Compaction", "Plate-Compactor Work", "Road-Roller Compaction", "Anti-Termite Treatment", "Soil Transport", "Extra-Earth Disposal"]),
  group("RCC Work", "Concrete and structural repair", ["Plain Cement Concrete", "Levelling Course", "Foundation PCC", "Flooring PCC", "RCC Footing", "Combined Footing", "Raft Foundation", "Pedestal", "Plinth Beam", "Tie Beam", "RCC Column", "RCC Beam", "RCC Slab", "Sunken Slab", "Chajja", "Lintel", "Loft Slab", "Staircase", "Waist Slab", "RCC Parapet", "RCC Retaining Wall", "Lift Wall", "Water Tank", "Septic Tank", "Machine Foundation", "RCC Jacketing", "Structural Repair", "Micro-Concrete Repair", "Polymer Repair Mortar", "Non-Shrink Grouting", "Anchor-Bolt Fixing", "Chemical Anchoring", "Rebar Drilling", "Rebar Dowelling", "Expansion-Joint Treatment", "Concrete Only", "Steel Binding Only", "Shuttering Only", "Labour Only RCC", "Labour With Machinery RCC", "Labour Plus Complete Material RCC", "Pump Concrete", "Manual Concrete", "Ready-Mix Concrete"]),
  group("Reinforcement Steel", "Cutting, bending and binding", ["Steel Cutting", "Steel Bending", "Steel Binding", "Footing Reinforcement", "Column Reinforcement", "Beam Reinforcement", "Slab Reinforcement", "Stair Reinforcement", "Raft Reinforcement", "Retaining-Wall Reinforcement", "Mesh Reinforcement", "Welded Mesh", "Chair Bar", "Spacer Bar", "Coupler Fixing", "Lap Welding", "Rebar Straightening", "Rust Removal", "Anti-Corrosion Coating", "Reinforcement Scanning"]),
  group("Formwork", "Shuttering and staging", ["Footing Shuttering", "Column Shuttering", "Beam Shuttering", "Slab Shuttering", "Stair Shuttering", "Chajja Shuttering", "Lift-Wall Shuttering", "Circular-Column Shuttering", "Retaining-Wall Shuttering", "Plywood Shuttering", "Steel Shuttering", "Aluminium Formwork", "Centering", "Staging", "Prop Installation", "De-Shuttering", "Shuttering Oil", "Groove Formation", "Chamfer Strip", "Construction Joint"]),
  group("Brick Work", "Masonry and wall modification", ["Red-Brick Masonry", "Fly-Ash Brick Masonry", "AAC-Block Masonry", "Concrete-Block Masonry", "Solid-Block Masonry", "Hollow-Block Masonry", "Laterite Masonry", "Stone Masonry", "Random-Rubble Masonry", "Partition Wall", "Half-Brick Wall", "Full-Brick Wall", "4-Inch Wall", "6-Inch Wall", "9-Inch Wall", "Curved Wall", "Parapet Wall", "Shaft Wall", "Duct Wall", "Bathroom Level Raising", "Kitchen Platform Base", "Window Closing", "Door Opening Modification", "Wall-Height Increase", "Wall Tooth Connection", "Chicken-Mesh Fixing", "RCC-And-Masonry Joint Mesh", "Block Adhesive Work", "Cement-Mortar Masonry"]),
  group("Plaster", "Plastering and surface preparation", ["Internal Plaster", "External Plaster", "Ceiling Plaster", "Single-Coat Plaster", "Double-Coat Plaster", "Waterproof Plaster", "Rough Plaster", "Smooth Plaster", "Sand-Faced Plaster", "Sponge-Finish Plaster", "Textured Plaster", "Gypsum Plaster", "Ready-Mix Plaster", "Patch Plaster", "Column Plaster", "Beam Plaster", "Shaft Plaster", "Parapet Plaster", "Duct Plaster", "Chicken-Mesh Plaster", "Groove Formation In Plaster", "Drip Mould", "Corner Finishing", "Level-Patti Work", "Plaster Repair", "Crack Repair", "Old-Plaster Hacking", "Bonding-Agent Application"]),
  group("Flooring", "Floor finish and screed", ["Floor Levelling", "Cement Screed", "Waterproof Screed", "Slope Screed", "IPS Flooring", "VDF Flooring", "Tremix Flooring", "Granolithic Flooring", "Micro-Topping", "Epoxy Flooring", "PU Flooring", "Self-Levelling Flooring", "Kota Flooring", "Shahabad Flooring", "Terrazzo Flooring", "Mosaic Flooring", "Vinyl Flooring", "SPC Flooring", "Wooden Laminate Flooring", "Engineered Wooden Flooring", "Carpet Flooring", "Rubber Flooring", "Sports Flooring", "Artificial Grass", "Raised Access Flooring", "Skirting", "Stair Tread", "Stair Riser", "Stair Nosing", "Floor Polishing", "Crystallization", "Floor Grinding"]),
  group("Tiling", "Tile sizes and types", tileTypes.flatMap((type) => tileSizes.map((size) => `${size} ${type} Tile`))),
  group("Tiling", "Tile installation activities", ["Floor-Tile Laying", "Wall-Tile Laying", "Tile-On-Tile Installation", "Dry-Cladding Installation", "Wet-Cladding Installation", "Cement-Mortar Fixing", "Adhesive Fixing", "Back-Buttering", "Levelling-Clip Installation", "Spacer Installation", "Tile Alignment", "Diagonal Laying", "Herringbone Laying", "Brick-Pattern Laying", "Checker Pattern", "Border Pattern", "Centre Pattern", "Book-Match Layout", "Floor Slope", "Bathroom Slope", "Balcony Slope", "Terrace Slope", "Skirting Tile", "Dado Tile", "Stair Tread And Riser Tile", "Tile Nosing", "Window Jamb Tile", "Window Sill Tile", "Door Jamb Tile", "Threshold Tile", "Plumbing Cut", "Electrical Cut", "Floor-Trap Cut", "Round Cut", "Core Cut", "L-Shape Cut", "U-Shape Cut", "45-Degree Mitre", "Edge Polishing", "Corner Profile", "Aluminium Profile", "Stainless-Steel Profile", "Brass Profile", "PVC Profile", "Grouting", "Epoxy Grouting", "Silicone Sealing", "Hollow-Tile Replacement", "Broken-Tile Replacement", "Tile Re-Fixing"]),
  group("Tiling", "Bathroom special tile work", ["Complete Bathroom Tiling", "Complete Bathroom Wall And Floor Tile", "Bathroom Wall Tile", "Bathroom Floor Tile", "Shower Niche", "Shampoo Niche", "Soap Niche", "Corner Niche", "Full-Width Niche", "LED Niche", "Niche Shelf", "Niche Border", "Niche Waterproofing", "Wall-Hung WC Boxing", "Concealed-Cistern Boxing", "Shower Ledge", "Shower Partition Base", "Shower Bench", "Floor-Trap Alignment", "Linear-Drain Tile Work", "Basin Backsplash", "Basin Counter Tile", "Quartz Basin Top", "Granite Basin Top", "Marble Basin Top", "Countertop Basin Cutout", "Under-Mount Basin Cutout", "Tap-Hole Cutting", "Bottle-Trap Opening", "Counter Edge Polishing", "Counter Support", "Counter Installation"]),
  group("Natural Stone", "Stone and countertop work", ["Granite Flooring", "Marble Flooring", "Kota Flooring", "Stone Wall Cladding", "Granite Kitchen Top", "Quartz Kitchen Top", "Marble Kitchen Top", "Sintered-Stone Top", "Solid-Surface Top", "Nano-White Top", "Basin Counter", "Reception Counter", "Bar Counter", "Service Counter", "Window Sill", "Door Threshold", "Door Frame Stone", "Stair Tread Stone", "Stair Riser Stone", "Stair Landing", "Lift Cladding", "Column Cladding", "Temple Stonework", "Stone Jali", "Stone Coping", "Stone Skirting", "Sink Cutout", "Hob Cutout", "Basin Cutout", "Tap Hole", "Drain Groove", "Drainer Groove", "Edge Polish", "Half-Round Edge", "Full-Round Edge", "Bevel Edge", "Chamfer Edge", "Waterfall Edge", "Mitre Edge", "Stone Joint Filling", "Stone Crack Repair", "Stone Polishing", "Stone Crystallization", "Stone Sealer Application"]),
  group("Waterproofing", "Waterproofing systems", ["Bathroom Waterproofing", "Toilet Waterproofing", "Sunken-Slab Waterproofing", "Balcony Waterproofing", "Terrace Waterproofing", "Podium Waterproofing", "Basement Waterproofing", "Retaining-Wall Waterproofing", "Water-Tank Waterproofing", "Swimming-Pool Waterproofing", "Planter-Box Waterproofing", "Kitchen Waterproofing", "Utility-Area Waterproofing", "Shaft Waterproofing", "Chajja Waterproofing", "Roof-Gutter Waterproofing", "Brick-Bat Coba", "Lime Coba", "Cementitious Coating", "Acrylic Coating", "PU Coating", "Polyurea Coating", "APP Membrane", "SBS Membrane", "HDPE Membrane", "PVC Membrane", "Liquid Membrane", "Crystalline Treatment", "Injection Grouting", "PU Injection", "Epoxy Injection", "Crack Filling", "Construction-Joint Treatment", "Expansion-Joint Treatment", "Pipe-Junction Treatment", "Corner Fillet", "Protective Screed", "Flood Test", "Pond Test", "Leakage Detection", "Waterproofing Repair", "Warranty Provision"]),
  group("POP", "POP surface and moulding", ["POP Wall Punning", "POP Ceiling Punning", "Column Finishing", "Beam Finishing", "Patra Panning", "Surface Levelling", "Crack Filling", "Corner Finishing", "POP Patch Repair", "Cornice", "Cove", "Moulding", "Ceiling Border", "Wall Border", "Square Moulding", "Rectangular Moulding", "Circular Moulding", "Arch Moulding", "Floral Moulding", "Customized Moulding", "Wall Frame Moulding", "Sofa-Wall Design", "Bed-Back Design", "TV-Wall Design", "Lamp-Panel Design", "Niche Formation", "Curtain Pelmet", "Curtain Pocket", "Profile-Light Groove", "LED-Strip Groove", "Shadow Gap"]),
  group("False Ceiling", "Gypsum and ceiling systems", ["Plain Gypsum Ceiling", "Single-Level Ceiling", "Double-Level Ceiling", "Multi-Level Ceiling", "Cove Ceiling", "Floating Ceiling", "Island Ceiling", "Circular Ceiling", "Curved Ceiling", "Coffered Ceiling", "Grid Ceiling", "Mineral-Fibre Ceiling", "Calcium-Silicate Ceiling", "Cement-Board Ceiling", "PVC Ceiling", "Acrylic Ceiling", "Wooden Ceiling", "Metal Ceiling", "Baffle Ceiling", "Stretch Ceiling", "Acoustic Ceiling", "Moisture-Resistant Ceiling", "Fire-Rated Ceiling", "Trapdoor", "Access Panel", "AC Access Panel", "Curtain Pocket", "Shadow Gap", "Profile-Light Channel", "Magnetic-Track Channel", "Speaker Cutout", "Detector Cutout", "Sprinkler Cutout", "Ceiling Repair", "Ceiling Dismantling"]),
  group("Carpentry", "Door work", ["Flush Door", "Plywood Door", "Solid-Wood Door", "Veneer Door", "Laminate Door", "Membrane Door", "PU-Finish Door", "WPC Door", "PVC Door", "Glass Door", "Sliding Door", "Pocket Door", "Folding Door", "Double-Leaf Door", "Main Entrance Door", "Fire-Rated Door", "Acoustic Door", "Door Frame", "Door Lining", "Architrave", "Door Jamb", "Door Stopper", "Door Closer", "Mortise Lock", "Digital Lock", "Tower Bolt", "Aldrop", "Peephole", "Door Seal", "Door Polishing", "Door Laminate Replacement", "Door Repair", "Door Alignment"]),
  group("Furniture", "Wardrobe work", ["Hinged Wardrobe", "Sliding Wardrobe", "Walk-In Wardrobe", "Corner Wardrobe", "Loft", "Open Shelf", "Drawer", "Internal Partition", "Hanging Section", "Trouser Rack", "Shoe Rack", "Jewellery Drawer", "Mirror Shutter", "Glass Shutter", "Fluted Shutter", "Cane Shutter", "Laminate Finish", "Acrylic Finish", "Veneer Finish", "PU Finish", "Fabric Finish", "Profile-Handle Shutter", "Handle-Less Shutter", "Soft-Close Hinge", "Soft-Close Channel", "Sensor Light", "Wardrobe LED", "Lock Installation"]),
  group("Modular Kitchen", "Kitchen cabinets and accessories", ["Base Cabinet", "Wall Cabinet", "Tall Unit", "Pantry Unit", "Loft Cabinet", "Sink Unit", "Hob Unit", "Chimney Unit", "Microwave Unit", "Oven Unit", "Refrigerator Side Panel", "Dishwasher Unit", "Washing-Machine Unit", "Breakfast Counter", "Island Counter", "Peninsula Counter", "Tandem Drawer", "Cutlery Drawer", "Bottle Pull-Out", "Grain Basket", "Thali Basket", "Corner Carousel", "Magic Corner", "Wicker Basket", "Lift-Up Shutter", "Rolling Shutter", "Glass Shutter", "Profile Shutter", "Handle-Less Channel", "Skirting", "Pelmet", "Counter Support", "Backsplash Panel", "Under-Cabinet Light"]),
  group("Furniture", "Other furniture", ["TV Unit", "Floating TV Unit", "TV Back Panel", "Crockery Unit", "Bar Unit", "Study Table", "Office Table", "Reception Counter", "Side Table", "Bed", "Hydraulic Bed", "Storage Bed", "Headboard", "Upholstered Headboard", "Dressing Table", "Mirror Unit", "Shoe Rack", "Bookshelf", "Temple Unit", "Window Seating", "Bench", "Storage Bench", "Partition", "Fluted-Panel Wall", "Veneer Wall Panel", "Laminate Wall Panel", "Acoustic Wall Panel", "Decorative Jali", "CNC Panel", "Service Counter", "Retail Display", "Cash Counter", "Complete 2BHK Interior Estimate", "Complete 3BHK Interior Estimate"]),
  group("Painting", "Painting and decorative finishes", ["Wall Putty", "Cement Primer", "Acrylic Primer", "Interior Emulsion", "Exterior Emulsion", "Premium Emulsion", "Luxury Emulsion", "Luster Paint", "Enamel Paint", "Texture Paint", "Sand Texture", "Roller Texture", "Stone Texture", "Stucco", "Microcement", "Lime Wash", "Whitewash", "Distemper", "Waterproof Coating", "Damp-Proof Coating", "Anti-Fungal Coating", "Epoxy Coating", "PU Coating", "Floor Paint", "Road-Marking Paint", "Metal Primer", "Red-Oxide Primer", "Wood Primer", "Melamine Polish", "PU Polish", "French Polish", "Duco Paint", "Spray Paint", "Touch-Up Work", "Crack Filling", "Wall Sanding", "Paint Scraping", "Old-Paint Removal", "Wallpaper Removal", "Wallpaper Installation", "Fabric Wallpaper", "Vinyl Wallpaper", "Decorative Stencil", "Wall Mural Installation"]),
  group("Plumbing", "Plumbing and sanitary", ["Water Inlet", "Hot-Water Line", "Cold-Water Line", "Return-Water Line", "Concealed Plumbing", "Open Plumbing", "CPVC Line", "UPVC Line", "PVC Line", "PPR Line", "GI Line", "Copper Line", "Soil Line", "Waste Line", "Rainwater Line", "Vent Line", "Floor Trap", "Nahani Trap", "P Trap", "S Trap", "Bottle Trap", "Gully Trap", "Inspection Chamber", "Manhole", "Grease Trap", "Linear Drain", "Channel Drain", "Water Meter", "Pressure Pump", "Booster Pump", "Sump Pump", "Overhead Tank", "Underground Tank", "Solar-Water Line", "Geyser Connection", "Washing-Machine Point", "Dishwasher Point", "Refrigerator-Water Point", "RO Point", "Kitchen Sink", "Basin", "Counter Basin", "Under-Counter Basin", "Wall-Hung Basin", "Pedestal Basin", "WC Installation", "Wall-Hung WC", "Floor-Mounted WC", "Concealed Cistern", "Flush Valve", "Health Faucet", "Shower", "Hand Shower", "Rain Shower", "Diverter", "Mixer", "Spout", "Bathtub", "Jacuzzi", "Urinal", "Angle Valve", "Stop Cock", "Bib Cock", "Basin Mixer", "Sink Mixer", "Plumbing Testing", "Pressure Testing", "Leakage Repair", "Drain Blockage Cleaning"]),
  group("Electrical", "Electrical and lighting", ["Concealed Conduit", "Surface Conduit", "Wall Chasing", "Ceiling Conduit", "Floor Conduit", "Light Point", "Half Point", "Loop Point", "Switch Point", "Socket Point", "6A Socket", "16A Socket", "20A Socket", "AC Point", "Geyser Point", "Refrigerator Point", "Microwave Point", "Oven Point", "Dishwasher Point", "Washing-Machine Point", "Chimney Point", "Exhaust Point", "Fan Point", "Ceiling Fan Installation", "Wall Fan", "Exhaust Fan", "Chandelier Point", "Chandelier Installation", "Pendant Light", "Wall Light", "Picture Light", "Spot Light", "COB Light", "Panel Light", "Track Light", "Magnetic Track", "LED-Strip Point", "Profile Light", "Cove Light", "Foot Light", "Mirror Light", "Garden Light", "Gate Light", "Street Light", "Emergency Light", "Inverter Point", "UPS Point", "Generator Connection", "DB Installation", "MCB Installation", "RCCB", "RCBO", "Isolator", "Changeover", "Earthing", "Lightning Arrester", "Main Cable", "Sub-Main Cable", "Cable Tray", "Cable Trunking", "Cable Termination", "TV Point", "DTH Point", "LAN Point", "Telephone Point", "HDMI Point", "USB Point", "CCTV Point", "Video-Door-Phone", "Doorbell", "Access Control", "Biometric System", "Smart Switch", "Home Automation", "Motion Sensor", "Occupancy Sensor", "Smoke Detector", "Heat Detector", "Fire-Alarm Point", "Electrical Testing", "Load Calculation"]),
  group("HVAC", "HVAC and ventilation", ["Split-AC Installation", "Cassette-AC Installation", "Ductable AC", "VRV Or VRF System", "AC Copper Piping", "AC Drain Piping", "AC Electrical Point", "AC Core Cutting", "Outdoor-Unit Bracket", "Outdoor-Unit Stand", "AC Sleeve", "AC Insulation", "Duct Fabrication", "Duct Installation", "Flexible Duct", "Grille Installation", "Diffuser Installation", "Exhaust Duct", "Fresh-Air Duct", "Kitchen Exhaust", "Toilet Exhaust", "Ventilation Fan", "AC Servicing", "AC Dismantling", "AC Shifting", "AC Gas Charging"]),
  group("Aluminium", "Aluminium glass and uPVC", ["Aluminium Sliding Window", "Openable Window", "Fixed Window", "Casement Window", "Top-Hung Window", "Louvred Window", "Mosquito Mesh", "Sliding Door", "Folding Door", "Partition", "Office Cabin", "Shopfront", "ACP Partition", "Glass Partition", "Toughened-Glass Door", "Shower Partition", "Shower Enclosure", "Glass Railing", "Glass Canopy", "Mirror Fixing", "Bevelled Mirror", "Tinted Glass", "Frosted Glass", "Laminated Glass", "Double-Glazed Glass", "Acoustic Glass", "Fire-Rated Glass", "Spider Glazing", "Structural Glazing", "Silicone Sealing", "Glass Cutout", "Glass Edge Polishing", "Patch Fitting", "Floor Spring", "Door Closer", "uPVC Window", "uPVC Door", "Window Repair", "Roller Replacement", "Lock Replacement"]),
  group("Fabrication", "Fabrication and metal work", ["MS Gate", "SS Gate", "Sliding Gate", "Folding Gate", "Compound Gate", "MS Railing", "SS Railing", "Glass Railing Frame", "Stair Railing", "Balcony Railing", "Window Grill", "Safety Door", "Loft Frame", "Mezzanine Floor", "Steel Staircase", "Spiral Staircase", "Ladder", "Shed Structure", "Canopy", "Pergola", "Truss", "Purlin", "Roofing Frame", "Solar-Panel Structure", "Tank Platform", "AC Outdoor-Unit Cage", "Kitchen Rack", "Storage Rack", "Platform Support", "Counter Support", "Angle Frame", "Box-Section Frame", "Channel Frame", "Welding", "Gas Cutting", "Grinding", "Rust Removal", "Red-Oxide Coating", "Enamel Coating", "Powder Coating", "Galvanizing"]),
  group("Roofing", "Roofing and external works", ["Cement-Sheet Roofing", "GI-Sheet Roofing", "Colour-Coated Roofing", "Polycarbonate Roofing", "Mangalore-Tile Roofing", "Shingle Roofing", "Metal Deck Roofing", "Sandwich-Panel Roofing", "Roof Insulation", "Heat-Reflective Coating", "Gutter", "Downpipe", "Flashing", "Ridge", "Valley Gutter", "Roof Repair", "Paver Block", "Kerb Stone", "Compound Wall", "Drain", "Stormwater Drain", "Road Work", "Concrete Road", "Asphalt Road", "Landscaping", "Lawn", "Plantation", "Planter", "Irrigation Line", "Garden Lighting", "Borewell Work", "Rainwater Harvesting", "Septic Tank", "Soak Pit", "Security Cabin", "Main Gate", "Name Board"]),
  group("Elevation", "Elevation and facade", ["Exterior Plaster", "Exterior Texture", "Exterior Paint", "Stone Cladding", "Tile Cladding", "Brick Cladding", "ACP Cladding", "HPL Cladding", "WPC Cladding", "Louvers", "Vertical Fins", "Glass Facade", "Structural Glazing", "Curtain Wall", "Exterior Moulding", "Exterior Groove", "Exterior Cornice", "GRC Jali", "GRC Moulding", "FRP Moulding", "Pergola", "Canopy", "Signage", "Facade Lighting", "Rope-Access Work", "Scaffolding Work"]),
  group("Fire Fighting", "Fire, security and low-voltage", ["Fire Sprinkler", "Fire Hydrant", "Fire Hose Reel", "Fire Extinguisher", "Fire-Alarm Panel", "Smoke Detector", "Heat Detector", "Manual Call Point", "Hooter", "Emergency Light", "Exit Sign", "CCTV Camera", "NVR", "DVR", "Data Rack", "Access Control", "Biometric Reader", "Video-Door-Phone", "Intercom", "Intrusion Alarm", "Public-Address System", "Wi-Fi Access Point", "Network Cabling", "Server-Rack Installation"]),
  group("Repair Maintenance", "Repair and maintenance", ["Leakage Repair", "Plumbing Repair", "Electrical Fault Finding", "Tile Replacement", "Hollow-Tile Repair", "Marble Crack Repair", "Granite Repair", "Plaster Repair", "POP Repair", "Ceiling Repair", "Furniture Repair", "Door Alignment", "Window Repair", "Waterproofing Repair", "Terrace Repair", "Expansion-Joint Repair", "Structural Crack Repair", "Column Repair", "Beam Repair", "Slab Leakage Repair", "Painting Touch-Up", "Silicone Replacement", "Grout Replacement", "Deep Cleaning", "Annual Maintenance Contract"]),
  group("Cleaning Handover", "Cleaning and handover", ["Rough Cleaning", "Deep Cleaning", "Tile Cleaning", "Cement-Stain Cleaning", "Glass Cleaning", "Wood Cleaning", "Paint-Mark Cleaning", "Bathroom Cleaning", "Kitchen Cleaning", "Floor Polishing", "Marble Polishing", "Granite Polishing", "Debris Removal", "Protective-Film Removal", "Snag Inspection", "Snag Rectification", "Plumbing Testing", "Electrical Testing", "Waterproofing Testing", "Door And Drawer Alignment", "Final Measurement", "Final BOQ Reconciliation", "Client Handover", "Warranty-Document Preparation"]),
  group("Labour Supply", "Trade labour supply", ["Mason Labour", "Helper Labour", "Carpenter Labour", "Electrician Labour", "Painter Labour", "Plumber Labour", "POP Worker Labour", "Tile Mason Labour", "Waterproofing Worker Labour", "Fabricator Labour", "Cleaner Labour", "Supervisor Day Charge", "Engineer Visit", "Night Shift Labour", "Emergency Labour"])
];

function group(category: RateCategory, subcategory: string, items: string[], override: Partial<WorkGroup> = {}): WorkGroup {
  const profile = { ...defaultProfile, ...(profileOverrides[category] || {}) };
  return {
    category,
    subcategory,
    unit: override.unit || profile.unit,
    labourStandard: override.labourStandard || profile.labourStandard,
    materialStandard: override.materialStandard ?? profile.materialStandard,
    productivity: override.productivity || profile.productivity,
    skilled: override.skilled ?? profile.skilled,
    helpers: override.helpers ?? profile.helpers,
    machine: override.machine || profile.machine,
    formula: override.formula || profile.formula,
    materialFormula: override.materialFormula || profile.materialFormula,
    tools: override.tools || profile.tools,
    sequence: override.sequence || profile.sequence,
    checklist: override.checklist || profile.checklist,
    exclusions: override.exclusions || profile.exclusions,
    warranty: override.warranty || profile.warranty,
    completion: override.completion || profile.completion,
    qualityGrade: override.qualityGrade || profile.qualityGrade,
    brand: override.brand || profile.brand,
    gst: override.gst ?? profile.gst,
    wastage: override.wastage ?? profile.wastage,
    minQty: override.minQty || profile.minQty,
    aliases: [...(profile.aliases || []), ...(override.aliases || [])],
    items
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleWords(value: string) {
  return value
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function complexityFactor(name: string) {
  const value = name.toLowerCase();
  let factor = 1;
  if (/luxury|premium|italian|book|large|1200|2400|sintered|quartz|polyurea|pu|vrv|automation|smart|structural|fire|acoustic|glass/.test(value)) factor += 0.35;
  if (/cut|core|niche|mitre|edge|polish|repair|replacement|testing|alignment|shifting|dismantling|controlled|rope/.test(value)) factor += 0.18;
  if (/basic|plain|rough|manual|helper|cleaning/.test(value)) factor -= 0.08;
  return Math.max(0.72, factor);
}

function makeBand(standard: number): RateBand {
  return {
    low: Math.max(0, Math.round(standard * 0.82)),
    standard: Math.round(standard),
    premium: Math.round(standard * 1.22)
  };
}

function makeMatrix(labourStandard: number, materialStandard: number, factor: number): RateMatrix {
  const labour = Math.round(labourStandard * factor);
  const material = Math.round(materialStandard * factor);
  const standard = labour + material;
  return {
    lowest: Math.round(standard * 0.82),
    standard,
    premium: Math.round(standard * 1.22),
    luxury: Math.round(standard * 1.58),
    contractor: Math.round(standard * 1.08),
    architect: Math.round(standard * 1.35),
    builder: Math.round(standard * 0.95),
    labourOnly: labour,
    materialOnly: material,
    labourMaterial: standard,
    governmentSchedule: Math.round(standard * 0.9)
  };
}

function aliasesFor(name: string, groupConfig: WorkGroup) {
  const normalized = name.toLowerCase().replace(/-/g, " ");
  const parts = normalized.split(/\s+/).filter((part) => part.length > 2);
  return Array.from(new Set([normalized, ...parts, ...groupConfig.aliases, groupConfig.subcategory.toLowerCase(), groupConfig.category.toLowerCase()]));
}

function rateHistory(city: string, standardRate: number): RateHistoryPoint[] {
  return [
    { date: "2026-01-01", city, standardRate: Math.round(standardRate * 0.94), source: "seed" },
    { date: rateValidityDate, city, standardRate, source: "market_reference" }
  ];
}

function detailsFor(item: Pick<RateItem, "category" | "work" | "unit" | "rates" | "aliases">, groupConfig: WorkGroup): RateItemDetails {
  const demolition = item.category === "Demolition";
  const labourBand = makeBand(item.rates.labourOnly);
  const materialBand = makeBand(item.rates.materialOnly);
  const completeBand = makeBand(item.rates.labourMaterial);
  const transportCost = Math.round(item.rates.standard * (item.unit === "trip" ? 0.12 : 0.03));
  const loadingUnloadingCost = Math.round(item.rates.standard * (demolition ? 0.1 : 0.025));
  const debrisCost = demolition ? Math.round(item.rates.standard * 0.18) : 0;
  const demolitionCost = demolition ? Math.round(item.rates.labourOnly * 0.65) : 0;
  const salvageValue = demolition && /wood|door|window|glass|sanitary|wiring|granite|marble/i.test(item.work) ? Math.round(item.rates.standard * 0.08) : 0;

  return {
    subcategory: groupConfig.subcategory,
    detailedSpecification: `${item.work} with ${groupConfig.qualityGrade.toLowerCase()} workmanship, measured by ${groupConfig.formula.toLowerCase()}.`,
    commonAlternativeNames: item.aliases,
    measurementFormula: groupConfig.formula,
    minimumCharge: Math.max(Math.round(item.rates.standard * groupConfig.minQty), item.rates.standard),
    labourOnly: labourBand,
    materialOnly: materialBand,
    labourPlusMaterial: completeBand,
    subcontractorRate: Math.round(item.rates.standard * 0.86),
    contractorCostRate: Math.round(item.rates.standard * 0.78),
    recommendedCustomerRate: Math.round(item.rates.standard * 1.18),
    architectQuotationRate: item.rates.architect,
    builderQuotationRate: item.rates.builder,
    luxuryProjectRate: item.rates.luxury,
    workerProductivityPerDay: Math.max(1, Math.round(groupConfig.productivity / complexityFactor(item.work))),
    skilledWorkersRequired: groupConfig.skilled,
    helpersRequired: groupConfig.helpers,
    machineRequired: groupConfig.machine,
    materialConsumptionFormula: groupConfig.materialFormula,
    materialWastagePercentage: groupConfig.wastage,
    transportCost,
    loadingUnloadingCost,
    heightCharge: Math.round(item.rates.standard * 0.12),
    smallQuantitySurcharge: Math.round(item.rates.standard * 0.15),
    difficultAccessSurcharge: Math.round(item.rates.standard * 0.18),
    demolitionCost,
    debrisCost,
    salvageValue,
    supervisionPercentage: 4,
    contractorOverhead: 6,
    profitPercentage: item.category === "Labour Supply" ? 10 : 18,
    gst: groupConfig.gst,
    rateValidityDate,
    city: "Pune",
    areaOrLocality: "Base city profile",
    brand: groupConfig.brand,
    qualityGrade: groupConfig.qualityGrade,
    notes: "Indicative market planning rate. Confirm material brand, site access, quantity, height, design complexity and current labour availability before final quotation.",
    exclusions: groupConfig.exclusions,
    warranty: groupConfig.warranty,
    workSequence: groupConfig.sequence,
    qualityChecklist: groupConfig.checklist,
    commonMistakes: ["Not checking site access", "Under-counting wastage", "Not separating labour and material", "Forgetting transport or loading charges"],
    requiredTools: groupConfig.tools,
    completionTime: groupConfig.completion,
    beforeWorkPhotographs: ["Existing condition", "Measurement reference", "Hidden damage if any"],
    afterWorkPhotographs: ["Finished work", "Close-up quality proof", "Area completion proof"],
    rateHistory: rateHistory("Pune", item.rates.standard)
  };
}

function makeItem(groupConfig: WorkGroup, itemName: string, index: number): RateItem {
  const work = titleWords(itemName);
  const factor = complexityFactor(work) + Math.min(index % 5, 4) * 0.025;
  const rates = makeMatrix(groupConfig.labourStandard, groupConfig.materialStandard, factor);
  const aliases = aliasesFor(work, groupConfig);
  const item: RateItem = {
    id: `${slugify(groupConfig.category)}-${slugify(groupConfig.subcategory)}-${slugify(work)}`,
    category: groupConfig.category,
    subcategory: groupConfig.subcategory,
    work,
    specification: `${groupConfig.subcategory}: ${work}`,
    unit: groupConfig.unit,
    aliases,
    rates,
    scope: [groupConfig.subcategory, groupConfig.formula, groupConfig.materialFormula],
    caution: "Use as an estimating rate. Final quotation should be confirmed after measurement, material brand and site-condition check."
  };
  return { ...item, details: detailsFor(item, groupConfig) };
}

function legacyDetails(item: RateItem): RateItemDetails {
  const profile = { ...defaultProfile, ...(profileOverrides[item.category] || {}) };
  const fallbackGroup = group(item.category, item.subcategory || "Curated common rate", [], profile);
  return detailsFor(
    {
      category: item.category,
      work: item.work,
      unit: item.unit,
      rates: item.rates,
      aliases: item.aliases
    },
    fallbackGroup
  );
}

const generatedItems = workGroups.flatMap((workGroup) => workGroup.items.map((name, index) => makeItem(workGroup, name, index)));

const deduped = new Map<string, RateItem>();
for (const item of [...curatedRateCatalog, ...generatedItems]) {
  const key = item.id;
  deduped.set(key, item.details ? item : { ...item, details: legacyDetails(item), subcategory: item.subcategory || "Curated common rate", specification: item.specification || item.work });
}

export const expandedRateCatalog = Array.from(deduped.values()).sort((a, b) => {
  const categoryOrder = rateCategories.indexOf(a.category) - rateCategories.indexOf(b.category);
  return categoryOrder || (a.subcategory || "").localeCompare(b.subcategory || "") || a.work.localeCompare(b.work);
});

export const constructionRateStats = {
  itemCount: expandedRateCatalog.length,
  categoryCount: new Set(expandedRateCatalog.map((item) => item.category)).size,
  subcategoryCount: new Set(expandedRateCatalog.map((item) => item.details?.subcategory || item.subcategory || "")).size
};

export function searchRateDatabase(query: string, limit = 20) {
  const terms = query
    .toLowerCase()
    .replace(/by/g, "x")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  if (!terms.length) return expandedRateCatalog.slice(0, limit);

  const genericTerms = new Set(["labour", "labor", "charge", "rate", "cost", "price", "with", "complete", "for", "only", "work"]);
  const containsTerm = (text: string, term: string) => {
    if (term.length <= 2) return new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(text);
    return text.includes(term);
  };

  return expandedRateCatalog
    .map((item) => {
      const workText = [item.work, item.subcategory, item.specification].filter(Boolean).join(" ").toLowerCase();
      const aliasText = [...item.aliases, ...(item.details?.commonAlternativeNames || [])].join(" ").toLowerCase();
      const detailText = [item.category, item.unit, item.details?.detailedSpecification, item.details?.materialConsumptionFormula].filter(Boolean).join(" ").toLowerCase();
      const haystack = [workText, aliasText, detailText]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const normalizedQuery = query.toLowerCase().trim();
      const phraseScore = haystack.includes(normalizedQuery) ? 18 : 0;
      const packageScore =
        /complete\s+bathroom|bathroom\s+complete/.test(normalizedQuery) && workText.includes("complete bathroom")
          ? 24
          : /complete\s+(?:2bhk|3bhk|interior)|(?:2bhk|3bhk)\s+interior/.test(normalizedQuery) && workText.includes("interior estimate")
            ? 18
            : 0;
      const categoryScore =
        /(?:tile|tiling|dado)/.test(normalizedQuery) && item.category === "Tiling"
          ? 10
          : /(?:waterproof|leakage|membrane|coating)/.test(normalizedQuery) && (item.category === "Waterproofing" || item.category === "Waterproof Coating")
            ? 10
            : /(?:paint|painting|putty|primer)/.test(normalizedQuery) && item.category === "Painting"
              ? 10
              : /(?:pop|ceiling|cove|gypsum)/.test(normalizedQuery) && (item.category === "POP" || item.category === "False Ceiling")
                ? 10
                : /(?:electrical|wire|wiring|point|switch|mcb)/.test(normalizedQuery) && item.category === "Electrical"
                  ? 10
                  : 0;
      const bathroomTileScore =
        /(?:bathroom|toilet|washroom)/.test(normalizedQuery) && /(?:tile|tiling|dado)/.test(normalizedQuery) && /(?:complete bathroom|bathroom wall tile|2x4 wall tile)/.test(haystack)
          ? 20
          : 0;
      const genericSystemScore = /waterproof/.test(normalizedQuery) && workText.includes("waterproof") ? 14 : 0;
      const score = terms.reduce((sum, term) => {
        const genericWeight = genericTerms.has(term) ? 0.25 : 1;
        if (containsTerm(workText, term)) return sum + 4 * genericWeight;
        if (containsTerm(aliasText, term)) return sum + 2 * genericWeight;
        if (containsTerm(detailText, term)) return sum + 1 * genericWeight;
        return sum;
      }, phraseScore + packageScore + categoryScore + bathroomTileScore + genericSystemScore);
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.item.rates.standard - a.item.rates.standard)
    .slice(0, limit)
    .map((entry) => entry.item);
}
