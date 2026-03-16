# Product Requirements Document (PRD)
## Unstructured Data Collector for RAG AI Ingestion System

---

**Document Title:** Unstructured Data Collector — RAG AI Ingestion System  
**Version:** 2.0  
**Date:** March 16, 2026  
**Status:** Implemented (v1.0 live)  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Objectives](#3-goals--objectives)
4. [Scope](#4-scope)
5. [User Personas](#5-user-personas)
6. [Functional Requirements](#6-functional-requirements)
   - 6.1 [User Registration & Authentication](#61-user-registration--authentication)
   - 6.2 [Organization Hierarchy Management](#62-organization-hierarchy-management)
   - 6.3 [File Upload & Ingestion](#63-file-upload--ingestion)
   - 6.4 [Metadata Entry](#64-metadata-entry)
   - 6.5 [Access Control](#65-access-control)
   - 6.6 [Document Management](#66-document-management)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Data Schema](#8-data-schema)
9. [User Flows](#9-user-flows)
10. [UI/UX Requirements](#10-uiux-requirements)
11. [Technical Architecture](#11-technical-architecture)
12. [Security Requirements](#12-security-requirements)
13. [Assumptions & Constraints](#13-assumptions--constraints)
14. [Out of Scope](#14-out-of-scope)
15. [Success Metrics](#15-success-metrics)
16. [Open Questions](#16-open-questions)

---

## 1. Executive Summary

The **Unstructured Data Collector** is a web-based platform designed to centralize the collection, organization, and metadata tagging of unstructured documents (PDFs, Word files, text files, spreadsheets, etc.). The platform enforces a structured **Company → Department → Sub-Department** hierarchy to ensure documents are stored in the correct organizational context. All files must be accompanied by rich metadata to support document governance, access control, and lifecycle management. The stored files and their metadata are available for downstream consumption by any external system (e.g., a RAG AI pipeline) via the file store and database.

---

## 2. Problem Statement

Organizations accumulate large volumes of unstructured documents scattered across email, shared drives, and departmental silos. Without a structured collection system, these documents suffer from:

- **No organizational context** — Documents cannot be attributed to the correct company, department, or sub-department.
- **Missing metadata** — Without tags, document types, or version information, finding and governing documents is difficult.
- **Poor access governance** — Sensitive documents are accessible to unauthorized users.
- **Lifecycle gaps** — There is no visibility into whether documents are current, expired, or superseded.

There is currently no standardized system to collect, label, and govern unstructured documents in a structured hierarchy, resulting in knowledge management gaps and compliance risks.

---

## 3. Goals & Objectives

| # | Goal | Success Criteria |
|---|------|-----------------|
| G-1 | Enable structured document collection organized by company, department, and sub-department | 100% of uploaded files are associated with at least one hierarchy node |
| G-2 | Capture rich metadata at upload time to improve document discoverability and governance | All mandatory metadata fields completed before a file is stored |
| G-3 | Enforce role-based access control per document | Unauthorized users cannot access restricted documents |
| G-4 | Maintain a traceable document registry for version and lifecycle management | All document versions trackable from the dashboard |
| G-5 | Provide a seamless user onboarding experience via registration | Users can self-register and be assigned to their organizational hierarchy |

---

## 4. Scope

**In Scope:**
- User registration, authentication, and profile management
- Organizational hierarchy (Company → Department → Sub-Department) setup and management
- Unstructured file upload with drag-and-drop and bulk upload support
- Metadata form entry at upload time
- Document browser and search interface
- Access level enforcement per document and per user role
- Document versioning and update tracking
- Admin dashboard for user and hierarchy management

**Out of Scope (v1.0):**
- The RAG AI inference engine itself
- Structured data ingestion (databases, APIs)
- Automated metadata extraction via AI/OCR (planned for v2.0)
- Mobile native applications

---

## 5. User Personas

### 5.1 Document Uploader (Contributor)
- **Role:** Department staff, knowledge manager, data steward
- **Goal:** Upload documents relevant to their department and tag them accurately
- **Pain Points:** Manual metadata entry is tedious; unclear which fields are required
- **Permissions:** Upload to assigned department/sub-department only; cannot delete others' files

### 5.2 Department Administrator
- **Role:** Department head, IT liaison
- **Goal:** Manage sub-departments, review uploaded documents, manage user access within department
- **Pain Points:** No visibility into what files exist; no audit trail
- **Permissions:** CRUD on department files; manage department users; manage sub-departments

### 5.3 System Administrator
- **Role:** Platform admin, IT admin
- **Goal:** Manage companies, departments, user accounts, and global platform settings
- **Pain Points:** No centralized control over organizational structure
- **Permissions:** Full CRUD on all entities; user role management; system configuration

### 5.4 RAG AI Consumer (Read-Only)
- **Role:** End user of the RAG AI chatbot/application
- **Goal:** Receive accurate, relevant answers with proper access filtering
- **Interaction:** Indirect — interacts with the RAG output, not this platform directly

---

## 6. Functional Requirements

### 6.1 User Registration & Authentication

#### FR-6.1.1 — User Self-Registration
- The system **shall** provide a public registration form accessible without prior authentication.
- The registration form **shall** collect the following required fields:
  - Full Name
  - Email Address (serves as username)
  - Password (minimum 8 characters)
  - Confirm Password
- The registration form **shall** collect the following optional fields:
  - Company (dropdown, populated from active companies)
  - Department (dropdown, filtered by selected company)
  - Sub-Department (dropdown, filtered by selected department)
  - Job Title
  - Phone Number
- Company, Department, and Sub-Department fields use cascading dropdowns. Selecting a company filters the department list; selecting a department filters the sub-department list.
- The lists for Company, Department, and Sub-Department are loaded from public (unauthenticated) API endpoints (`GET /api/public/companies`, `GET /api/public/departments`, `GET /api/public/sub-departments`) so they are available before the user has a session.
- Upon successful form submission, the account is created immediately and the user is redirected to the login page.
- No email verification or admin approval is required — accounts are active upon registration.
- The first registered user **shall** be automatically assigned the `system_admin` role; all subsequent users default to the `contributor` role and can be promoted by an admin.

#### FR-6.1.2 — Login & Session Management
- The system **shall** support email/password login.
- On successful login, the server **shall** issue a signed JWT stored in an `HttpOnly` cookie.
- Sessions **shall** expire after 8 hours of inactivity; the user is redirected to the login page.
- There is no SSO, OAuth, or external identity provider integration in v1.0.

#### FR-6.1.3 — Password Management
- Users **shall** be able to reset their password while logged in by providing the current password and a new password.
- System Admins **shall** be able to reset any user's password from the admin panel.

#### FR-6.1.4 — User Profile
- Authenticated users **shall** be able to view and edit their profile from any page via the top-bar user dropdown → **Edit Profile**.
- The Profile page **shall** contain three independent sections:
  1. **Personal Information** — Full Name, Job Title, Phone (email is displayed read-only and cannot be changed by the user).
  2. **Organisation** — Cascading Company → Department → Sub-Department dropdowns allowing the user to update their own organisational assignment at any time. Selecting "— None —" clears the respective field.
  3. **Change Password** — Current Password, New Password, Confirm New Password.
- Each section saves independently; a success or error alert is shown per section.
- Role and status changes **shall** require System Admin action.

---

### 6.2 Organization Hierarchy Management

#### FR-6.2.1 — Company Management (Admin Only)
- The system **shall** allow Admins to create, edit, and deactivate companies.
- Each company record **shall** include: Company Name, Company Code, Industry, Description, Logo, Active/Inactive status.

#### FR-6.2.2 — Department Management (Admin / Dept Admin)
- The system **shall** allow creation of departments under a company.
- Each department record **shall** include: Department Name, Department Code, Parent Company, Description, Department Head (user reference).
- A company **can have** multiple departments.

#### FR-6.2.3 — Sub-Department Management
- The system **shall** allow creation of sub-departments under a department.
- Each sub-department record **shall** include: Sub-Department Name, Sub-Department Code, Parent Department, Description, Sub-Department Lead.
- A department **can have** multiple sub-departments.
- Sub-departments **may** be nested one level deep (i.e., sub-department within a sub-department) — configurable per company.

#### FR-6.2.4 — Hierarchy Browser
- Users **shall** be able to view the organizational hierarchy as a tree or breadcrumb view.
- The hierarchy browser **shall** filter to show only hierarchy nodes the user has access to.

---

### 6.3 File Upload & Ingestion

#### FR-6.3.1 — Supported File Types
The system **shall** accept the following unstructured file formats:

| Category | Formats |
|----------|---------|
| Documents | PDF, DOCX, DOC, TXT, RTF, ODT |
| Spreadsheets | XLSX, XLS, CSV, ODS |
| Presentations | PPTX, PPT, ODP |
| Images (with text) | PNG, JPG, TIFF (OCR planned v2) |
| Web | HTML, MHTML |
| Email exports | EML, MSG |
| Markdown | MD, MDX |

#### FR-6.3.2 — Upload Mechanism
- The system **shall** support single-file upload via file browser dialog.
- The system **shall** support multi-file / bulk upload (up to 50 files per batch).
- The system **shall** support drag-and-drop upload.
- Maximum file size per upload: **100 MB** (configurable by admin, up to 500 MB).
- Total batch upload size: **1 GB** per batch.

#### FR-6.3.3 — Upload Validation
- The system **shall** validate file type against MIME type (not just extension).
- The system **shall** scan uploaded files for malware upon receipt (file extension + MIME type validation; ClamAV optional).
- Rejected files **shall** display a clear error message indicating the rejection reason.
- The system **shall** detect duplicate files (same file hash) and warn the user before proceeding.

#### FR-6.3.4 — Upload Progress & Status
- The system **shall** display an upload progress indicator per file.
- Upload status values: `Uploading`, `Validating`, `Awaiting Metadata`, `Stored`, `Failed`.
- Users **shall** receive an in-app notification when a file is successfully stored or if upload fails.

---

### 6.4 Metadata Entry

After file upload, the user **shall** complete a metadata form before the file is stored and registered in the system.

#### FR-6.4.1 — Metadata Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| **Company** | Auto-filled (Read-Only) | Yes | Automatically populated from the logged-in user's profile; cannot be changed by the user |
| **Department** | Auto-filled (Read-Only) | Yes | Automatically populated from the logged-in user's profile; cannot be changed by the user |
| **Sub Department** | Auto-filled (Read-Only) | Yes | Automatically populated from the logged-in user's profile; cannot be changed by the user |
| **Document Type** | Dropdown | Yes | Classification of document (see §6.4.2) |
| **Title** | Text (max 255 chars) | Yes | Human-readable title of the document |
| **Tags** | Multi-select / free-text | Yes (min 1 tag) | Keywords to improve retrieval; user-defined or from a managed tag library |
| **Access Level** | Dropdown | Yes | Who can retrieve this document (see §6.4.3) |
| **Update Frequency** | Dropdown | Yes | How often this document is expected to be updated |
| **Version** | Text (e.g., 1.0, 2.3) | Yes | Document version number |
| **Date Created** | Date Picker | Yes | Original date the document was created (may differ from upload date) |
| **Date Uploaded** | Auto-filled (system timestamp) | Read-Only | Timestamp of when the file was uploaded to the platform |
| **File Size** | Auto-filled (system detected) | Read-Only | Size of the uploaded file in KB/MB |
| **Description** | Textarea (max 1000 chars) | No | Optional free-text description of document content |
| **Language** | Dropdown | No | Primary language of the document (default: English) |
| **Expiry Date** | Date Picker | No | Date after which the document should be archived or reviewed |

#### FR-6.4.2 — Document Type Enumeration (Managed List)

The following document types **shall** be available as defaults, configurable by Admin:

- Policy
- Procedure / SOP
- Manual / Handbook
- Report
- Memo
- Contract / Agreement
- Meeting Minutes
- Technical Specification
- Research / Whitepaper
- Training Material
- FAQ / Knowledge Base Article
- Form / Template
- Email Export
- Presentation
- Spreadsheet / Data File
- Other

#### FR-6.4.3 — Access Level Enumeration

| Access Level | Description |
|-------------|-------------|
| **Public** | Available to all authenticated users across all companies |
| **Company** | Available to all authenticated users within the same company |
| **Department** | Available to users within the same department |
| **Sub-Department** | Available only to users within the same sub-department |
| **Restricted** | Available only to explicitly named users or groups |
| **Confidential** | Available only to the uploader and system admins |

#### FR-6.4.4 — Update Frequency Enumeration

- Real-Time  
- Daily  
- Weekly  
- Monthly  
- Quarterly  
- Annually  
- Ad-Hoc / As Needed  
- One-Time / Static  

#### FR-6.4.5 — Bulk Metadata Entry
- For bulk uploads, users **shall** be presented with a metadata form that can be applied to all files at once ("Apply to All") or individually per file.
- Users **shall** be able to override shared metadata for individual files within a batch.

#### FR-6.4.6 — Metadata Validation
- All required fields **shall** be validated before the metadata form can be submitted.
- Company, Department, and Sub Department **shall** be auto-populated server-side from the authenticated user's profile and **shall not** be accepted from the client form submission, preventing tampering.
- Tag input **shall** support autocomplete from the existing tag library.
- Version **shall** be validated against a semantic version format (e.g., `1.0`, `2.3.1`).
- Date Created **shall** not be in the future.

#### FR-6.4.7 — Metadata Edit After Upload
- Authorized users (uploader, dept admin, system admin) **shall** be able to edit metadata after upload.
- All metadata changes **shall** be logged in an audit trail with user identity and timestamp.

---

### 6.5 Access Control

#### FR-6.5.1 — Role-Based Access Control (RBAC)

| Role | Capabilities |
|------|-------------|
| **System Admin** | Full access to all companies, departments, users, documents, settings |
| **Company Admin** | Manage departments, users, and documents within their company |
| **Department Admin** | Manage sub-departments, users, and documents within their department |
| **Contributor** | Upload documents to assigned department/sub-dept; edit own uploads |
| **Viewer** | View/download documents per access level; cannot upload |

#### FR-6.5.2 — Document-Level Access Enforcement
- The system **shall** enforce access level metadata at retrieval time.
- Users **shall** only see documents where their role and organizational context match the document's Access Level setting.

---

### 6.6 Document Management

#### FR-6.6.1 — Document Browser
- The system **shall** provide a searchable, filterable document browser.
- Filter options: Company, Department, Sub-Department, Document Type, Tags, Access Level, Date Range, Uploader.
- Documents **shall** be displayed in a table/list view with key metadata visible.

#### FR-6.6.2 — Document Versioning
- When a new version of an existing document is uploaded, the user **shall** be prompted to link it to the existing document record as a new version.
- All versions **shall** be stored and accessible via a version history panel.
- The latest version **shall** be marked as active by default; admin can designate a different version as "active."

#### FR-6.6.3 — Document Deletion & Archiving
- Documents **shall** be soft-deleted (archived) rather than permanently deleted by default.
- Hard delete **shall** require System Admin privileges.
- Archived documents **shall** be retained in storage for compliance but excluded from document browser results and downloads.
- Deletion events **shall** be logged in the audit trail.

#### FR-6.6.4 — Document Preview
- The system **shall** provide an in-browser preview for PDF, DOCX, PPTX, TXT, and image files.

---

---

### 6.7 Bulk User Import (Admin Only)

#### FR-6.7.1 — CSV Import
- System Admins **shall** be able to import multiple users at once by uploading a CSV file via the User Management admin panel.
- A **Download CSV Template** button **shall** provide a correctly formatted template with headers and an example row.
- Required CSV columns: `full_name`, `email`, `password`, `role`.
- Optional CSV columns: `job_title`, `phone`, `company`, `department`, `sub_department`.
- Organisation fields use **names** (not IDs). The importer resolves each name to the corresponding database record (case-insensitive). If a company, department, or sub-department does not yet exist it is **automatically created** and linked, so importing users also bootstraps the organisation structure in one pass.
- Duplicate email addresses are **skipped** (not errored); the existing user record is preserved.
- The import result summary displays: number created, number skipped (with reasons), number errored (with per-row details and row numbers).
- All successfully imported users are written to the audit log with action `imported`.
- Valid roles for import: `system_admin`, `dept_admin`, `contributor`, `viewer`.

---

## 7. Non-Functional Requirements

### 7.1 Performance
- File upload throughput: **≥ 10 concurrent uploads** per tenant without degradation.
- Metadata form submission response time: **< 2 seconds** (p95).
- Document browser search response time: **< 3 seconds** for up to 100,000 documents.

### 7.2 Scalability
- The system **shall** support up to **50 companies**, **500 departments**, and **5,000 sub-departments**.
- The system **shall** support up to **10,000 registered users**.
- The document store **shall** scale to **10 million documents** without architectural changes.

### 7.3 Availability
- Target uptime: **99.9%** (excluding scheduled maintenance).
- Scheduled maintenance windows **shall** be communicated 48 hours in advance.
- File uploads in progress **shall** be resumable after temporary disconnection.

### 7.4 Data Integrity
- All file bytes **shall** be verified via checksum after transfer.
- File metadata **shall** be persisted in a transactional database with ACID guarantees.
- No document **shall** be deleted or overwritten without an audit log entry.

### 7.5 Localization
- The UI **shall** support English as the primary language (v1.0).
- The architecture **shall** support future i18n/l10n expansion.

---

## 8. Data Schema

### 8.1 User

```
User {
  user_id         INTEGER PRIMARY KEY AUTOINCREMENT
  full_name       TEXT NOT NULL
  email           TEXT UNIQUE NOT NULL
  password_hash   TEXT NOT NULL          -- bcrypt hash
  job_title       TEXT
  phone           TEXT
  company_id      INTEGER  FK → Company
  department_id   INTEGER  FK → Department
  sub_dept_id     INTEGER  FK → SubDepartment
  role            TEXT     CHECK(role IN ('system_admin','dept_admin','contributor','viewer'))
  status          TEXT     CHECK(status IN ('active','suspended'))  DEFAULT 'active'
  created_at      TEXT     DEFAULT (datetime('now'))
  updated_at      TEXT     DEFAULT (datetime('now'))
  last_login_at   TEXT
}
```

### 8.2 Company

```
Company {
  company_id      INTEGER PRIMARY KEY AUTOINCREMENT
  name            TEXT UNIQUE NOT NULL
  code            TEXT UNIQUE
  industry        TEXT
  description     TEXT
  logo_url        TEXT
  is_active       INTEGER  DEFAULT 1   -- 1 = active, 0 = inactive
  created_at      TEXT     DEFAULT (datetime('now'))
  updated_at      TEXT     DEFAULT (datetime('now'))
}
```

### 8.3 Department

```
Department {
  department_id   INTEGER PRIMARY KEY AUTOINCREMENT
  company_id      INTEGER  FK → Company
  name            TEXT NOT NULL
  code            TEXT
  description     TEXT
  head_user_id    INTEGER  FK → User  (nullable)
  is_active       INTEGER  DEFAULT 1
  created_at      TEXT     DEFAULT (datetime('now'))
  updated_at      TEXT     DEFAULT (datetime('now'))
}
```

### 8.4 Sub-Department

```
SubDepartment {
  sub_dept_id     INTEGER PRIMARY KEY AUTOINCREMENT
  department_id   INTEGER  FK → Department
  name            TEXT NOT NULL
  code            TEXT
  description     TEXT
  lead_user_id    INTEGER  FK → User  (nullable)
  is_active       INTEGER  DEFAULT 1
  created_at      TEXT     DEFAULT (datetime('now'))
  updated_at      TEXT     DEFAULT (datetime('now'))
}
```

### 8.5 Document

```
Document {
  document_id         INTEGER PRIMARY KEY AUTOINCREMENT
  company_id          INTEGER  FK → Company
  department_id       INTEGER  FK → Department
  sub_dept_id         INTEGER  FK → SubDepartment
  document_type       TEXT     -- stored as string value from managed list
  title               TEXT NOT NULL
  description         TEXT
  tags                TEXT     -- JSON array stored as TEXT: '["tag1","tag2"]'
  access_level        TEXT     CHECK(access_level IN ('public','company','department','sub_department','restricted','confidential'))
  update_frequency    TEXT     CHECK(update_frequency IN ('real_time','daily','weekly','monthly','quarterly','annually','ad_hoc','one_time'))
  version             TEXT
  language            TEXT     DEFAULT 'en'
  date_created        TEXT     -- ISO 8601 date string
  date_uploaded       TEXT     DEFAULT (datetime('now'))
  expiry_date         TEXT     (nullable)
  file_name           TEXT
  file_path           TEXT
  file_size_bytes     INTEGER
  file_mime_type      TEXT
  file_hash           TEXT
  uploader_user_id    INTEGER  FK → User
  status              TEXT     CHECK(status IN ('pending_metadata','stored','failed','archived'))
  is_latest_version   INTEGER  DEFAULT 1   -- 1 = true, 0 = false
  parent_document_id  INTEGER  FK → Document  (nullable, for versioning)
  created_at          TEXT     DEFAULT (datetime('now'))
  updated_at          TEXT     DEFAULT (datetime('now'))
}
```

### 8.6 Audit Log

```
AuditLog {
  log_id          INTEGER PRIMARY KEY AUTOINCREMENT
  entity_type     TEXT   -- 'user' | 'document' | 'department' | 'company'
  entity_id       INTEGER
  action          TEXT   -- 'created' | 'updated' | 'deleted' | 'downloaded' | 'access_denied'
  performed_by    INTEGER  FK → User
  ip_address      TEXT
  user_agent      TEXT
  diff_json       TEXT   -- JSON string (before/after values)
  timestamp       TEXT   DEFAULT (datetime('now'))
}
```

> **SQLite Note:** All tables reside in a single `app.db` file. Timestamps are stored as ISO 8601 text strings. Boolean flags are stored as INTEGER (0/1). JSON arrays and diffs are stored as TEXT using JSON serialization. Foreign key enforcement must be enabled per connection via `PRAGMA foreign_keys = ON`.

---

## 9. User Flows

### 9.1 New User Registration Flow

```
[ Landing Page ]
      ↓
[ Register Form ] → Fill: Name, Email, Password, Confirm Password,
                          Company, Department, Job Title
      ↓
[ Client-side & Server-side Validation ]
      → (Fail) → [ Inline error messages shown on form ]
      → (Pass) ↓
[ Account created in SQLite with status = 'active' ]
      ↓
[ Redirect to Login Page ] → "Registration successful. Please log in."
      ↓
[ User logs in with email + password ] → JWT issued → [ Dashboard ]
```

> **First-user bootstrap:** If no users exist in the database, the first registered account is automatically granted the `system_admin` role.

### 9.2 Document Upload & Metadata Flow

```
[ Login ] → [ Dashboard ]
      ↓
[ Click "Upload Document" ] → [ File Browser / Drag-Drop ]
      ↓
[ File Validation ] → (Pass) → [ Metadata Entry Form ]
                    → (Fail) → [ Error Message ]
      ↓
[ Metadata Form displays ]
  → Company, Department, Sub Department: auto-filled (read-only) from user profile
  → Date Uploaded, File Size: auto-filled (read-only) from system
  → User fills: Doc Type, Title, Tags, Access Level, Update Freq, Version, Date Created
      ↓
[ Submit Metadata ] → [ Validation Pass ] → [ File saved to `uploads/{company}/{department}/{sub_department}/` ]
                                          → [ Status: Stored ]
      ↓
[ In-app notification: "Document stored successfully" ]
```

### 9.3 Document Version Update Flow

```
[ Document Browser ] → [ Find Existing Document ]
      ↓
[ Click "Upload New Version" ] → [ File Browser ]
      ↓
[ New File Validated ] → [ Metadata Form (pre-filled from current version) ]
      ↓
[ User Updates Version Number & Modified Fields ]
      ↓
[ Submit ] → [ Old version: is_latest_version = false ]
           → [ New version: is_latest_version = true, status = stored ]
```

---

## 10. UI/UX Requirements

### 10.0 Design System
- The UI **shall** be built using **Bootstrap 5** as the CSS framework and layout system.
- An **admin Bootstrap theme** (e.g., AdminLTE, CoreUI, SB Admin 2, or equivalent) **shall** be used to provide the base admin panel layout — including the top navbar, collapsible sidebar, cards, tables, forms, badges, and modals — out of the box.
- Custom styling **shall** be layered on top of the chosen theme via a project-level override stylesheet; direct modification of the Bootstrap/theme source files is not permitted.
- The React component library **shall** use Bootstrap-compatible components (e.g., `react-bootstrap` or `reactstrap`) rather than a non-Bootstrap UI library.
- Icons **shall** use Bootstrap Icons (`bootstrap-icons`) or a compatible set already bundled with the chosen theme.

### 10.1 Layout & Navigation
- **Top Navbar:** Platform logo, search bar (document search), user profile dropdown menu, notifications bell — rendered using the theme's standard navbar component.
- **Left Sidebar:** Hierarchical tree navigator (Company → Department → Sub-Department); collapsible using the theme's sidebar toggle; active section highlighted.
- **Main Content Area:** Bootstrap card-based layout — document browser, upload interface, and admin panels each occupy a card or set of cards with appropriate padding.
- **Breadcrumb Navigation:** Bootstrap `<nav aria-label="breadcrumb">` always visible below the navbar, showing current Company > Department > Sub-Department context.

### 10.2 Registration Page
- Bootstrap-styled card centered on page with the platform logo above the form.
- Standard Bootstrap form controls with `is-invalid` / `is-valid` states for inline validation feedback.
- Password strength indicator rendered as a Bootstrap `progress` bar below the password field.
- "Already have an account? Sign In" link below the submit button.

### 10.3 Upload Interface
- Drag-and-drop upload zone styled as a Bootstrap `card` with a dashed border and centered call-to-action text.
- File queue rendered as a Bootstrap `list-group` showing filename, size, and a `progress` bar per file.
- Inline error alerts use Bootstrap `alert alert-danger` with an icon; success confirmation uses `alert alert-success`.
- "Upload Another" and "Go to Document Browser" rendered as Bootstrap `btn` components on completion.

### 10.4 Metadata Form
- Rendered inside a Bootstrap `card` with section headings (`card-header`) for **Organization**, **Document Identity**, **Governance**, and **System Info**.
- **Organization section** (Company, Department, Sub Department) uses Bootstrap `form-control-plaintext` to display the auto-filled values as non-editable, visually flat text within the form grid.
- **System Info section** (Date Uploaded, File Size) uses Bootstrap `form-control` with `readonly` and `bg-light` classes to visually distinguish auto-filled read-only fields.
- Tag input with autocomplete rendered using a Bootstrap-compatible multi-select library (e.g., `choices.js` or `react-select` with Bootstrap styling).
- Required fields marked with a Bootstrap `badge bg-danger` or asterisk adjacent to the label.
- "Save Draft" button rendered as `btn btn-outline-secondary`; "Submit" rendered as `btn btn-primary`.

### 10.5 Document Browser
- Bootstrap `table table-hover table-bordered` with sortable column headers (via `data-sort` attributes or a lightweight JS sort library).
- Columns: Title, Type, Dept, Sub-Dept, Version, Access Level, Date Uploaded, Status — Status displayed as a Bootstrap `badge` with color-coded variants (`bg-success`, `bg-warning`, `bg-secondary`, etc.).
- Filter panel on the left rendered as Bootstrap `card` with stacked `form-check`, `form-select`, and `form-range` controls; collapsible on smaller screens using Bootstrap `collapse`.
- Row actions (View, Edit Metadata, Download, Version History, Archive) rendered as a Bootstrap `btn-group btn-group-sm` per row.
- Bulk actions rendered in a Bootstrap `dropdown` button above the table, activated when rows are selected via checkboxes.

### 10.6 Accessibility
- WCAG 2.1 AA compliance.
- Keyboard navigable forms and tables.
- Screen reader compatible (ARIA labels on all interactive elements).

---

## 11. Technical Architecture

### 11.1 High-Level Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Web Application                        │
│                   (React JS Frontend)                       │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS / REST
┌───────────────────────▼─────────────────────────────────────┐
│                  Backend API (Go — net/http / Gin / Fiber)  │
│   ┌────────────┐  ┌────────────┐  ┌──────────┐              │
│   │  Auth      │  │  Document  │  │  Org     │              │
│   │  (JWT)     │  │  Service   │  │  Service │              │
│   └─────┬──────┘  └─────┬──────┘  └────┬─────┘              │
│         └───────────────┴──────────────┘                    │
│                          │                                   │
│              ┌───────────▼───────────┐                      │
│              │   SQLite Database     │                      │
│              │   (app.db)            │                      │
│              │   Users, Companies,   │                      │
│              │   Departments,        │                      │
│              │   Documents,          │                      │
│              │   AuditLog            │                      │
│              └───────────────────────┘                      │
└───────────────────────┬─────────────────────────────────────┘
                        │
             ┌──────────▼──────────┐
             │   Local File Store  │
             │   (uploads/ folder  │
             │    on server disk)  │
             └──────────┬──────────┘
                        │
```

### 11.2 Key Technology Stack

| Component | Implementation |
|-----------|---------------|
| Frontend | React 18 + Vite 5, Bootstrap 5, `react-bootstrap`, Bootstrap Icons |
| Backend API | Go 1.22, Gin web framework |
| Auth | Custom JWT (HS256, `golang-jwt/jwt/v5`), HttpOnly cookie, 8 h expiry |
| Database | SQLite via `glebarez/sqlite` (CGO-free) + GORM ORM; single `app.db` file |
| Password Hashing | `golang.org/x/crypto/bcrypt` cost factor 12 |
| File Storage | Local filesystem (`uploads/` directory) |
| Embedded SPA | React build output embedded into Go binary via `//go:embed all:ui`; served by `NoRoute` handler — single deployable binary, no separate web server required |
| Rate Limiting | Custom in-process token-bucket middleware (login endpoint: 5 attempts / 15 min per IP) |
| CORS | `gin-contrib/cors` — `FRONTEND_URL` configurable via `.env` |
| Public Org Endpoints | `GET /api/public/companies`, `/api/public/departments`, `/api/public/sub-departments` — unauthenticated, used by the registration form before a session exists |

---

## 12. Security Requirements

### 12.1 Authentication & Authorization
- All API endpoints **shall** require a valid JWT token passed via `HttpOnly` cookie.
- JWTs **shall** be signed with a secret key (HS256) using `golang-jwt/jwt`, stored in the server environment variables — never hardcoded.
- Tokens **shall** have a maximum lifetime of 8 hours; after expiry the user must log in again.
- RBAC **shall** be enforced at the API layer via a Go middleware function on every protected route — client-side enforcement alone is insufficient.
- Admin endpoints **shall** require `system_admin` or `dept_admin` role verification on every request.

### 12.2 Data Security
- All data **shall** be encrypted at rest (AES-256) and in transit (TLS 1.2+).
- File storage buckets **shall** be private — files **shall** only be served via signed, time-limited URLs.
- Passwords **shall** be hashed using `golang.org/x/crypto/bcrypt` (cost factor ≥ 12).
- PII fields **shall** be encrypted at the application layer in addition to database-level encryption.

### 12.3 Input Validation & Injection Prevention
- All file metadata inputs **shall** be validated and sanitized server-side.
- File uploads **shall** be rejected if content does not match declared MIME type (content inspection).
- The system **shall** prevent path traversal attacks in file naming.
- SQL queries **shall** use parameterized statements via `database/sql` placeholders or an ORM (never raw string interpolation).
- Tag inputs **shall** be sanitized to prevent XSS injection into rendered tag pills.

### 12.4 Audit & Monitoring
- All authentication events (login, logout, failed login) **shall** be written to the `AuditLog` table in SQLite.
- All document access (view, download), modifications (metadata edit, new version), and deletions **shall** be logged.
- Admins **shall** be able to view the audit log through the admin dashboard (filterable by user, action, and date range).

### 12.5 Rate Limiting & Abuse Prevention
- Login endpoint: max 5 failed attempts per 15 minutes per IP/account; account is temporarily locked for 15 minutes after exceeding the limit.
- Upload endpoint: max 100 uploads per hour per user account (enforced in application logic).
- Rate limiting is implemented in Go middleware (e.g., `ulule/limiter` or a custom token-bucket handler) — no external WAF required for v1.0.

---

## 13. Assumptions & Constraints

| # | Assumption / Constraint |
|---|------------------------|
| A-1 | Users have a modern browser (Chrome 100+, Firefox 100+, Edge 100+, Safari 15+) |
| A-2 | Uploaded files are stored on the local server filesystem; the deployment host has adequate disk space |
| A-4 | The first user to register becomes the System Admin and should immediately configure companies and departments |
| A-5 | SQLite is the sole database; the application is designed for **single-server deployment** (not horizontally scaled across multiple app servers) |
| C-1 | v1.0 supports English language UI only |
| C-2 | Maximum file size is capped at 100 MB per file |
| C-3 | AI-based automatic metadata extraction (OCR, classification) is deferred to v2.0 |
| C-4 | SQLite write concurrency is low — high simultaneous write loads (>50 concurrent users uploading) may require migration to PostgreSQL in a future version |
| C-5 | No email sending capability is included in v1.0; all notifications are in-app only |

---

## 14. Out of Scope

The following features are explicitly **not** in scope for version 1.0:

- **RAG / AI Integration** — Connecting stored documents to a vector store, embedding pipeline, or AI query interface is outside this system's scope; it is the responsibility of the consuming system.
- **Automatic Metadata Extraction** — AI/ML-based auto-tagging, OCR, language detection, and document classification are planned for v2.0.
- **Structured Data Ingestion** — Databases, REST APIs, and relational data sources are not supported.
- **Real-Time Collaboration** — Co-editing or commenting on documents is not included.
- **Native Mobile Applications** — iOS and Android apps are not in scope.
- **Custom Workflow/Approval Pipelines** — Document approval workflows before ingestion are not included.
- **Data Residency Controls** — Multi-region storage with per-company data residency rules is deferred.
- **Billing / Metered Usage** — Multi-tenant billing and quota enforcement are not included.

---

## 15. Success Metrics

| Metric | Target (90 days post-launch) |
|--------|------------------------------|
| User registrations | ≥ 500 active users |
| Documents stored | ≥ 10,000 documents with complete metadata |
| Metadata completeness rate | ≥ 95% of required fields filled on first submit |
| Upload success rate | ≥ 99% (excluding user errors) |
| User satisfaction (CSAT) | ≥ 4.0 / 5.0 on onboarding & upload experience |
| Access control violations | 0 documented unauthorized access incidents |
| System availability | ≥ 99.9% uptime |

---

## 16. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| OQ-1 | Should sub-departments support more than one level of nesting? | Product Owner | Open |
| OQ-2 | What is the data retention policy for archived/deleted documents? | Legal / Compliance | Open |
| OQ-3 | Should file size limits be configurable per company or remain a global setting? | Product Owner | Open |
| OQ-4 | At what user/document volume should the team plan migration from SQLite to PostgreSQL? | Engineering | Open |
| OQ-5 | Is ClamAV virus scanning required in v1.0 or can basic MIME-type validation suffice initially? | InfoSec Team | Deferred to v2.0 |
| OQ-6 | Should the "Restricted" access level support individual user assignments or only group assignments? | Product Owner | Open |
| OQ-7 | Is there a requirement for GDPR / data sovereignty compliance from day one? | Legal | Open |

---

*End of Document*

---
**Document Control**

| Version | Date | Author | Change Summary |
|---------|------|--------|---------------|
| 0.1 | March 15, 2026 | — | Initial draft |
| 1.0 | March 15, 2026 | — | Baseline PRD approved for sprint planning |
| 1.1 | March 15, 2026 | — | Simplified auth to custom JWT (no SSO/MFA/email verification); changed database to SQLite; updated schema, architecture diagram, tech stack, constraints, and open questions |
| 1.2 | March 15, 2026 | — | Removed vector store, embedding pipeline, and RAG ingestion worker; system is now a pure document collection and storage platform; downstream RAG integration is out of scope |
| 1.3 | March 15, 2026 | — | Changed backend to Go (Gin/Fiber) and frontend to React JS (Vite); updated tech stack, architecture, JWT library, bcrypt, SQL driver, and rate limiter references |
| 1.4 | March 15, 2026 | — | Replaced Tailwind CSS/shadcn with Bootstrap 5 + admin theme; updated UI/UX section with Bootstrap-specific component guidance |
| 2.0 | March 16, 2026 | — | Reflects implemented state: registration with cascading org dropdowns; `sub_dept_id` added to User schema; user self-service Profile page (personal info, org assignment, change password); bulk user CSV import with name-based org resolution and auto-create; public org lookup endpoints (`/api/public/*`); tech stack updated to actual implementation (React 18 + Vite 5, Go 1.22, Gin, glebarez/sqlite, GORM, embedded SPA binary); FR-6.1.4 expanded; FR-6.7 (Bulk User Import) added; duplicate OQ-3 removed |
