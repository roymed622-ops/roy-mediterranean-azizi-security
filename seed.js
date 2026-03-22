// Roy Mediterranean by Azizi Property - ATC
// Seed Data for Testing
// Run: mongo roy_mediterranean seed.js

db = db.getSiblingDB('roy_mediterranean');

// Clear existing
db.units.drop();
db.residents.drop();
db.movements.drop();
db.payments.drop();

// Create Units for Buildings A, B, C, D
const units = [];
const buildings = ['A', 'B', 'C', 'D'];
const unitTypes = ['Studio', '1BR', '2BR', '3BR'];
const floorsPerBuilding = 20;

buildings.forEach(building => {
    for (let floor = 1; floor <= floorsPerBuilding; floor++) {
        for (let unit = 1; unit <= 4; unit++) {
            const unitNum = String(unit).padStart(2, '0');
            const unitId = `${building}-${String(floor).padStart(2, '0')}${unitNum}`;
            const type = unitTypes[unit - 1];

            units.push({
                unit_id: unitId,
                building: building,
                unit_type: type,
                floor: floor,
                status: 'Vacant',
                current_rent: 0,
                deposit_held: 0,
                balance_due: 0,
                revenue_to_date: 0,
                occupancy_history: [],
                metadata: {
                    created_at: new Date(),
                    updated_at: new Date()
                }
            });
        }
    }
});

db.units.insertMany(units);

// Mark some units as occupied with sample data
const sampleMovements = [
    {
        movement_id: 'MOV-202406010001',
        movement_type: 'Move-In',
        unit: { unit_id: 'A-0501', building: 'A', unit_type: 'Studio' },
        resident: { resident_id: 'RES-00001', name: 'Ahmed Hassan', phone: '+971 50 111 2222', email: 'ahmed@email.com' },
        move_in_date: new Date('2024-06-01'),
        lease_end: new Date('2025-05-31'),
        monthly_rent: 4500,
        security_deposit: 9000,
        status: 'Active',
        metadata: { created_at: new Date('2024-06-01'), created_by: 'system' }
    },
    {
        movement_id: 'MOV-202406020002',
        movement_type: 'Move-In',
        unit: { unit_id: 'A-1202', building: 'A', unit_type: '1BR' },
        resident: { resident_id: 'RES-00002', name: 'Sarah Johnson', phone: '+971 55 333 4444', email: 'sarah@email.com' },
        move_in_date: new Date('2024-06-02'),
        lease_end: new Date('2025-06-01'),
        monthly_rent: 6500,
        security_deposit: 13000,
        status: 'Active',
        metadata: { created_at: new Date('2024-06-02'), created_by: 'system' }
    },
    {
        movement_id: 'MOV-202406030003',
        movement_type: 'Move-In',
        unit: { unit_id: 'B-0803', building: 'B', unit_type: '2BR' },
        resident: { resident_id: 'RES-00003', name: 'Mohammed Al-Rashid', phone: '+971 50 555 6666', email: 'mohammed@email.com' },
        move_in_date: new Date('2024-06-03'),
        lease_end: new Date('2024-12-02'), // Expiring soon!
        monthly_rent: 9500,
        security_deposit: 19000,
        status: 'Active',
        metadata: { created_at: new Date('2024-06-03'), created_by: 'system' }
    },
    {
        movement_id: 'MOV-202406040004',
        movement_type: 'Move-In',
        unit: { unit_id: 'C-1504', building: 'C', unit_type: '3BR' },
        resident: { resident_id: 'RES-00004', name: 'Emma Wilson', phone: '+971 55 777 8888', email: 'emma@email.com' },
        move_in_date: new Date('2024-06-04'),
        lease_end: new Date('2025-06-03'),
        monthly_rent: 12500,
        security_deposit: 25000,
        status: 'Active',
        metadata: { created_at: new Date('2024-06-04'), created_by: 'system' }
    }
];

db.movements.insertMany(sampleMovements);

