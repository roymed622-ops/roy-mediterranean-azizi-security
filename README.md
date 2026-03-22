# 🏢 Roy Mediterranean by Azizi Property
## Managed by ATC - Property Management System

> **Just add data → System auto-updates everything**

---

## 🎯 System Philosophy

Unlike traditional property management systems where you manually update:
- Unit status
- Resident information  
- Financial balances
- Lease dates

**Roy Mediterranean System** works differently:

1. **Add a Movement** (Move-in/Move-out/Transfer/Renewal)
   → Unit status auto-updates
   → Resident record auto-creates/updates
   → Financials auto-calculate

2. **Add a Payment**
   → Resident balance auto-updates
   → Unit revenue auto-updates
   → Receipt auto-generates

**You only add raw data. The system handles everything else.**

---

## 🚀 Quick Start (30 seconds)

### Prerequisites
- Docker Desktop installed

### Step 1: Start System
```bash
cd roy_mediterranean_atc
docker-compose up -d
```

### Step 2: Open Browser
```
http://localhost
```

### Step 3: Start Using
- Click **"Record Movement"** to add move-ins/move-outs
- Click **"Record Payment"** to add payments
- System auto-updates dashboard & unit status

---

## 📊 What Auto-Updates?

| You Add | System Auto-Calculates |
|---------|----------------------|
| Move-In movement | Unit → Occupied, Resident created, Lease dates set |
| Move-Out movement | Unit → Vacant, Resident unlinked, History saved |
| Payment | Resident balance updated, Unit revenue updated, Receipt generated |
| Renewal | Lease extended, Rent updated, History logged |

---

## 🏗️ Buildings & Units

Roy Mediterranean consists of:
- **Building A** - Residential Tower
- **Building B** - Residential Tower  
- **Building C** - Mixed Use
- **Building D** - Premium Residences

Unit types:
- Studio
- 1 Bedroom
- 2 Bedroom
- 3 Bedroom
- Penthouse

---

## 📡 API Endpoints

### Core Operations (Just add these)

```bash
# 1. Add a new unit to the system
POST /api/units
{
  "building": "A",
  "unit_type": "2BR",
  "floor": 15
}

# 2. Record movement - EVERYTHING auto-updates from this!
POST /api/movements
{
  "movement_type": "Move-In",
  "unit": {
    "unit_id": "A-101",
    "building": "A",
    "unit_type": "2BR"
  },
  "resident": {
    "name": "John Smith",
    "phone": "+971 50 123 4567",
    "email": "john@email.com"
  },
  "move_in_date": "2024-06-01",
  "lease_end": "2025-05-31",
  "monthly_rent": 8500,
  "security_deposit": 17000
}

# 3. Record payment - Balances auto-update!
POST /api/payments
{
  "unit_id": "A-101",
  "payment_type": "Rent",
  "amount": 8500,
  "method": "Bank Transfer",
  "rent_period": {
    "month": 6,
    "year": 2024
  }
}
```

### View Auto-Calculated Data

```bash
# Dashboard with all metrics
GET /api/dashboard

# All units with auto-status
GET /api/units

# Unit with full auto-history
GET /api/units/A-101

# All movements
GET /api/movements

# All payments
GET /api/payments

# Auto-generated reports
GET /api/reports/occupancy
GET /api/reports/financial
```

---

## 🔄 How It Works (Technical)

### Database Schema

```javascript
// Units - Auto-updated by movements
{
  unit_id: "A-101",
  building: "A",
  unit_type: "2BR",
  status: "Occupied", // ← Auto-set from latest movement
  current_resident: ObjectId, // ← Auto-linked
  current_rent: 8500, // ← Auto-from movement
  lease_expiry: "2025-05-31", // ← Auto-from movement
  revenue_to_date: 25500, // ← Auto-summed from payments
  occupancy_history: [...] // ← Auto-logged
}

// Movements - YOU add this, triggers auto-updates
{
  movement_type: "Move-In",
  unit: { unit_id, building, unit_type },
  resident: { name, phone, email },
  move_in_date,
  lease_end,
  monthly_rent,
  // ↓ Middleware auto-updates Units & Residents
}

// Payments - YOU add this, triggers auto-updates
{
  unit_id: "A-101",
  payment_type: "Rent",
  amount: 8500,
  // ↓ Middleware auto-updates Unit.revenue & Resident.balance
}
```

### Auto-Update Middleware

