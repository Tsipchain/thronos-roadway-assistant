# Flutter Technician App API Contract

Base URL:

```text
https://YOUR_APP_DOMAIN
```

Authentication is intentionally not finalized in this MVP. Codex should add JWT/session auth before production. Current MVP uses `{technicianUserId}` paths so the mobile loop can be tested immediately; production should replace that with `/me` behind auth.

## Technician status

### Go online / update location

Proposed endpoint to add:

```http
POST /api/technicians/{technicianUserId}/location
Content-Type: application/json
Authorization: Bearer <token>
```

```json
{
  "latitude": 37.9838,
  "longitude": 23.7275,
  "isOnline": true,
  "isAvailable": true
}
```

## Incoming jobs

Current MVP returns candidates when a customer creates a request. Codex should add:

```http
GET /api/technicians/{technicianUserId}/jobs?status=NOTIFIED
Authorization: Bearer <token>
```

Expected response:

```json
{
  "jobs": [
    {
      "id": "service_request_id",
      "serviceType": "BATTERY_REPLACEMENT",
      "status": "PENDING",
      "distanceKm": 4.2,
      "estimatedMinutes": 13,
      "vehicle": {
        "make": "Volkswagen",
        "model": "Golf",
        "year": 2018,
        "engineType": "1.4 TSI",
        "batteryType": "AGM",
        "batteryAh": 70,
        "tireSize": "205/55R16"
      },
      "location": {
        "latitude": 37.984,
        "longitude": 23.728,
        "address": "Athens"
      },
      "symptoms": ["Δεν παίρνει μπρος"]
    }
  ]
}
```

## Accept job

```http
POST /api/service-requests/{id}/accept
Content-Type: application/json
```

```json
{
  "technicianId": "technician_user_id",
  "estimatedMinutes": 12
}
```

## Complete job

```http
POST /api/service-requests/{id}/complete
Content-Type: application/json
```

```json
{
  "finalPrice": 145,
  "partsUsed": ["BAT-AGM-70-760"],
  "technicianNotes": "Battery replaced; alternator charging checked at 14.2V",
  "attestationMode": "sha256",
  "metadataUri": "ipfs://optional-public-proof"
}
```

Recommended mobile states:

- offline
- online_available
- job_offered
- accepted
- en_route
- arrived
- in_progress
- completed
- failed_or_cancelled

## Minimum Flutter screens

1. Login
2. Online/offline switch
3. Incoming job card
4. Map/navigation screen
5. Vehicle/parts checklist
6. Completion form
7. Earnings/history
8. Wallet/proof screen

Do not start with fancy screens. First make the driver loop bulletproof. Old road rule: the wheel comes before the spoiler.
