export type RateCategory =
  | "Site Preparation"
  | "Demolition"
  | "Excavation"
  | "Civil Work"
  | "RCC Work"
  | "Reinforcement Steel"
  | "Formwork"
  | "Brick Work"
  | "Plaster"
  | "Flooring"
  | "POP"
  | "False Ceiling"
  | "Electrical"
  | "Plumbing"
  | "HVAC"
  | "Waterproofing"
  | "Tiling"
  | "Natural Stone"
  | "Granite"
  | "Marble"
  | "Fabrication"
  | "Painting"
  | "Aluminium"
  | "Glass"
  | "Carpentry"
  | "Furniture"
  | "Modular Kitchen"
  | "Door & Window"
  | "PVC Work"
  | "ACP Work"
  | "Roofing"
  | "External Works"
  | "Elevation"
  | "Low Voltage"
  | "Fire Fighting"
  | "Waterproof Coating"
  | "Repair Maintenance"
  | "Cleaning Handover"
  | "Interior Work"
  | "Exterior Work"
  | "Labour Supply";

export type RateUnit = "sqft" | "rft" | "point" | "nos" | "day" | "kg" | "ton" | "cum" | "visit" | "trip" | "lot" | "hour" | "meter" | "litre" | "set";

export type RateMatrix = {
  lowest: number;
  standard: number;
  premium: number;
  luxury: number;
  contractor: number;
  architect: number;
  builder: number;
  labourOnly: number;
  materialOnly: number;
  labourMaterial: number;
  governmentSchedule?: number;
};

export type RateItem = {
  id: string;
  category: RateCategory;
  subcategory?: string;
  work: string;
  specification?: string;
  unit: RateUnit;
  aliases: string[];
  rates: RateMatrix;
  scope: string[];
  caution?: string;
  details?: RateItemDetails;
};

export type RateBand = {
  low: number;
  standard: number;
  premium: number;
};

export type RateHistoryPoint = {
  date: string;
  city: string;
  standardRate: number;
  source: "seed" | "custom" | "market_reference";
};

export type RateItemDetails = {
  subcategory: string;
  detailedSpecification: string;
  commonAlternativeNames: string[];
  measurementFormula: string;
  minimumCharge: number;
  labourOnly: RateBand;
  materialOnly: RateBand;
  labourPlusMaterial: RateBand;
  subcontractorRate: number;
  contractorCostRate: number;
  recommendedCustomerRate: number;
  architectQuotationRate: number;
  builderQuotationRate: number;
  luxuryProjectRate: number;
  workerProductivityPerDay: number;
  skilledWorkersRequired: number;
  helpersRequired: number;
  machineRequired: string;
  materialConsumptionFormula: string;
  materialWastagePercentage: number;
  transportCost: number;
  loadingUnloadingCost: number;
  heightCharge: number;
  smallQuantitySurcharge: number;
  difficultAccessSurcharge: number;
  demolitionCost: number;
  debrisCost: number;
  salvageValue: number;
  supervisionPercentage: number;
  contractorOverhead: number;
  profitPercentage: number;
  gst: number;
  rateValidityDate: string;
  city: string;
  areaOrLocality: string;
  brand: string;
  qualityGrade: string;
  notes: string;
  exclusions: string[];
  warranty: string;
  workSequence: string[];
  qualityChecklist: string[];
  commonMistakes: string[];
  requiredTools: string[];
  completionTime: string;
  beforeWorkPhotographs: string[];
  afterWorkPhotographs: string[];
  rateHistory: RateHistoryPoint[];
};

export const rateCategories: RateCategory[] = [
  "Site Preparation",
  "Demolition",
  "Excavation",
  "Civil Work",
  "RCC Work",
  "Reinforcement Steel",
  "Formwork",
  "Brick Work",
  "Plaster",
  "Flooring",
  "POP",
  "False Ceiling",
  "Electrical",
  "Plumbing",
  "HVAC",
  "Waterproofing",
  "Tiling",
  "Natural Stone",
  "Granite",
  "Marble",
  "Fabrication",
  "Painting",
  "Aluminium",
  "Glass",
  "Carpentry",
  "Furniture",
  "Modular Kitchen",
  "Door & Window",
  "PVC Work",
  "ACP Work",
  "Roofing",
  "External Works",
  "Elevation",
  "Low Voltage",
  "Fire Fighting",
  "Waterproof Coating",
  "Repair Maintenance",
  "Cleaning Handover",
  "Interior Work",
  "Exterior Work",
  "Labour Supply"
];