// Update units based on movements
sampleMovements.forEach(m => {
    if (m.movement_type === 'Move-In') {
        db.units.updateOne(
            { unit_id: m.unit.unit_id },
            {
                $set: {
                    status: 'Occupied',
                    current_rent: m.monthly_rent,
                    deposit_held: m.security_deposit,
                    current_move_in: m.move_in_date,
                    current_move_out: null,
                    lease_expiry: m.lease_end,
                    'metadata.updated_at': new Date()
                },
                $push: {
                    occupancy_history: {
                        resident_id: m.resident.resident_id,
                        resident_name: m.resident.name,
                        move_in: m.move_in_date,
                        move_out: null,
                        rent: m.monthly_rent
                    }
                }
            }
        );
    }
});

// Create residents
const residents = sampleMovements.map(m => ({
    resident_id: m.resident.resident_id,
    full_name: m.resident.name,
    phone: m.resident.phone,
    email: m.resident.email,
    current_unit: {
        unit_id: m.unit.unit_id,
        building: m.unit.building,
        move_in_date: m.move_in_date,
        lease_expiry: m.lease_end,
        monthly_rent: m.monthly_rent
    },
    total_paid_to_date: 0,
    balance_due: 0,
    payment_status: 'Current',
    occupancy_history: [{
        unit_id: m.unit.unit_id,
        building: m.unit.building,
        move_in: m.move_in_date,
        move_out: null,
        rent: m.monthly_rent
    }],
    metadata: {
        created_at: new Date(),
        updated_at: new Date()
    }
}));

db.residents.insertMany(residents);

// Add sample payments
const payments = [
    {
        payment_id: 'PAY-202406-00001',
        unit_id: 'A-0501',
        resident_id: 'RES-00001',
        resident_name: 'Ahmed Hassan',
        payment_type: 'Rent',
        amount: 4500,
        currency: 'AED',
        method: 'Bank Transfer',
        status: 'Cleared',
        receipt_number: 'RCP-2024-000001',
        rent_period: { month: 6, year: 2024 },
        metadata: { created_at: new Date('2024-06-01'), received_by: 'system' }
    },
    {
        payment_id: 'PAY-202406-00002',
        unit_id: 'A-0501',
        resident_id: 'RES-00001',
        resident_name: 'Ahmed Hassan',
        payment_type: 'Deposit',
        amount: 9000,
        currency: 'AED',
        method: 'Cheque',
        status: 'Cleared',
        receipt_number: 'RCP-2024-000002',
        metadata: { created_at: new Date('2024-06-01'), received_by: 'system' }
    },
    {
        payment_id: 'PAY-202406-00003',
        unit_id: 'A-1202',
        resident_id: 'RES-00002',
        resident_name: 'Sarah Johnson',
        payment_type: 'Rent',
        amount: 6500,
        currency: 'AED',
        method: 'Credit Card',
        status: 'Cleared',
        receipt_number: 'RCP-2024-000003',
        rent_period: { month: 6, year: 2024 },
        metadata: { created_at: new Date('2024-06-02'), received_by: 'system' }
    }
];

db.payments.insertMany(payments);

// Update unit revenues and resident totals
payments.forEach(p => {
    if (p.status === 'Cleared') {
        // Update unit revenue
        db.units.updateOne(
            { unit_id: p.unit_id },
            {
                $inc: { revenue_to_date: p.amount },
                $set: { 'metadata.updated_at': new Date() }
            }
        );

        // Update resident totals
        db.residents.updateOne(
            { resident_id: p.resident_id },
            {
                $inc: { total_paid_to_date: p.amount },
                $set: { 'metadata.updated_at': new Date() }
            }
        );
    }
});

// Create indexes
db.units.createIndex({ unit_id: 1 }, { unique: true });
db.units.createIndex({ building: 1, status: 1 });
db.residents.createIndex({ resident_id: 1 }, { unique: true });
db.movements.createIndex({ movement_id: 1 }, { unique: true });
db.movements.createIndex({ 'unit.unit_id': 1, 'metadata.created_at': -1 });
db.payments.createIndex({ payment_id: 1 }, { unique: true });
db.payments.createIndex({ unit_id: 1, 'metadata.created_at': -1 });

print('✅ Roy Mediterranean Seed Data Loaded');
print(`📊 ${db.units.countDocuments()} units created`);
print(`🏠 ${db.residents.countDocuments()} residents`);
print(`📦 ${db.movements.countDocuments()} movements`);
print(`💰 ${db.payments.countDocuments()} payments`);
print('');
print('Special: Unit B-0803 has lease expiring soon (for testing alerts)');
print('System ready for auto-update testing!');
