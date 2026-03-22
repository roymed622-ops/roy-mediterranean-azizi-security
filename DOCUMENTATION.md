# 📁 Document Management System
## Roy Mediterranean by Azizi Property - ATC

### Complete Document Tracking for Real Estate Operations

---

## 📋 Supported Documents

### Legal Documents
| Document | Arabic | Required For | Auto-Expiry Check |
|----------|--------|--------------|-------------------|
| **Title Deed** | ملكية | Sale, Transfer | ❌ |
| **Ejari** | إيجاري | Move-In, Renewal | ✅ Yes |
| **Tenancy Contract** | عقد الإيجار | Move-In, Renewal | ✅ Yes |
| **NOC** | لا مانع | Sale, Transfer | ✅ Yes |

### Identity Documents
| Document | Arabic | Required For | Auto-Expiry Check |
|----------|--------|--------------|-------------------|
| **Owner Passport** | جواز المالك | Sale, Transfer | ✅ Yes |
| **Owner ID** | هوية المالك | All operations | ✅ Yes |
| **Tenant Passport** | جواز المستأجر | Move-In | ✅ Yes |
| **Tenant ID** | هوية المستأجر | Move-In | ✅ Yes |

### Permit Documents
| Document | Arabic | Required For | Auto-Expiry Check |
|----------|--------|--------------|-------------------|
| **Move In Permit** | تصريح الدخول | Move-In | ✅ Yes |
| **Move Out Permit** | تصريح الخروج | Move-Out | ✅ Yes |

### Utility & Other
| Document | Arabic | Purpose |
|----------|--------|---------|
| **DEWA Bill** | فاتورة الكهرباء | Utility proof |
| **Gas Connection** | توصيل الغاز | Safety compliance |
| **Insurance** | تأمين | Property coverage |
| **Maintenance Report** | تقرير الصيانة | Condition record |
| **Inspection Report** | تقرير الفحص | Handover proof |

---

## 🚀 How to Upload Documents

### Method 1: Web Interface

1. Open http://localhost
2. Click **"Document Management"** tab
3. Click **"Upload Document"**
4. Fill the form:
   - **Document Category**: Select from dropdown (Title Deed, Passport, Ejari, etc.)
   - **Linked To**: Unit, Tenant, or Movement
   - **Unit/Entity ID**: Select specific unit
   - **Document Title**: Descriptive name
   - **Document Number**: Passport #, Title Deed #, etc.
   - **Issuing Authority**: DLD, DEWA, etc.
   - **Issue Date**: When document was issued
   - **Expiry Date**: When document expires (system auto-alerts)
   - **File**: Select PDF, JPG, or PNG (max 50MB)
5. Click **"Upload Document"**

### Method 2: API (For Integrations)

```bash
# Upload single document
curl -X POST http://localhost:3000/api/documents/upload   -F "document=@/path/to/title_deed.pdf"   -F "document_category=Title Deed"   -F "entity_type=Unit"   -F "entity_id=A-1202"   -F "title=Title Deed - Ahmed Hassan"   -F "document_number=123-2024-5678"   -F "issuing_authority=DLD"   -F "issue_date=2024-01-15"   -F "expiry_date=2029-01-14"

# Batch upload multiple documents
curl -X POST http://localhost:3000/api/documents/upload-batch   -F "documents=@passport.pdf"   -F "documents=@ejari.pdf"   -F "documents=@contract.pdf"   -F 'metadata=[
    {"document_category":"Tenant Passport","entity_type":"Tenant","entity_id":"RES-00001","title":"Ahmed Passport"},
    {"document_category":"Ejari","entity_type":"Unit","entity_id":"A-1202","title":"Ejari Registration"},
    {"document_category":"Tenancy Contract","entity_type":"Movement","entity_id":"MOV-202401010001","title":"2024 Contract"}
  ]'
```

---

## 🔍 Document Checker (Missing Documents)

### Check Required Documents for Any Operation

1. Go to **Document Management** tab
2. Click **"Check Missing"**
3. Select:
   - **Unit**: A-1202
   - **Operation**: Move-In / Move-Out / Sale / Renewal
4. Click **"Check Documents"**

### System Shows:
- ✅ **Present Documents**: Already uploaded
- ❌ **Missing Documents**: Need to upload
- 📊 **Completion Status**: Ready to proceed or not