function matrix(lowest: number, standard: number, premium: number, luxury: number, labourOnly: number, materialOnly: number, governmentSchedule?: number): RateMatrix {
  return {
    lowest,
    standard,
    premium,
    luxury,
    contractor: Math.round(standard * 1.08),
    architect: Math.round(premium * 1.15),
    builder: Math.round(standard * 0.95),
    labourOnly,
    materialOnly,
    labourMaterial: standard,
    governmentSchedule
  };
}

export const defaultRateCatalog: RateItem[] = [
  {
    id: "civil-excavation",
    category: "Civil Work",
    work: "Manual Excavation",
    unit: "cum",
    aliases: ["digging", "foundation excavation", "earthwork"],
    rates: matrix(450, 650, 850, 1100, 500, 120),
    scope: ["Manual labour", "Normal soil", "Lead within site"]
  },
  {
    id: "civil-pcc",
    category: "Civil Work",
    work: "PCC Bed",
    unit: "sqft",
    aliases: ["plain cement concrete", "pcc flooring"],
    rates: matrix(75, 95, 125, 160, 22, 73),
    scope: ["Concrete mix", "Levelling", "Labour and basic curing"]
  },
  {
    id: "civil-site-cleaning",
    category: "Civil Work",
    work: "Site Cleaning",
    unit: "sqft",
    aliases: ["cleaning", "debris cleaning", "housekeeping"],
    rates: matrix(3, 5, 8, 12, 4, 1),
    scope: ["Daily cleaning", "Debris stacking", "Basic hand tools"]
  },
  {
    id: "rcc-slab",
    category: "RCC Work",
    work: "RCC Slab Concrete",
    unit: "sqft",
    aliases: ["slab", "rcc slab", "roof slab"],
    rates: matrix(210, 260, 325, 420, 70, 190),
    scope: ["Concrete", "Pouring labour", "Vibration", "Normal shuttering support"],
    caution: "Steel, pump and design grade can change rates sharply."
  },
  {
    id: "rcc-shuttering",
    category: "RCC Work",
    work: "Slab Shuttering Labour",
    unit: "sqft",
    aliases: ["centering", "formwork", "shuttering"],
    rates: matrix(55, 75, 95, 125, 75, 0),
    scope: ["Labour for fixing and removing shuttering", "Normal height"]
  },
  {
    id: "rcc-steel-binding",
    category: "RCC Work",
    work: "Steel Binding",
    unit: "kg",
    aliases: ["bar bending", "rebar tying", "steel fixing"],
    rates: matrix(8, 12, 16, 22, 12, 0),
    scope: ["Cutting", "Bending", "Tying", "Binding wire labour"]
  },
  {
    id: "brick-red-brick",
    category: "Brick Work",
    work: "Red Brick Masonry",
    unit: "sqft",
    aliases: ["brick wall", "masonry", "red brick"],
    rates: matrix(95, 125, 155, 210, 35, 90),
    scope: ["Brick wall", "Mortar", "Labour", "Line and level"]
  },
  {
    id: "brick-aac-block",
    category: "Brick Work",
    work: "AAC Block Masonry",
    unit: "sqft",
    aliases: ["aac", "block wall", "siporex"],
    rates: matrix(105, 140, 175, 225, 32, 108),
    scope: ["AAC blocks", "Adhesive", "Labour"]
  },
  {
    id: "plaster-internal",
    category: "Plaster",
    work: "Internal Cement Plaster 12mm",
    unit: "sqft",
    aliases: ["internal plaster", "wall plaster", "cement plaster"],
    rates: matrix(25, 35, 45, 60, 15, 20),
    scope: ["Cement", "Sand", "Labour", "Basic curing"]
  },
  {
    id: "plaster-external",
    category: "Plaster",
    work: "External Cement Plaster 15-20mm",
    unit: "sqft",
    aliases: ["external plaster", "outside plaster", "sandface"],
    rates: matrix(30, 45, 60, 80, 20, 25),
    scope: ["Richer mix", "Curing", "Labour", "Normal access"],
    caution: "Scaffolding and height may add extra cost."
  },
  {
    id: "plaster-waterproof",
    category: "Plaster",
    work: "Waterproof Plaster",
    unit: "sqft",
    aliases: ["waterproof plaster", "bathroom plaster", "polymer plaster"],
    rates: matrix(45, 65, 85, 115, 24, 41),
    scope: ["Cement", "Sand", "Waterproof compound", "Labour"]
  },
  {
    id: "pop-ceiling",
    category: "POP",
    work: "POP False Ceiling",
    unit: "sqft",
    aliases: ["pop ceiling", "false ceiling", "pop"],
    rates: matrix(75, 105, 145, 220, 35, 70),
    scope: ["POP", "GI/basic support", "Screws", "Labour", "Simple design"],
    caution: "Designer drops, lights and curves need separate pricing."
  },
  {
    id: "pop-wall-punning",
    category: "POP",
    work: "POP Wall Punning",
    unit: "sqft",
    aliases: ["wall punning", "punning", "pop wall"],
    rates: matrix(18, 28, 42, 60, 13, 15),
    scope: ["POP material", "Surface finishing", "Labour"]
  },
  {
    id: "pop-cornice",
    category: "POP",
    work: "POP Cornice",
    unit: "rft",
    aliases: ["cornice", "moulding", "border"],
    rates: matrix(80, 120, 180, 260, 55, 65),
    scope: ["Ready or cast cornice", "Fixing", "Finishing"]
  },
  {
    id: "false-gypsum",
    category: "False Ceiling",
    work: "Gypsum False Ceiling",
    unit: "sqft",
    aliases: ["gypsum", "gyproc", "board ceiling"],
    rates: matrix(95, 125, 165, 230, 38, 87),
    scope: ["Gypsum board", "GI channel", "Joint tape", "Labour"]
  },
  {
    id: "false-pvc",
    category: "False Ceiling",
    work: "PVC False Ceiling",
    unit: "sqft",
    aliases: ["pvc ceiling", "bathroom ceiling"],
    rates: matrix(110, 160, 185, 240, 35, 125),
    scope: ["PVC panels", "Frame", "Labour"]
  },
  {
    id: "false-grid",
    category: "False Ceiling",
    work: "Grid Ceiling",
    unit: "sqft",
    aliases: ["grid ceiling", "office ceiling", "armstrong"],
    rates: matrix(90, 130, 170, 240, 32, 98),
    scope: ["T-grid", "Tiles", "Suspension", "Labour"]
  },
  {
    id: "tile-floor",
    category: "Tiling",
    work: "Floor Tile Laying",
    unit: "sqft",
    aliases: ["floor tile", "tile flooring", "tiles"],
    rates: matrix(90, 150, 210, 320, 40, 110),
    scope: ["Tile adhesive or mortar", "Labour", "Grout", "Cleaning"]
  },
  {
    id: "tile-wall-2x4",
    category: "Tiling",
    work: "2x4 Wall Tile",
    unit: "sqft",
    aliases: ["2x4 tile", "bathroom wall tile", "wall tile", "dado"],
    rates: matrix(145, 180, 230, 290, 45, 135),
    scope: ["2x4 tile", "Adhesive", "Grout", "Labour", "Normal pattern"]
  },
  {
    id: "tile-highlighter",
    category: "Tiling",
    work: "Highlighter Tile",
    unit: "sqft",
    aliases: ["highlight tile", "decor tile", "bathroom highlight"],
    rates: matrix(165, 220, 300, 420, 60, 160),
    scope: ["Careful setting", "Adhesive", "Grout", "Labour"]
  },
  {
    id: "granite-platform",
    category: "Granite",
    work: "Granite Kitchen Platform",
    unit: "sqft",
    aliases: ["kitchen platform", "granite counter", "countertop"],
    rates: matrix(450, 700, 950, 1400, 120, 580),
    scope: ["Granite", "Cutting", "Polishing edge", "Labour"]
  },
  {
    id: "granite-stair",
    category: "Granite",
    work: "Granite Staircase",
    unit: "sqft",
    aliases: ["staircase granite", "steps granite"],
    rates: matrix(380, 620, 900, 1350, 130, 490),
    scope: ["Granite", "Riser/tread fitting", "Labour"]
  },
  {
    id: "marble-floor",
    category: "Marble",
    work: "Marble Flooring",
    unit: "sqft",
    aliases: ["marble", "italian marble", "marble tile"],
    rates: matrix(350, 650, 1100, 2200, 90, 560),
    scope: ["Marble", "Mortar", "Laying", "Basic polish"]
  },
  {
    id: "waterproof-bathroom",
    category: "Waterproofing",
    work: "Bathroom Waterproofing",
    unit: "sqft",
    aliases: ["bathroom waterproof", "toilet waterproofing"],
    rates: matrix(80, 140, 200, 280, 35, 105),
    scope: ["Chemical coating", "Corner treatment", "Labour", "Normal surface prep"]
  },
  {
    id: "waterproof-terrace",
    category: "Waterproofing",
    work: "Terrace Waterproofing",
    unit: "sqft",
    aliases: ["terrace waterproof", "roof waterproof", "slab waterproof"],
    rates: matrix(45, 85, 160, 260, 30, 55),
    scope: ["Surface prep", "Chemical coating or membrane basis", "Labour"]
  },
  {
    id: "waterproof-brickbat",
    category: "Waterproofing",
    work: "Brick Bat Coba",
    unit: "sqft",
    aliases: ["brickbat", "coba", "terrace coba"],
    rates: matrix(95, 145, 210, 310, 45, 100),
    scope: ["Brick bat", "Cement mortar", "Slope", "Labour"]
  },
  {
    id: "waterproof-pu",
    category: "Waterproof Coating",
    work: "PU Waterproof Coating",
    unit: "sqft",
    aliases: ["pu coating", "polyurethane waterproofing"],
    rates: matrix(110, 180, 260, 380, 45, 135),
    scope: ["Primer", "PU coating", "Surface prep", "Labour"]
  },
  {
    id: "waterproof-acrylic",
    category: "Waterproof Coating",
    work: "Acrylic Waterproof Coating",
    unit: "sqft",
    aliases: ["acrylic coating", "damp proof", "roof coating"],
    rates: matrix(55, 95, 140, 210, 28, 67),
    scope: ["Primer", "Acrylic coat", "Labour"]
  },
  {
    id: "electrical-light-point",
    category: "Electrical",
    work: "Light Point",
    unit: "point",
    aliases: ["light point", "electrical point", "switch point"],
    rates: matrix(650, 950, 1350, 1900, 350, 600),
    scope: ["Conduit", "Wire", "Box", "Switch basic", "Labour"]
  },
  {
    id: "electrical-16a-point",
    category: "Electrical",
    work: "16A Power Point",
    unit: "point",
    aliases: ["16 amp point", "power point", "geyser point"],
    rates: matrix(1200, 1700, 2400, 3200, 500, 1200),
    scope: ["Higher gauge wire", "Conduit", "Box", "Switch/socket", "Labour"]
  },
  {
    id: "electrical-ac-point",
    category: "Electrical",
    work: "AC Point",
    unit: "point",
    aliases: ["ac electrical", "air conditioner point"],
    rates: matrix(1800, 2600, 3800, 5200, 700, 1900),
    scope: ["Dedicated wiring", "MCB basis", "Conduit", "Labour"]
  },
  {
    id: "electrical-led-strip",
    category: "Electrical",
    work: "LED Strip With Profile",
    unit: "rft",
    aliases: ["led strip", "profile light", "cove light"],
    rates: matrix(220, 380, 650, 950, 75, 305),
    scope: ["Profile", "LED strip", "Driver basis", "Labour"]
  },
  {
    id: "plumbing-point",
    category: "Plumbing",
    work: "Plumbing Point",
    unit: "point",
    aliases: ["bathroom point", "cp point", "plumbing"],
    rates: matrix(1200, 1800, 2500, 3600, 550, 1250),
    scope: ["CPVC/PPR line", "Fittings basis", "Labour"]
  },
  {
    id: "plumbing-drain",
    category: "Plumbing",
    work: "Drainage Line",
    unit: "rft",
    aliases: ["drain line", "soil pipe", "waste pipe"],
    rates: matrix(220, 360, 520, 760, 110, 250),
    scope: ["Pipe", "Fittings", "Labour", "Normal chasing"]
  },
  {
    id: "painting-putty",
    category: "Painting",
    work: "Wall Putty",
    unit: "sqft",
    aliases: ["putty", "wall putty", "birla putty"],
    rates: matrix(12, 20, 32, 45, 8, 12),
    scope: ["Two coat basis", "Labour", "Putty material"]
  },
  {
    id: "painting-emulsion",
    category: "Painting",
    work: "Interior Emulsion Paint",
    unit: "sqft",
    aliases: ["paint", "emulsion", "interior paint"],
    rates: matrix(18, 32, 55, 85, 10, 22),
    scope: ["Primer/paint basis", "Labour", "Normal finish"]
  },
  {
    id: "painting-texture",
    category: "Painting",
    work: "Texture Paint",
    unit: "sqft",
    aliases: ["texture", "designer paint", "wall texture"],
    rates: matrix(75, 130, 220, 380, 45, 85),
    scope: ["Texture material", "Pattern labour", "Finishing"]
  },
  {
    id: "fabrication-railing",
    category: "Fabrication",
    work: "MS Railing",
    unit: "rft",
    aliases: ["railing", "ms railing", "stair railing"],
    rates: matrix(650, 950, 1400, 2200, 250, 700),
    scope: ["MS section", "Welding", "Primer", "Labour"]
  },
  {
    id: "fabrication-gate",
    category: "Fabrication",
    work: "MS Gate",
    unit: "sqft",
    aliases: ["gate", "compound gate", "steel gate"],
    rates: matrix(450, 750, 1150, 1800, 180, 570),
    scope: ["MS frame", "Sheet/sections basis", "Welding", "Primer"]
  },
  {
    id: "aluminium-window",
    category: "Aluminium",
    work: "Aluminium Sliding Window",
    unit: "sqft",
    aliases: ["sliding window", "aluminium window"],
    rates: matrix(380, 580, 820, 1300, 80, 500),
    scope: ["Aluminium section", "Glass", "Rollers", "Labour"]
  },
  {
    id: "glass-partition",
    category: "Glass",
    work: "Glass Partition",
    unit: "sqft",
    aliases: ["glass partition", "office glass", "shower glass"],
    rates: matrix(550, 900, 1350, 2200, 120, 780),
    scope: ["Toughened glass basis", "Fittings", "Labour"]
  },
  {
    id: "carpentry-door-frame",
    category: "Carpentry",
    work: "Wooden Door Frame",
    unit: "rft",
    aliases: ["door frame", "wood frame", "chowkhat"],
    rates: matrix(180, 280, 450, 750, 120, 160),
    scope: ["Wood frame basis", "Fitting labour", "Normal hardware"]
  },
  {
    id: "carpentry-wardrobe",
    category: "Carpentry",
    work: "Wardrobe Laminate Finish",
    unit: "sqft",
    aliases: ["wardrobe", "cupboard", "laminate furniture"],
    rates: matrix(1200, 1600, 2300, 3400, 350, 1250),
    scope: ["Plywood", "Laminate", "Hardware basic", "Labour"]
  },
  {
    id: "furniture-tv-unit",
    category: "Furniture",
    work: "TV Unit",
    unit: "sqft",
    aliases: ["tv unit", "panel", "console"],
    rates: matrix(950, 1450, 2200, 3300, 320, 1130),
    scope: ["Plywood", "Laminate", "Basic hardware", "Labour"]
  },
  {
    id: "modular-kitchen-base",
    category: "Modular Kitchen",
    work: "Modular Kitchen Base Cabinet",
    unit: "sqft",
    aliases: ["kitchen", "base cabinet", "modular kitchen"],
    rates: matrix(1400, 2100, 3200, 4800, 450, 1650),
    scope: ["Plywood carcass", "Laminate", "Basic hardware", "Labour"]
  },
  {
    id: "door-flush",
    category: "Door & Window",
    work: "Flush Door Installation",
    unit: "nos",
    aliases: ["flush door", "door fitting", "door installation"],
    rates: matrix(1800, 2800, 4200, 6500, 1200, 1600),
    scope: ["Door fitting labour", "Basic hinges/lock allowance"]
  },
  {
    id: "pvc-paneling",
    category: "PVC Work",
    work: "PVC Wall Paneling",
    unit: "sqft",
    aliases: ["pvc panel", "wall panel", "pvc"],
    rates: matrix(85, 135, 190, 280, 35, 100),
    scope: ["PVC panel", "Frame/adhesive basis", "Labour"]
  },
  {
    id: "acp-cladding",
    category: "ACP Work",
    work: "ACP Cladding",
    unit: "sqft",
    aliases: ["acp", "elevation acp", "cladding"],
    rates: matrix(250, 420, 680, 1050, 120, 300),
    scope: ["ACP sheet", "Frame", "Sealant", "Labour"]
  },
  {
    id: "roofing-sheet",
    category: "Roofing",
    work: "Metal Sheet Roofing",
    unit: "sqft",
    aliases: ["roofing sheet", "metal roof", "shed"],
    rates: matrix(180, 300, 480, 760, 80, 220),
    scope: ["Roof sheet", "Fasteners", "Labour", "Basic frame allowance"]
  },
  {
    id: "demolition-tile-removal",
    category: "Demolition",
    work: "Tile Removal",
    unit: "sqft",
    aliases: ["break tile", "tile demolition", "remove tile"],
    rates: matrix(18, 30, 45, 70, 28, 2),
    scope: ["Breaking", "Stacking", "Basic cleaning"]
  },
  {
    id: "demolition-wall-breaking",
    category: "Demolition",
    work: "Wall Breaking",
    unit: "sqft",
    aliases: ["break wall", "demolish wall", "wall demolition"],
    rates: matrix(35, 60, 95, 150, 55, 5),
    scope: ["Breaking", "Debris stacking", "Normal brick wall"]
  },
  {
    id: "interior-fluted",
    category: "Interior Work",
    work: "Fluted Wall Panel",
    unit: "sqft",
    aliases: ["fluted", "louvers", "wall panel"],
    rates: matrix(180, 320, 520, 850, 70, 250),
    scope: ["Panel", "Adhesive/frame basis", "Labour"]
  },
  {
    id: "exterior-texture",
    category: "Exterior Work",
    work: "Exterior Texture Coating",
    unit: "sqft",
    aliases: ["exterior texture", "elevation texture"],
    rates: matrix(55, 95, 150, 240, 35, 60),
    scope: ["Texture coat", "Labour", "Normal access"]
  },
  {
    id: "labour-mason",
    category: "Labour Supply",
    work: "Mason Labour",
    unit: "day",
    aliases: ["mason", "raj mistri", "skilled labour"],
    rates: matrix(850, 1000, 1250, 1600, 1000, 0),
    scope: ["One skilled mason day wage"]
  },
  {
    id: "labour-helper",
    category: "Labour Supply",
    work: "Helper Labour",
    unit: "day",
    aliases: ["helper", "labour", "unskilled"],
    rates: matrix(550, 700, 850, 1100, 700, 0),
    scope: ["One helper day wage"]
  },
  {
    id: "labour-carpenter",
    category: "Labour Supply",
    work: "Carpenter Labour",
    unit: "day",
    aliases: ["carpenter", "wood worker"],
    rates: matrix(1000, 1300, 1700, 2400, 1300, 0),
    scope: ["One skilled carpenter day wage"]
  },
  {
    id: "labour-electrician",
    category: "Labour Supply",
    work: "Electrician Labour",
    unit: "day",
    aliases: ["electrician", "wireman"],
    rates: matrix(900, 1200, 1600, 2200, 1200, 0),
    scope: ["One skilled electrician day wage"]
  },
  {
    id: "labour-painter",
    category: "Labour Supply",
    work: "Painter Labour",
    unit: "day",
    aliases: ["painter", "paint labour"],
    rates: matrix(800, 1050, 1350, 1800, 1050, 0),
    scope: ["One painter day wage"]
  }
];

