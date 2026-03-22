const mongoose = require('mongoose');

// ==========================================
// ROY MEDITERRANEAN BY AZIZI PROPERTY - ATC
// Simplified Auto-Update Schema
// Just add data → System updates automatically
// ==========================================

const UnitSchema = new mongoose.Schema({
  unit_id: { type: String, unique: true, required: true }, // e.g., "A-101", "B-205"
  building: { type: String, required: true }, // A, B, C, D towers
  unit_type: { type: String, enum: ['Studio', '1BR', '2BR', '3BR', 'Penthouse'], required: true },
  floor: Number,

  // Current Status (auto-calculated)
  status: { 
    type: String, 
    enum: ['Vacant', 'Occupied', 'Maintenance', 'Reserved'],
    default: 'Vacant'
  },

  // Current Resident (auto-linked)
  current_resident: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resident',
    default: null
  },

  // Financial (auto-summarized from movements)
  current_rent: { type: Number, default: 0 },
  deposit_held: { type: Number, default: 0 },
  balance_due: { type: Number, default: 0 },

  // Dates (from latest movement)
  current_move_in: Date,
  current_move_out: Date,
  lease_expiry: Date,

  // Auto-generated metrics
  occupancy_history: [{
    resident_id: String,
    resident_name: String,
    move_in: Date,
    move_out: Date,
    rent: Number
  }],

  total_occupancy_days: { type: Number, default: 0 },
  revenue_to_date: { type: Number, default: 0 },

  metadata: {
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
  }
});

const ResidentSchema = new mongoose.Schema({
  resident_id: { type: String, unique: true, required: true }, // Auto-generated

  // Personal Info
  full_name: { type: String, required: true },
  nationality: String,
  passport_number: String,
  phone: String,
  email: String,
  emergency_contact: {
    name: String,
    phone: String,
    relation: String
  },

  // Current Unit (auto-linked from latest movement)
  current_unit: {
    unit_id: String,
    building: String,
    move_in_date: Date,
    lease_expiry: Date,
    monthly_rent: Number
  },

  // Financial Standing (auto-calculated)
  total_paid_to_date: { type: Number, default: 0 },
  balance_due: { type: Number, default: 0 },
  payment_status: { 
    type: String, 
    enum: ['Current', 'Overdue', 'Advance', 'Deposit'],
    default: 'Current'
  },

  // History (auto-populated from movements)
  occupancy_history: [{
    unit_id: String,
    building: String,
    move_in: Date,
    move_out: Date,
    rent: Number,
    reason_for_leaving: String
  }],

  documents: {
    passport_copy: String,
    visa_copy: String,
    emirates_id: String,
    contract_copy: String
  },

  metadata: {
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
  }
});

// THE KEY: Movement Schema - Just add this, everything else auto-updates
const MovementSchema = new mongoose.Schema({
  movement_id: { type: String, unique: true, required: true },

  // What happened
  movement_type: { 
    type: String, 
    enum: ['Move-In', 'Move-Out', 'Transfer', 'Renewal', 'Termination'],
    required: true 
  },

  // Who
  resident: {
    resident_id: String,
    name: String,
    phone: String,
    email: String
  },

  // Where
  unit: {
    unit_id: { type: String, required: true },
    building: String,
    unit_type: String
  },

  // When
  move_in_date: Date,
  move_out_date: Date,
  lease_start: Date,
  lease_end: Date,

  // Financial
  monthly_rent: Number,
  security_deposit: Number,
  agency_fee: Number,
  other_charges: Number,

  // Payment at move-in
  payment_received: {
    amount: Number,
    method: String, // Cash, Cheque, Bank Transfer, Card
    reference: String,
    date: Date
  },

  // Status
  status: { 
    type: String, 
    enum: ['Pending', 'Active', 'Completed', 'Cancelled'],
    default: 'Active'
  },

  // Notes
  notes: String,
  reason_for_move: String, // For move-outs

  // Auto-links
  previous_movement_id: String, // For transfers/renewals

  metadata: {
    created_by: String,
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
  }
});

// Payment Schema - Add this, resident balance auto-updates
const PaymentSchema = new mongoose.Schema({
  payment_id: { type: String, unique: true, required: true },

  // Who paid
  resident_id: { type: String, required: true },
  resident_name: String,

  // For which unit
  unit_id: { type: String, required: true },

  // Payment details
  amount: { type: Number, required: true },
  currency: { type: String, default: 'AED' },
  payment_type: { 
    type: String, 
    enum: ['Rent', 'Deposit', 'Agency Fee', 'Maintenance', 'Penalty', 'Refund'],
    required: true 
  },

  // For rent payments - which period
  rent_period: {
    month: Number, // 1-12
    year: Number,
    from_date: Date,
    to_date: Date
  },

  // Payment method
  method: { 
    type: String, 
    enum: ['Cash', 'Cheque', 'Bank Transfer', 'Credit Card', 'Online'],
    required: true 
  },

  // Reference info
  reference_number: String,
  bank_name: String,
  cheque_number: String,
  cheque_date: Date,

  // Status
  status: { 
    type: String, 
    enum: ['Pending', 'Cleared', 'Bounced', 'Refunded'],
    default: 'Pending'
  },

  // Receipt
  receipt_generated: { type: Boolean, default: false },
  receipt_number: String,

  notes: String,

  metadata: {
    received_by: String,
    created_at: { type: Date, default: Date.now }
  }
});