```javascript
// When movement is saved:
Movement.post('save', async function(doc) {
  if (doc.movement_type === 'Move-In') {
    // Auto-update unit to Occupied
    await Unit.updateOne({ unit_id: doc.unit.unit_id }, {
      status: 'Occupied',
      current_resident: residentId,
      current_rent: doc.monthly_rent,
      lease_expiry: doc.lease_end
    });

    // Auto-create resident
    await Resident.create({
      full_name: doc.resident.name,
      current_unit: { unit_id: doc.unit.unit_id, ... }
    });
  }

  if (doc.movement_type === 'Move-Out') {
    // Auto-update unit to Vacant
    await Unit.updateOne({ unit_id: doc.unit.unit_id }, {
      status: 'Vacant',
      current_resident: null
    });
  }
});

// When payment is saved:
Payment.post('save', async function(doc) {
  if (doc.status === 'Cleared') {
    // Auto-update unit revenue
    await Unit.updateOne({ unit_id: doc.unit_id }, {
      $inc: { revenue_to_date: doc.amount }
    });

    // Auto-update resident totals
    await Resident.updateOne({ resident_id: doc.resident_id }, {
      $inc: { total_paid_to_date: doc.amount }
    });
  }
});
```

---

## 📱 Interface Walkthrough

### Dashboard
- **Auto-sync indicator** - Shows system is live
- **Key metrics** - All auto-calculated:
  - Total units
  - Occupied/Vacant count
  - Expiring leases (≤30 days)
  - This month revenue
- **Recent movements** - Auto-synced list
- **Expiring leases** - Auto-detected alerts

### Record Movement
**Just fill the form, system handles rest:**

1. Select movement type (Move-In/Move-Out/Transfer/Renewal)
2. Select unit (only vacant units shown for move-in)
3. Enter resident details
4. Enter dates & rent
5. Click "Record Movement"
6. **Done!** Unit status updated, resident created, history logged

### Record Payment
**Just fill the form, system handles rest:**

1. Select occupied unit (auto-shows resident)
2. Select payment type (Rent/Deposit/Fee)
3. Enter amount & method
4. For rent: select which month
5. Click "Record Payment"
6. **Done!** Receipt generated, balances updated

### View Units
- **Real-time data** - All auto-calculated
- **Filter by** building or status
- **Visual indicators**:
  - 🟢 Green - Active lease
  - 🔴 Red - Expiring soon (≤30 days)
  - 🟡 Amber - Vacant

---

## 🧪 Testing the System

### Scenario 1: New Move-In
```
1. Click "Record Movement"
2. Select "Move-In"
3. Choose unit A-105 (vacant)
4. Enter: John Smith, +971 50 123 4567
5. Dates: Today to 1 year later
6. Rent: AED 9,000/month
7. Deposit: AED 18,000
8. Click "Record Movement"

Result:
- A-105 status → Occupied
- John Smith resident created
- Lease dates set
- Dashboard updated
```

### Scenario 2: Record Monthly Rent
```
1. Click "Record Payment"
2. Select unit A-105 (shows John Smith)
3. Payment type: Rent
4. Amount: AED 9,000
5. Method: Bank Transfer
6. Month: June 2024
7. Click "Record Payment"

Result:
- Receipt generated: RCP-2024-000001
- John Smith balance updated
- A-105 revenue updated
- Dashboard updated
```

### Scenario 3: Move-Out
```
1. Click "Record Movement"
2. Select "Move-Out"
3. Choose unit A-105
4. Enter move-out date: Today
5. Reason: "Relocating"
6. Click "Record Movement"

Result:
- A-105 status → Vacant
- John Smith unlinked
- History saved
- Now available for new move-in
```

---

## 📊 Auto-Generated Reports

Access via API:

```bash
# Occupancy report (move-ins, move-outs, renewals)
GET /api/reports/occupancy?year=2024&month=6

# Financial report (revenue breakdown)
GET /api/reports/financial?year=2024

# Dashboard (comprehensive metrics)
GET /api/dashboard
```

---

## 🔐 Security & Production

### Default Credentials (Change for production!)
- **MongoDB**: atc_admin / roy_mediterranean_2024
- **Database**: roy_mediterranean

### Production Checklist
- [ ] Change MongoDB password
- [ ] Enable HTTPS
- [ ] Add JWT authentication
- [ ] Set up daily backups
- [ ] Configure email notifications
- [ ] Add audit logging

---

## 🛠️ Troubleshooting

### System not starting?
```bash
docker-compose down -v
docker-compose up -d
```

### Data not syncing?
Check auto-sync indicator on dashboard. If red:
```bash
docker-compose logs api
```

### Need to reset all data?
```bash
docker-compose down -v
docker-compose up -d
```

---

## 📞 Support

**Managed by:** ATC (Asset Management & Technical Consultants)

**System:** Roy Mediterranean by Azizi Property

For technical issues:
1. Check Docker logs: `docker-compose logs`
2. Verify MongoDB connection
3. Test API: `curl http://localhost:3000/api/dashboard`

---

## 📝 Version History

**v1.0** - Initial Release
- Auto-update architecture
- Movement-based workflow
- Real-time dashboard
- Auto-generated reports

---

**Built with ❤️ for Roy Mediterranean by Azizi Property**
**Managed by ATC**
