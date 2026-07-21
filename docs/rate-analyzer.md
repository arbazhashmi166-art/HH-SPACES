# H&H SPACES Rate Analyzer

This module is a mobile-first construction pricing engine for quick customer discussions and internal costing.

## What Is Included

- Instant work search across civil, waterproofing, tiling, POP, gypsum, electrical, plumbing, painting, fabrication, aluminium, glass, carpentry, furniture, modular kitchen, repair and handover work.
- Quick customer quote with labour, material, overhead, profit, GST and recommended selling price.
- Site-condition multipliers for lift, floor, renovation, night work, fast-track work, parking and premium finish.
- Profit protection warnings with safe negotiation floor.
- Economy, standard and premium comparison.
- Smart Rate AI local parser for natural language estimates.
- Voice input on browsers that support speech recognition.
- BOQ rows saved locally and exportable as PDF, Excel-compatible file, CSV, print and WhatsApp text.
- Non-destructive Supabase migration at `supabase/rate-analyzer-schema.sql`.

## Core Formulas

### Quantity

- Floor or ceiling area = `length x width`
- Single wall area = `length x height`
- Room wall area = `2 x (length + width) x height`
- Bathroom tile area = `(floor area + wall area) x (1 + wastage%)`
- Running length = `length`
- Count or point work = `number of points / units`

### Cost

- Labour cost = `quantity x labour rate`
- Material cost = `quantity x material rate`
- Base cost = `labour cost + material cost`
- Overhead = `base cost x overhead%`
- Profit = `(base cost + overhead) x profit%`
- GST = `(base cost + overhead + profit) x GST%`
- Customer total = `base cost + overhead + profit + GST`

### Profit Protection

- Direct cost = `base cost + overhead`
- Minimum profit = `direct cost x category minimum profit%`
- Site condition impact = `customer total x selected condition multiplier%`
- Safe floor = `(direct cost + minimum profit + condition impact) x (1 + GST%)`
- Recommended total = `max(calculated customer total + condition impact, safe floor)`

## Sample Bathroom Rate Analysis

Prompt: `4 by 8 bathroom complete tiling cost with 2x4 wall tile`

- Area: bathroom floor plus walls using default wall height.
- Wastage: default 10%.
- Output: tile area, labour, material, profit, GST, recommended customer total, safe floor and BOQ draft.

## Sample Tile Work

Prompt: `2x4 wall tile labour rate 500 sqft`

- Quantity: 500 sqft.
- Mode: labour-only if the prompt says labour-only or without material.
- Warnings: material, adhesive, grout, cutting, transport and wastage excluded.

## Sample Electrical Work

Prompt: `electrical estimate for 3BHK`

- Finds the residential electrical package.
- Calculates by point count when provided.
- Shows customer-ready comparison for economy, standard and premium finish.
- Confirm wire brand, switch brand, DB, main cable, chasing and POP repair before final quotation.

## Sample POP Work

Prompt: `POP ceiling for 12 by 15 hall modern design`

- Area: 12 x 15 sqft.
- Adds POP/false-ceiling rate basis.
- Confirm cove, profile lights, curtain pocket, trap door, paint and design level before final quote.

## Sample Modular Kitchen

Prompt: `make an economy quotation for a modular kitchen 100 sqft`

- Quantity: 100 sqft.
- Includes base cabinet logic from the rate database.
- Exclude countertop, baskets, tandem, profile handles, appliances and premium hardware unless explicitly selected.

## Customer Quotation Rule

The customer quotation should hide:

- Labour wages
- Material purchase rates
- Supplier names
- Profit margin
- Internal risk notes

Show only:

- Work description
- Quantity
- Unit
- Rate
- Amount
- Tax
- Terms and exclusions

## Supabase Setup

1. Run the main `supabase/schema.sql` first if it has not been applied.
2. Run `supabase/rate-analyzer-schema.sql` in Supabase SQL Editor.
3. Do not add service-role keys to the frontend.
4. The migration uses the same company RLS helpers as the main app.

## Testing

Run:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

For mobile regression:

```bash
npm run test:e2e
```
