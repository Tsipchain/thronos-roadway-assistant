# Real data CSV templates

Copy these files to `data/import/`, replace the demo rows with production data, then run:

```bash
npm run import:real-data
```

Rules:

- `serviceTypes` and `specialties` use `|` between enum values.
- Do not put customer personal data in these catalogues.
- Technician wallet addresses are public addresses only.
- Product prices are EUR retail/partner/platform values, not payment secrets.
- Keep real API keys and private keys in deployment secrets, never in CSV.