// Auto-calculation Middleware
MovementSchema.post('save', async function(doc) {
  const Unit = mongoose.model('Unit');
  const Resident = mongoose.model('Resident');

  // Update Unit based on movement
  if (doc.movement_type === 'Move-In' || doc.movement_type === 'Transfer') {
    await Unit.findOneAndUpdate(
      { unit_id: doc.unit.unit_id },
      {
        status: 'Occupied',
        current_move_in: doc.move_in_date,
        current_move_out: doc.move_out_date,
        lease_expiry: doc.lease_end,
        current_rent: doc.monthly_rent,
        deposit_held: doc.security_deposit,
        $push: {
          occupancy_history: {
            resident_id: doc.resident.resident_id,
            resident_name: doc.resident.name,
            move_in: doc.move_in_date,
            move_out: doc.move_out_date,
            rent: doc.monthly_rent
          }
        },
        'metadata.updated_at': new Date()
      }
    );

    // Create or update resident
    await Resident.findOneAndUpdate(
      { resident_id: doc.resident.resident_id },
      {
        full_name: doc.resident.name,
        phone: doc.resident.phone,
        email: doc.resident.email,
        current_unit: {
          unit_id: doc.unit.unit_id,
          building: doc.unit.building,
          move_in_date: doc.move_in_date,
          lease_expiry: doc.lease_end,
          monthly_rent: doc.monthly_rent
        },
        $push: {
          occupancy_history: {
            unit_id: doc.unit.unit_id,
            building: doc.unit.building,
            move_in: doc.move_in_date,
            move_out: doc.move_out_date,
            rent: doc.monthly_rent
          }
        },
        'metadata.updated_at': new Date()
      },
      { upsert: true, new: true }
    );
  }

  if (doc.movement_type === 'Move-Out' || doc.movement_type === 'Termination') {
    await Unit.findOneAndUpdate(
      { unit_id: doc.unit.unit_id },
      {
        status: 'Vacant',
        current_resident: null,
        current_move_in: null,
        current_move_out: null,
        lease_expiry: null,
        current_rent: 0,
        'metadata.updated_at': new Date()
      }
    );

    await Resident.findOneAndUpdate(
      { resident_id: doc.resident.resident_id },
      {
        'current_unit': null,
        'metadata.updated_at': new Date()
      }
    );
  }

  if (doc.movement_type === 'Renewal') {
    await Unit.findOneAndUpdate(
      { unit_id: doc.unit.unit_id },
      {
        lease_expiry: doc.lease_end,
        current_rent: doc.monthly_rent,
        'metadata.updated_at': new Date()
      }
    );

    await Resident.findOneAndUpdate(
      { resident_id: doc.resident.resident_id },
      {
        'current_unit.lease_expiry': doc.lease_end,
        'current_unit.monthly_rent': doc.monthly_rent,
        'metadata.updated_at': new Date()
      }
    );
  }
});

// Auto-update resident balance when payment is recorded
PaymentSchema.post('save', async function(doc) {
  if (doc.status === 'Cleared') {
    const Resident = mongoose.model('Resident');
    const Unit = mongoose.model('Unit');

    // Update resident totals
    await Resident.findOneAndUpdate(
      { resident_id: doc.resident_id },
      {
        $inc: { total_paid_to_date: doc.amount },
        'metadata.updated_at': new Date()
      }
    );

    // Update unit revenue
    if (doc.payment_type === 'Rent') {
      await Unit.findOneAndUpdate(
        { unit_id: doc.unit_id },
        {
          $inc: { revenue_to_date: doc.amount },
          'metadata.updated_at': new Date()
        }
      );
    }
  }
});

module.exports = {
  Unit: mongoose.model('Unit', UnitSchema),
  Resident: mongoose.model('Resident', ResidentSchema),
  Movement: mongoose.model('Movement', MovementSchema),
  Payment: mongoose.model('Payment', PaymentSchema)
};


const mongoose = require('mongoose');

// ==========================================
// ROY MEDITERRANEAN BY AZIZI PROPERTY - ATC
// COMPLETE DOCUMENT MANAGEMENT SYSTEM
// All real estate documents tracked
// ==========================================

