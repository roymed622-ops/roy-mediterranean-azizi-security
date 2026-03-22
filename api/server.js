const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Unit, Resident, Movement, Payment } = require('./models');

require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// ROY MEDITERRANEAN BY AZIZI PROPERTY - ATC
// API Server
// Just POST data → Everything auto-updates
// ==========================================

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/roy_mediterranean';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connected to Roy Mediterranean Database');
}).catch(err => {
  console.error('❌ Database connection error:', err);
});

// ==========================================
// 1. UNITS - Just add unit, status auto-updates from movements
// ==========================================

// POST: Add new unit (just basic info)
app.post('/api/units', async (req, res) => {
  try {
    const { building, unit_type, floor } = req.body;

    // Auto-generate unit_id
    const count = await Unit.countDocuments({ building }) + 1;
    const unit_id = `${building}-${String(count).padStart(3, '0')}`;

    const unit = new Unit({
      unit_id,
      building,
      unit_type,
      floor,
      status: 'Vacant'
    });

    await unit.save();

    res.status(201).json({
      success: true,
      message: 'Unit added to Roy Mediterranean',
      unit
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET: All units with auto-calculated status
app.get('/api/units', async (req, res) => {
  try {
    const { status, building, unit_type } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (building) filter.building = building;
    if (unit_type) filter.unit_type = unit_type;

    const units = await Unit.find(filter)
      .populate('current_resident', 'full_name phone')
      .sort({ building: 1, unit_id: 1 });

    // Add days until expiry for occupied units
    const unitsWithMetrics = units.map(u => {
      const unitObj = u.toObject();
      if (u.lease_expiry) {
        const daysLeft = Math.ceil((new Date(u.lease_expiry) - new Date()) / (1000 * 60 * 60 * 24));
        unitObj.days_until_expiry = daysLeft;
        unitObj.expiry_status = daysLeft <= 30 ? 'urgent' : daysLeft <= 60 ? 'warning' : 'good';
      }
      return unitObj;
    });

    res.json({
      success: true,
      count: units.length,
      units: unitsWithMetrics
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET: Single unit with full history
app.get('/api/units/:unit_id', async (req, res) => {
  try {
    const unit = await Unit.findOne({ unit_id: req.params.unit_id })
      .populate('current_resident');

    if (!unit) {
      return res.status(404).json({ success: false, error: 'Unit not found' });
    }

    // Get all movements for this unit
    const movements = await Movement.find({ 'unit.unit_id': req.params.unit_id })
      .sort({ 'metadata.created_at': -1 });

    // Get all payments for this unit
    const payments = await Payment.find({ unit_id: req.params.unit_id })
      .sort({ 'metadata.created_at': -1 });

    res.json({
      success: true,
      unit,
      movements,
      payments,
      occupancy_rate: (unit.total_occupancy_days / 365 * 100).toFixed(1) + '%'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 2. MOVEMENTS - THE KEY: Just add movement, everything auto-updates
// ==========================================

// POST: Record movement → Auto-updates unit & resident
app.post('/api/movements', async (req, res) => {
  try {
    const movementData = req.body;

    // Auto-generate IDs
    const today = new Date();
    const count = await Movement.countDocuments({
      'metadata.created_at': {
        $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
      }
    }) + 1;

    const movement_id = `MOV-${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}-${String(count).padStart(4,'0')}`;

    // Auto-generate resident_id if new
    let resident_id = movementData.resident?.resident_id;
    if (!resident_id && movementData.movement_type === 'Move-In') {
      const residentCount = await Resident.countDocuments() + 1;
      resident_id = `RES-${String(residentCount).padStart(5,'0')}`;
    }

    const movement = new Movement({
      movement_id,
      ...movementData,
      resident: {
        ...movementData.resident,
        resident_id
      }
    });

    await movement.save();

    // Everything else auto-updates via middleware!

    res.status(201).json({
      success: true,
      message: `${movementData.movement_type} recorded successfully`,
      movement_id,
      auto_updated: {
        unit_status: 'Updated',
        resident_record: 'Updated/Created',
        financials: 'Updated'
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET: All movements with filters
app.get('/api/movements', async (req, res) => {
  try {
    const { type, unit_id, resident_id, from_date, to_date } = req.query;
    const filter = {};

    if (type) filter.movement_type = type;
    if (unit_id) filter['unit.unit_id'] = unit_id;
    if (resident_id) filter['resident.resident_id'] = resident_id;
    if (from_date || to_date) {
      filter['metadata.created_at'] = {};
      if (from_date) filter['metadata.created_at'].$gte = new Date(from_date);
      if (to_date) filter['metadata.created_at'].$lte = new Date(to_date);
    }

    const movements = await Movement.find(filter)
      .sort({ 'metadata.created_at': -1 })
      .limit(100);

    res.json({
      success: true,
      count: movements.length,
      movements
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 3. PAYMENTS - Just add payment, balances auto-update
// ==========================================

// POST: Record payment → Auto-updates resident balance & unit revenue
app.post('/api/payments', async (req, res) => {
  try {
    const paymentData = req.body;

    // Auto-generate payment_id
    const today = new Date();
    const count = await Payment.countDocuments({
      'metadata.created_at': {
        $gte: new Date(today.getFullYear(), today.getMonth(), 1),
        $lt: new Date(today.getFullYear(), today.getMonth() + 1, 1)
      }
    }) + 1;

    const payment_id = `PAY-${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}-${String(count).padStart(5,'0')}`;

    // Auto-generate receipt number if cleared
    const receipt_number = paymentData.status === 'Cleared' 
      ? `RCP-${today.getFullYear()}-${String(count).padStart(6,'0')}`
      : null;

    const payment = new Payment({
      payment_id,
      receipt_number,
      ...paymentData
    });

    await payment.save();

    // Resident balance auto-updates via middleware!

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      payment_id,
      receipt_number,
      auto_updated: {
        resident_balance: 'Updated',
        unit_revenue: 'Updated'
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET: All payments
app.get('/api/payments', async (req, res) => {
  try {
    const { resident_id, unit_id, status, payment_type } = req.query;
    const filter = {};

    if (resident_id) filter.resident_id = resident_id;
    if (unit_id) filter.unit_id = unit_id;
    if (status) filter.status = status;
    if (payment_type) filter.payment_type = payment_type;

    const payments = await Payment.find(filter)
      .sort({ 'metadata.created_at': -1 })
      .limit(100);

    res.json({
      success: true,
      count: payments.length,
      payments
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST: Update payment status (e.g., Cheque cleared)
app.patch('/api/payments/:payment_id/status', async (req, res) => {
  try {
    const { status } = req.body;

    const payment = await Payment.findOneAndUpdate(
      { payment_id: req.params.payment_id },
      { status, receipt_generated: status === 'Cleared' },
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    // If now cleared, auto-updates will trigger via middleware

    res.json({
      success: true,
      message: `Payment status updated to ${status}`,
      payment
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==========================================
// 4. RESIDENTS - Auto-populated from movements
// ==========================================

// GET: All residents (auto-populated)
app.get('/api/residents', async (req, res) => {
  try {
    const { status, building } = req.query;
    const filter = {};

    if (status) filter.payment_status = status;
    if (building) filter['current_unit.building'] = building;

    const residents = await Resident.find(filter)
      .sort({ 'metadata.updated_at': -1 });

    res.json({
      success: true,
      count: residents.length,
      residents
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET: Single resident with full history
app.get('/api/residents/:resident_id', async (req, res) => {
  try {
    const resident = await Resident.findOne({ resident_id: req.params.resident_id });

    if (!resident) {
      return res.status(404).json({ success: false, error: 'Resident not found' });
    }

    // Get all movements
    const movements = await Movement.find({ 'resident.resident_id': req.params.resident_id })
      .sort({ 'metadata.created_at': -1 });

    // Get all payments
    const payments = await Payment.find({ resident_id: req.params.resident_id })
      .sort({ 'metadata.created_at': -1 });

    // Calculate balance
    const totalRentDue = movements.reduce((sum, m) => {
      if (m.movement_type === 'Move-In' || m.movement_type === 'Renewal') {
        const months = Math.ceil((new Date(m.lease_end) - new Date(m.lease_start)) / (1000 * 60 * 60 * 24 * 30));
        return sum + (m.monthly_rent * months);
      }
      return sum;
    }, 0);

    const totalPaid = payments
      .filter(p => p.status === 'Cleared' && p.payment_type === 'Rent')
      .reduce((sum, p) => sum + p.amount, 0);

    res.json({
      success: true,
      resident,
      movements,
      payments,
      financial_summary: {
        total_rent_due: totalRentDue,
        total_paid: totalPaid,
        balance: totalRentDue - totalPaid,
        status: totalPaid >= totalRentDue ? 'Paid Ahead' : totalPaid >= totalRentDue * 0.9 ? 'Current' : 'Overdue'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 5. DASHBOARD - Auto-calculated metrics
// ==========================================

app.get('/api/dashboard', async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Unit stats
    const totalUnits = await Unit.countDocuments();
    const occupiedUnits = await Unit.countDocuments({ status: 'Occupied' });
    const vacantUnits = await Unit.countDocuments({ status: 'Vacant' });
    const maintenanceUnits = await Unit.countDocuments({ status: 'Maintenance' });

    // Revenue stats
    const thisMonthPayments = await Payment.find({
      'metadata.created_at': { $gte: startOfMonth },
      status: 'Cleared',
      payment_type: 'Rent'
    });
    const monthlyRevenue = thisMonthPayments.reduce((sum, p) => sum + p.amount, 0);

    // Expiring leases (next 30 days)
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringUnits = await Unit.find({
      status: 'Occupied',
      lease_expiry: { $lte: thirtyDaysFromNow, $gte: today }
    });

    // Recent movements
    const recentMovements = await Movement.find()
      .sort({ 'metadata.created_at': -1 })
      .limit(5);

    // Building breakdown
    const buildingStats = await Unit.aggregate([
      { $group: {
        _id: '$building',
        total: { $sum: 1 },
        occupied: { $sum: { $cond: [{ $eq: ['$status', 'Occupied'] }, 1, 0] } },
        revenue: { $sum: '$revenue_to_date' }
      }}
    ]);

    res.json({
      success: true,
      property_name: 'Roy Mediterranean by Azizi Property',
      managed_by: 'ATC',
      date: today,
      summary: {
        total_units: totalUnits,
        occupied: occupiedUnits,
        vacant: vacantUnits,
        maintenance: maintenanceUnits,
        occupancy_rate: ((occupiedUnits / totalUnits) * 100).toFixed(1) + '%'
      },
      financial: {
        this_month_revenue: monthlyRevenue,
        total_revenue_to_date: await Unit.aggregate([{ $group: { _id: null, total: { $sum: '$revenue_to_date' } } }]).then(r => r[0]?.total || 0),
        deposits_held: await Unit.aggregate([{ $group: { _id: null, total: { $sum: '$deposit_held' } } }]).then(r => r[0]?.total || 0)
      },
      alerts: {
        expiring_leases: expiringUnits.length,
        expiring_list: expiringUnits.map(u => ({
          unit_id: u.unit_id,
          lease_expiry: u.lease_expiry,
          days_left: Math.ceil((u.lease_expiry - today) / (1000 * 60 * 60 * 24))
        }))
      },
      building_breakdown: buildingStats,
      recent_activity: recentMovements
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 6. REPORTS - Auto-generated
// ==========================================

app.get('/api/reports/occupancy', async (req, res) => {
  try {
    const { year = new Date().getFullYear(), month } = req.query;

    const movements = await Movement.find({
      'metadata.created_at': {
        $gte: new Date(year, month ? month - 1 : 0, 1),
        $lt: month ? new Date(year, month, 1) : new Date(year + 1, 0, 1)
      }
    });

    const moveIns = movements.filter(m => m.movement_type === 'Move-In').length;
    const moveOuts = movements.filter(m => m.movement_type === 'Move-Out').length;
    const renewals = movements.filter(m => m.movement_type === 'Renewal').length;

    res.json({
      success: true,
      period: month ? `${month}/${year}` : year,
      move_ins: moveIns,
      move_outs: moveOuts,
      renewals: renewals,
      net_change: moveIns - moveOuts
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/reports/financial', async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;

    const payments = await Payment.find({
      'metadata.created_at': {
        $gte: new Date(year, 0, 1),
        $lt: new Date(year + 1, 0, 1)
      },
      status: 'Cleared'
    });

    const byMonth = {};
    for (let i = 1; i <= 12; i++) {
      byMonth[i] = { rent: 0, deposits: 0, fees: 0, other: 0 };
    }

    payments.forEach(p => {
      const month = new Date(p.metadata.created_at).getMonth() + 1;
      if (p.payment_type === 'Rent') byMonth[month].rent += p.amount;
      else if (p.payment_type === 'Deposit') byMonth[month].deposits += p.amount;
      else if (p.payment_type === 'Agency Fee') byMonth[month].fees += p.amount;
      else byMonth[month].other += p.amount;
    });

    res.json({
      success: true,
      year,
      monthly_breakdown: byMonth,
      total: {
        rent: Object.values(byMonth).reduce((sum, m) => sum + m.rent, 0),
        deposits: Object.values(byMonth).reduce((sum, m) => sum + m.deposits, 0),
        fees: Object.values(byMonth).reduce((sum, m) => sum + m.fees, 0),
        other: Object.values(byMonth).reduce((sum, m) => sum + m.other, 0)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// START SERVER
// ==========================================



// ==========================================
// DOCUMENT MANAGEMENT API
// Upload and manage all real estate documents
// ==========================================

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const categoryDir = path.join(uploadDir, req.body.document_category?.replace(/\s+/g, '_') || 'Other');

    // Create directory if doesn't exist
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
    }

    cb(null, categoryDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: DOC-{timestamp}-{random}.{ext}
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const hash = crypto.createHash('md5').update(uniqueSuffix).digest('hex').substring(0, 8);
    const ext = path.extname(file.originalname);
    cb(null, `DOC-${hash}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
    files: 10 // Max 10 files per upload
  },
  fileFilter: (req, file, cb) => {
    // Allowed file types
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPG, PNG, TIFF, DOC allowed.'), false);
    }
  }
});

// Initialize Document model
const Document = mongoose.model('Document');

// ==========================================
// DOCUMENT UPLOAD ENDPOINTS
// ==========================================

// POST: Upload single document
app.post('/api/documents/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const {
      document_category,
      entity_type,
      entity_id,
      title,
      description,
      issue_date,
      expiry_date,
      document_number,
      issuing_authority,
      tags
    } = req.body;

    // Validate required fields
    if (!document_category || !entity_type || !entity_id || !title) {
      // Remove uploaded file if validation fails
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: document_category, entity_type, entity_id, title' 
      });
    }

    // Generate document ID
    const today = new Date();
    const count = await Document.countDocuments({
      'metadata.created_at': {
        $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate())
      }
    }) + 1;
    const document_id = `FILE-${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}-${String(count).padStart(4,'0')}`;

    // Get unit info if linked to unit/tenant/movement
    let unit_id = entity_id;
    let building = '';

    if (entity_type === 'Unit') {
      const unit = await Unit.findOne({ unit_id: entity_id });
      if (unit) building = unit.building;
    } else if (entity_type === 'Tenant') {
      const resident = await Resident.findOne({ resident_id: entity_id });
      if (resident && resident.current_unit) {
        unit_id = resident.current_unit.unit_id;
        building = resident.current_unit.building;
      }
    } else if (entity_type === 'Movement') {
      const movement = await Movement.findOne({ movement_id: entity_id });
      if (movement) {
        unit_id = movement.unit.unit_id;
        building = movement.unit.building;
      }
    }

    // Calculate file hash for integrity
    const fileBuffer = fs.readFileSync(req.file.path);
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Create document record
    const document = new Document({
      document_id,
      document_category,
      document_type: getDocumentType(document_category),
      linked_to: {
        entity_type,
        entity_id,
        unit_id,
        building
      },
      title,
      description: description || '',
      file: {
        original_name: req.file.originalname,
        stored_name: path.basename(req.file.path),
        path: req.file.path,
        url: `/uploads/${document_category.replace(/\s+/g, '_')}/${path.basename(req.file.path)}`,
        size: req.file.size,
        mime_type: req.file.mimetype,
        extension: path.extname(req.file.originalname),
        checksum
      },
      issue_date: issue_date ? new Date(issue_date) : null,
      expiry_date: expiry_date ? new Date(expiry_date) : null,
      document_number: document_number || '',
      issuing_authority: issuing_authority || '',
      status: expiry_date && new Date(expiry_date) < new Date() ? 'Expired' : 'Active',
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
      uploaded_by: {
        user_id: req.body.user_id || 'system',
        user_name: req.body.user_name || 'System',
        user_role: req.body.user_role || 'admin'
      }
    });

    await document.save();

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      document_id,
      document: {
        id: document_id,
        category: document_category,
        title,
        file_size: (req.file.size / 1024).toFixed(2) + ' KB',
        url: document.file.url
      }
    });

  } catch (error) {
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST: Upload multiple documents (batch)
app.post('/api/documents/upload-batch', upload.array('documents', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    const results = [];
    const errors = [];

    // Parse metadata from form (can be JSON array or single values)
    let metadata = [];
    try {
      metadata = JSON.parse(req.body.metadata || '[]');
    } catch (e) {
      // If not JSON array, use single values for all files
      metadata = req.files.map(() => ({
        document_category: req.body.document_category,
        entity_type: req.body.entity_type,
        entity_id: req.body.entity_id,
        title: req.body.title,
        description: req.body.description
      }));
    }

    for (let i = 0; i < req.files.length; i++) {
      try {
        const file = req.files[i];
        const meta = metadata[i] || metadata[0] || {};

        if (!meta.document_category || !meta.entity_type || !meta.entity_id) {
          errors.push({ file: file.originalname, error: 'Missing metadata' });
          fs.unlinkSync(file.path);
          continue;
        }

        const today = new Date();
        const count = await Document.countDocuments() + i + 1;
        const document_id = `FILE-${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}-${String(count).padStart(4,'0')}`;

        const fileBuffer = fs.readFileSync(file.path);
        const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        const document = new Document({
          document_id,
          document_category: meta.document_category,
          document_type: getDocumentType(meta.document_category),
          linked_to: {
            entity_type: meta.entity_type,
            entity_id: meta.entity_id,
            unit_id: meta.entity_id,
            building: ''
          },
          title: meta.title || file.originalname,
          description: meta.description || '',
          file: {
            original_name: file.originalname,
            stored_name: path.basename(file.path),
            path: file.path,
            url: `/uploads/${meta.document_category.replace(/\s+/g, '_')}/${path.basename(file.path)}`,
            size: file.size,
            mime_type: file.mimetype,
            extension: path.extname(file.originalname),
            checksum
          },
          uploaded_by: {
            user_id: req.body.user_id || 'system',
            user_name: req.body.user_name || 'System',
            user_role: req.body.user_role || 'admin'
          }
        });

        await document.save();
        results.push({
          file: file.originalname,
          document_id,
          success: true
        });

      } catch (err) {
        errors.push({ file: req.files[i].originalname, error: err.message });
        if (fs.existsSync(req.files[i].path)) {
          fs.unlinkSync(req.files[i].path);
        }
      }
    }

    res.json({
      success: true,
      message: `Uploaded ${results.length} of ${req.files.length} documents`,
      successful: results,
      failed: errors
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET: All documents with filters
app.get('/api/documents', async (req, res) => {
  try {
    const {
      category,
      entity_type,
      entity_id,
      unit_id,
      status,
      expiring_days,
      search,
      page = 1,
      limit = 20
    } = req.query;

    const filter = {};

    if (category) filter.document_category = category;
    if (entity_type) filter['linked_to.entity_type'] = entity_type;
    if (entity_id) filter['linked_to.entity_id'] = entity_id;
    if (unit_id) filter['linked_to.unit_id'] = unit_id;
    if (status) filter.status = status;

    if (expiring_days) {
      const future = new Date();
      future.setDate(future.getDate() + parseInt(expiring_days));
      filter.expiry_date = { $gte: new Date(), $lte: future };
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { document_number: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const documents = await Document.find(filter)
      .sort({ 'metadata.created_at': -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const count = await Document.countDocuments(filter);

    res.json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      documents: documents.map(d => ({
        document_id: d.document_id,
        category: d.document_category,
        type: d.document_type,
        title: d.title,
        linked_to: d.linked_to,
        status: d.status,
        expiry_date: d.expiry_date,
        file_size: (d.file.size / 1024).toFixed(2) + ' KB',
        uploaded_at: d.metadata.created_at,
        url: d.file.url
      }))
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET: Single document details
app.get('/api/documents/:document_id', async (req, res) => {
  try {
    const document = await Document.findOne({ document_id: req.params.document_id });

    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    res.json({
      success: true,
      document
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET: Documents for a specific unit (consolidated view)
app.get('/api/units/:unit_id/documents', async (req, res) => {
  try {
    const unit_id = req.params.unit_id;

    // Find all documents linked to this unit or its tenants/movements
    const documents = await Document.find({
      $or: [
        { 'linked_to.unit_id': unit_id },
        { 'linked_to.entity_id': unit_id }
      ]
    }).sort({ document_category: 1, 'metadata.created_at': -1 });

    // Group by category
    const grouped = documents.reduce((acc, doc) => {
      if (!acc[doc.document_category]) {
        acc[doc.document_category] = [];
      }
      acc[doc.document_category].push({
        document_id: doc.document_id,
        title: doc.title,
        status: doc.status,
        expiry_date: doc.expiry_date,
        file_size: (doc.file.size / 1024).toFixed(2) + ' KB',
        uploaded_at: doc.metadata.created_at,
        url: doc.file.url
      });
      return acc;
    }, {});

    res.json({
      success: true,
      unit_id,
      total_documents: documents.length,
      categories: Object.keys(grouped),
      documents_by_category: grouped
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET: Check missing documents for operation
app.get('/api/units/:unit_id/check-documents', async (req, res) => {
  try {
    const { operation } = req.query; // Move-In, Move-Out, Sale, Renewal
    const unit_id = req.params.unit_id;

    const requirements = {
      'Move-In': ['Tenancy Contract', 'Tenant Passport', 'Tenant ID', 'Ejari', 'Move In Permit'],
      'Move-Out': ['Move Out Permit'],
      'Sale': ['Title Deed', 'Owner Passport', 'Owner ID', 'NOC'],
      'Renewal': ['Tenancy Contract', 'Ejari']
    };

    const required = requirements[operation] || [];

    // Find existing documents
    const existing = await Document.find({
      'linked_to.unit_id': unit_id,
      document_category: { $in: required },
      status: { $ne: 'Expired' }
    });

    const existingCategories = existing.map(d => d.document_category);
    const missing = required.filter(r => !existingCategories.includes(r));

    res.json({
      success: true,
      unit_id,
      operation,
      required_documents: required,
      existing_documents: existingCategories,
      missing_documents: missing,
      is_complete: missing.length === 0,
      documents: existing.map(d => ({
        category: d.document_category,
        document_id: d.document_id,
        title: d.title,
        status: d.status,
        expiry_date: d.expiry_date
      }))
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET: Expiring documents (dashboard alert)
app.get('/api/documents/expiring/:days', async (req, res) => {
  try {
    const days = parseInt(req.params.days) || 30;
    const documents = await Document.findExpiring(days);

    res.json({
      success: true,
      days,
      count: documents.length,
      documents: documents.map(d => ({
        document_id: d.document_id,
        category: d.document_category,
        title: d.title,
        linked_to: d.linked_to,
        expiry_date: d.expiry_date,
        days_remaining: Math.ceil((d.expiry_date - new Date()) / (1000 * 60 * 60 * 24))
      }))
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT: Update document metadata
app.put('/api/documents/:document_id', async (req, res) => {
  try {
    const updates = req.body;
    delete updates.file; // Prevent file modification
    delete updates.document_id; // Prevent ID change

    updates['metadata.updated_at'] = new Date();

    const document = await Document.findOneAndUpdate(
      { document_id: req.params.document_id },
      { $set: updates },
      { new: true }
    );

    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    res.json({
      success: true,
      message: 'Document updated',
      document
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE: Remove document
app.delete('/api/documents/:document_id', async (req, res) => {
  try {
    const document = await Document.findOne({ document_id: req.params.document_id });

    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    // Delete physical file
    if (fs.existsSync(document.file.path)) {
      fs.unlinkSync(document.file.path);
    }

    // Delete database record
    await Document.deleteOne({ document_id: req.params.document_id });

    res.json({
      success: true,
      message: 'Document deleted'
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET: Download document
app.get('/api/documents/:document_id/download', async (req, res) => {
  try {
    const document = await Document.findOne({ document_id: req.params.document_id });

    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    if (!fs.existsSync(document.file.path)) {
      return res.status(404).json({ success: false, error: 'File not found on server' });
    }

    res.download(document.file.path, document.file.original_name);

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET: Document statistics
app.get('/api/documents/stats/overview', async (req, res) => {
  try {
    const stats = await Document.aggregate([
      {
        $group: {
          _id: '$document_category',
          count: { $sum: 1 },
          total_size: { $sum: '$file.size' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const totalDocuments = await Document.countDocuments();
    const expiredDocuments = await Document.countDocuments({ status: 'Expired' });
    const expiringSoon = await Document.countDocuments({
      expiry_date: { $gte: new Date(), $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
    });

    res.json({
      success: true,
      overview: {
        total_documents: totalDocuments,
        expired: expiredDocuments,
        expiring_30_days: expiringSoon
      },
      by_category: stats
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function
function getDocumentType(category) {
  const map = {
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
  return map[category] || 'Other';
}

// Make uploads directory static
app.use('/uploads', express.static(process.env.UPLOAD_DIR || './uploads'));


app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     ROY MEDITERRANEAN BY AZIZI PROPERTY - ATC         ║');
  console.log('║         Property Management System                     ║');
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log(`║  Server running on port ${PORT}                        ║`);
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log('║  Just add data → System auto-updates everything        ║');
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log('║  Endpoints:                                            ║');
  console.log('║    POST /api/units          → Add new unit             ║');
  console.log('║    POST /api/movements      → Record move-in/out       ║');
  console.log('║    POST /api/payments       → Record payment           ║');
  console.log('║    GET  /api/dashboard      → Auto-calculated stats     ║');
  console.log('╚════════════════════════════════════════════════════════╝');
});