export type CityRateProfile = {
  state: string;
  city: string;
  multiplier: number;
  note: string;
};

export const cityRateProfiles: CityRateProfile[] = [
  { state: "Maharashtra", city: "Pune", multiplier: 1, note: "Base profile for this app." },
  { state: "Maharashtra", city: "Mumbai", multiplier: 1.18, note: "Higher labour, transport, and building access cost." },
  { state: "Maharashtra", city: "Nashik", multiplier: 0.9, note: "Generally lower than Pune for many trades." },
  { state: "Maharashtra", city: "Nagpur", multiplier: 0.92, note: "Lower to medium local cost profile." },
  { state: "Delhi NCR", city: "Delhi", multiplier: 1.1, note: "Higher labour and compliance cost." },
  { state: "Karnataka", city: "Bangalore", multiplier: 1.15, note: "Higher skilled labour and finishing cost." },
  { state: "Telangana", city: "Hyderabad", multiplier: 1.05, note: "Slight premium over base on skilled trades." }
];

export const contractTypeMultipliers = {
  Residential: 1,
  Commercial: 1.08,
  Industrial: 1.12,
  Luxury: 1.25
} as const;

export type ContractType = keyof typeof contractTypeMultipliers;

export const rateSourceNotes = [
  "Indicative India/Pune planning ranges only. Final quote should be checked against current supplier and labour rates.",
  "Waterproofing can vary sharply by surface condition, cracks, slope, product system, warranty and leakage severity.",
  "Tile, carpentry and false ceiling rates depend heavily on brand, hardware, design complexity, wastage and access."
];