const DocumentSchema = new mongoose.Schema({
  document_id: { type: String, unique: true, required: true },

  // What type of document
  document_category: {
    type: String,
    enum: [
      'Title Deed',           // ملكية
      'Owner Passport',       // جواز المالك
      'Owner ID',             // هوية المالك
      'Ejari',                // إيجاري
      'Tenancy Contract',     // عقد الإيجار
      'Tenant Passport',      // جواز المستأجر
      'Tenant ID',            // هوية المستأجر
      'Move In Permit',       // تصريح الدخول
      'Move Out Permit',      // تصريح الخروج
      'NOC',                  // No Objection Certificate
      'DEWA Bill',            // فاتورة الكهرباء
      'Gas Connection',       // توصيل الغاز
      'Insurance',            // تأمين
      'Maintenance Report',   // تقرير الصيانة
      'Inspection Report',    // تقرير الفحص
      'Other'
    ],
    required: true
  },

  // Document classification
  document_type: {
    type: String,
    enum: ['Legal', 'Identity', 'Contract', 'Permit', 'Utility', 'Financial', 'Other'],
    required: true
  },

  // Linked to which entity
  linked_to: {
    entity_type: { 
      type: String, 
      enum: ['Unit', 'Owner', 'Tenant', 'Movement', 'Payment'],
      required: true 
    },
    entity_id: { type: String, required: true }, // unit_id, resident_id, movement_id, etc.
    unit_id: String, // Always track unit for easy retrieval
    building: String
  },

  // Document details
  title: { type: String, required: true },
  description: String,

  // File information
  file: {
    original_name: String,
    stored_name: String, // UUID or hashed name
    path: String, // Relative path in storage
    url: String, // Full URL if cloud storage
    size: Number, // bytes
    mime_type: String,
    extension: String,
    checksum: String // For integrity verification
  },

  // Document metadata
  issue_date: Date,
  expiry_date: Date,
  document_number: String, // Passport number, Title deed number, etc.
  issuing_authority: String, // DLD, DEWA, etc.

  // Status
  status: {
    type: String,
    enum: ['Active', 'Expired', 'Pending Renewal', 'Revoked', 'Draft'],
    default: 'Active'
  },

  // Verification
  verified: {
    is_verified: { type: Boolean, default: false },
    verified_by: String,
    verified_at: Date,
    verification_method: String
  },

  // Access control
  access_level: {
    type: String,
    enum: ['Public', 'Internal', 'Confidential', 'Restricted'],
    default: 'Internal'
  },

  // Audit
  uploaded_by: {
    user_id: String,
    user_name: String,
    user_role: String
  },

  // Version control
  version: { type: Number, default: 1 },
  previous_versions: [{
    version: Number,
    document_id: String,
    replaced_at: Date,
    replaced_by: String
  }],

  // Tags for search
  tags: [String],

  // Auto-timestamp
  metadata: {
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
  }
});

// Indexes for fast search
DocumentSchema.index({ document_category: 1, 'linked_to.unit_id': 1 });
DocumentSchema.index({ 'linked_to.entity_id': 1, document_category: 1 });
DocumentSchema.index({ expiry_date: 1 }); // For finding expiring documents
DocumentSchema.index({ status: 1 });

// Pre-save middleware to auto-set document_type based on category
DocumentSchema.pre('save', function(next) {
  const categoryToType = {
    'Title Deed': 'Legal',
    'Owner Passport': 'Identity',
    'Owner ID': 'Identity',
    'Ejari': 'Contract',
    'Tenancy Contract': 'Contract',
    'Tenant Passport': 'Identity',
    'Tenant ID': 'Identity',
    'Move In Permit': 'Permit',
    'Move Out Permit': 'Permit',
    'NOC': 'Permit',
    'DEWA Bill': 'Utility',
    'Gas Connection': 'Utility',
    'Insurance': 'Financial',
    'Maintenance Report': 'Other',
    'Inspection Report': 'Other'
  };

  if (!this.document_type && this.document_category) {
    this.document_type = categoryToType[this.document_category] || 'Other';
  }

  // Auto-update status based on expiry
  if (this.expiry_date && this.expiry_date < new Date()) {
    this.status = 'Expired';
  }

  next();
});

// Static method to find expiring documents
DocumentSchema.statics.findExpiring = function(days = 30) {
  const future = new Date();
  future.setDate(future.getDate() + days);

  return this.find({
    expiry_date: { $gte: new Date(), $lte: future },
    status: { $ne: 'Expired' }
  }).sort({ expiry_date: 1 });
};

// Method to check if document is required for operation
DocumentSchema.methods.isRequiredFor = function(operation) {
  const requirements = {
    'Move-In': ['Tenancy Contract', 'Tenant Passport', 'Tenant ID', 'Ejari', 'Move In Permit'],
    'Move-Out': ['Move Out Permit', 'DEWA Final Bill'],
    'Sale': ['Title Deed', 'Owner Passport', 'Owner ID', 'NOC'],
    'Renewal': ['Tenancy Contract', 'Ejari']
  };

  return requirements[operation]?.includes(this.document_category);
};

module.exports = mongoose.model('Document', DocumentSchema);
