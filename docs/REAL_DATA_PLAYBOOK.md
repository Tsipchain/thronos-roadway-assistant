# Real Data Playbook

This project is repo-ready, but it is not production-ready until real operational data is loaded and validated.

## 1. Data that must be real before launch

### Service areas
Minimum fields:

- country / city
- center latitude / longitude
- radius in km
- supported services
- SLA target in minutes
- partner/company coverage

Use `data/templates/service_areas.csv` as the schema.

### Partner companies
Minimum fields:

- company legal or trading name
- VAT/tax identifier if required for invoicing
- support phone and email
- billing address
- status

Use `data/templates/partners.csv`.

### Technicians
Minimum fields:

- name
- phone
- email
- public wallet address
- current or home-base coordinates
- vehicle plate
- supported service types
- coverage radius
- inventory notes

Use `data/templates/technicians.csv`.

Do not store private keys for technicians. The app only needs public wallet addresses.

### Battery catalogue
Minimum fields:

- SKU
- brand / model
- technology: AGM, EFB, LeadAcid, GEL
- Ah, CCA, dimensions, polarity
- warranty months
- retail price
- partner cost
- platform fee

Use `data/templates/batteries.csv`.

### Tyre catalogue
Minimum fields:

- SKU
- brand / model
- size
- season
- load index / speed index
- warranty months
- retail price
- partner cost
- platform fee

Use `data/templates/tyres.csv`.

### Vehicle fitment rules
Start with a simple manual table. Do not wait for plate/VIN API perfection.

Minimum fields:

- make / model
- year range
- engine type if needed
- matching battery SKU
- matching tyre SKU / tyre size
- notes for technician confirmation

Use `data/templates/vehicle_fitments.csv`.

## 2. How to load real data

```bash
mkdir -p data/import
cp data/templates/*.csv data/import/
# edit data/import/*.csv with real data
npm run import:real-data
```

For a dry bootstrap using the demo templates:

```bash
npm run import:real-data:templates
```

## 3. What stays off-chain

Do not put these on-chain:

- customer name
- customer phone
- exact plate number
- VIN in plain text
- live GPS trace
- full invoice data
- card/payment personal data

These stay in PostgreSQL and must be protected by normal app security.

## 4. What can go to Thronos

Good on-chain or attested data:

- SHA-256 hash of service proof
- request ID hash
- vehicle hash
- service type code
- technician public wallet
- completion timestamp
- warranty proof hash
- metadata URI with non-sensitive data

That is the clean way: old-school service book discipline, new-school proof.

## 5. First production scenario to validate

1. Customer creates a vehicle.
2. Customer requests `BATTERY_REPLACEMENT` with GPS.
3. Dispatch returns online technicians inside radius.
4. Technician accepts.
5. Technician completes job with parts used.
6. App creates local service record.
7. App creates SHA-256 attestation.
8. If enabled, app writes the service proof to Thronos EVM.
9. Customer gets receipt/warranty proof.

## 6. Operational truth

Do not launch city-wide on day one. Start with one city zone, 3-5 trusted technicians, 20-50 high-rotation batteries, and a strict 30-minute SLA. A small clean machine beats a big rusty circus.