### Example Output:
```
Operation: Move-In
Unit: A-1202

✅ Present (3/6):
   - Ejari
   - Tenancy Contract
   - Tenant Passport

❌ Missing (3/6):
   - Tenant ID (Emirates ID)
   - Move In Permit
   - DEWA Connection

Status: ❌ NOT READY - Upload missing documents first
```

---

## ⚠️ Auto-Expiry Alerts

### System Automatically Tracks:
- Passport expiry dates
- Emirates ID expiry dates
- Ejari registration expiry
- Tenancy contract end dates
- Permit validity periods

### Dashboard Shows:
- **Red Alert**: Document expired
- **Amber Alert**: Expires in ≤30 days
- **Green**: Valid and current

### API to Check Expiring:
```bash
# Get all documents expiring in next 30 days
GET /api/documents/expiring/30

Response:
{
  "count": 5,
  "documents": [
    {
      "document_id": "FILE-20240115-0001",
      "category": "Tenant Passport",
      "title": "Ahmed Hassan Passport",
      "expiry_date": "2024-02-15",
      "days_remaining": 15
    }
  ]
}
```

---

## 📂 File Storage Structure

```
/uploads/
├── Title_Deed/
│   └── DOC-a1b2c3d4.pdf
├── Owner_Passport/
│   └── DOC-e5f6g7h8.jpg
├── Ejari/
│   └── DOC-i9j0k1l2.pdf
├── Tenancy_Contract/
│   └── DOC-m3n4o5p6.pdf
├── Tenant_Passport/
├── Tenant_ID/
├── Move_In_Permit/
├── Move_Out_Permit/
├── NOC/
├── DEWA_Bill/
├── Insurance/
└── Other/
```

---

## 🔐 Security Features

| Feature | Description |
|---------|-------------|
| **File Type Validation** | Only PDF, JPG, PNG, TIFF, DOC allowed |
| **Size Limit** | Max 50MB per file |
| **Virus Scan Ready** | Hook for ClamAV integration |
| **Checksum Verification** | SHA-256 hash for integrity |
| **Access Control** | Public/Internal/Confidential/Restricted levels |
| **Audit Trail** | Who uploaded, when, from where |
| **Version Control** | Track document replacements |

---

## 📊 Document Statistics API

```bash
GET /api/documents/stats/overview

Response:
{
  "overview": {
    "total_documents": 450,
    "expired": 12,
    "expiring_30_days": 8
  },
  "by_category": [
    { "_id": "Tenancy Contract", "count": 120, "total_size": 45000000 },
    { "_id": "Ejari", "count": 120, "total_size": 24000000 },
    { "_id": "Passport", "count": 98, "total_size": 35000000 }
  ]
}
```

---

## 🔄 Integration with Movements

When you record a **Move-In** movement, system can check:
```bash
GET /api/units/A-1202/check-documents?operation=Move-In
```

Required for Move-In:
1. ✅ Ejari registered
2. ✅ Tenancy Contract signed
3. ✅ Tenant Passport valid
4. ✅ Tenant Emirates ID valid
5. ✅ Move In Permit obtained

**System prevents move-in if documents missing!**

---

## 📱 Mobile Upload Support

Interface works on mobile devices:
- Camera capture for documents
- Touch-friendly upload zone
- Native file picker integration
- Compressed image upload (auto)

---

## 🎯 Best Practices

### Naming Convention:
- `Title Deed - [Owner Name]`
- `Passport - [Person Name] - [Nationality]`
- `Ejari - [Unit ID] - [Year]`
- `Contract - [Unit ID] - [Tenant Name]`

### Document Quality:
- Minimum 300 DPI for scans
- Color documents preferred
- All corners visible
- No shadows or glare
- PDF for multi-page, JPG for single page

### Expiry Management:
- Upload documents immediately upon receipt
- Set expiry dates accurately
- Renew 30 days before expiry
- Archive old versions when replacing

---

## 🛠️ Troubleshooting

### Upload Fails?
1. Check file size (< 50MB)
2. Check file type (PDF, JPG, PNG only)
3. Check disk space on server
4. Check network connection

### File Not Found?
1. Verify document ID
2. Check if physically deleted from /uploads
3. Restore from backup if needed

### Expiry Alerts Wrong?
1. Verify expiry date entered correctly
2. Check system timezone (Asia/Dubai)
3. Update document if date changed

---

**Document Management System v1.0**
**Roy Mediterranean by Azizi Property**
**Managed by ATC**
