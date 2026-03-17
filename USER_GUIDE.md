# RAG Data Collector — User Guide

## Table of Contents

1. [Overview](#overview)
2. [User Roles](#user-roles)
3. [Getting Started](#getting-started)
   - [Login](#login)
   - [Register a New Account](#register-a-new-account)
4. [Dashboard](#dashboard)
5. [Documents](#documents)
   - [Browse Documents](#browse-documents)
   - [Upload a Document](#upload-a-document)
   - [View Document Details](#view-document-details)
   - [Edit Document Metadata](#edit-document-metadata)
   - [Replace a File](#replace-a-file)
   - [Upload a New Version](#upload-a-new-version)
   - [Archive a Document](#archive-a-document)
   - [Download a Document](#download-a-document)
6. [My Profile](#my-profile)
7. [Administration (Admin Only)](#administration-admin-only)
   - [Manage Users](#manage-users)
   - [Import Users from CSV](#import-users-from-csv)
   - [Manage Companies](#manage-companies)
   - [Manage Departments](#manage-departments)
   - [Manage Sub-Departments](#manage-sub-departments)
   - [Audit Logs](#audit-logs)

---

## Overview

RAG Data Collector is a centralised document management system for collecting and organising unstructured data files (PDFs, Word documents, spreadsheets, presentations, emails, images, etc.) used in RAG (Retrieval-Augmented Generation) pipelines.

Each document is stored with rich metadata — type, access level, update frequency, tags, version — so that downstream AI systems can retrieve the most relevant and up-to-date content.

---

## User Roles

| Role | What they can do |
|---|---|
| **System Admin** | Full access: manage all users, organisations, documents, and audit logs |
| **Dept Admin** | Manage users and documents within their department |
| **Contributor** | Upload documents, edit and manage their own documents |
| **Viewer** | Browse and download documents they have access to |

> **First Registration Rule:** The very first account registered in the system is automatically granted the `System Admin` role.

---

## Getting Started

### Login

1. Navigate to the application URL in your browser (e.g. `http://localhost:8080`)
2. Enter your **Email** and **Password**
3. Click **Login**

Your session is maintained via a secure cookie. You are automatically redirected to the Dashboard on success.

### Register a New Account

1. On the Login page, click **Register**
2. Fill in:
   - **Full Name** (required)
   - **Email** (required — must be unique)
   - **Password** (minimum 8 characters)
   - **Confirm Password**
   - **Job Title**, **Phone** (optional)
   - **Company**, **Department**, **Sub-Department** (optional — can be set later in your Profile)
3. Click **Register**

New accounts are assigned the **Contributor** role by default. An admin can upgrade the role after registration.

---

## Dashboard

After login you land on the Dashboard, which shows:

- **Total Documents** — total number of documents in the system
- **Assigned Organisation** — your company name
- **My Profile** — your name, job title, company, department, and sub-department
- **Recent Documents** — the 5 most recently uploaded documents with file names and sizes

---

## Documents

### Browse Documents

Click **Documents** in the left sidebar. The page lists all documents you have access to, showing:

- Title and document type
- File name and size
- MIME type
- Status badge (Stored / Pending Metadata / Archived / Failed)
- Upload date

Use the **search bar** and column headings to filter and sort.

### Upload a Document

> Requires **Contributor** role or above.

1. Click **Upload Document** (button at the top of the Documents page)
2. **Drop a file** onto the upload area, or click **Browse** to select one

   Supported file types: PDF, Word (.doc/.docx), Excel (.xls/.xlsx), PowerPoint (.ppt/.pptx), CSV, TXT, RTF, HTML, Markdown, ODS, ODP, ODT, images (PNG/JPG/TIFF), email files (EML/MSG/MHTML)

3. Fill in the metadata fields:

   | Field | Description |
   |---|---|
   | **Title** | Document display name (auto-filled from filename if left blank) |
   | **Document Type** | Category: Policy, Procedure, Report, Contract, Invoice, Presentation, Spreadsheet, Manual, Correspondence, Other |
   | **Description** | Free-text summary of the document |
   | **Tags** | Space-separated keywords (e.g. `finance 2024 budget`) |
   | **Version** | Version string, e.g. `1.0` |
   | **Access Level** | Who can see this document (see table below) |
   | **Date Created** | Original creation date of the document content |
   | **Update Frequency** | How often this document is refreshed |
   | **Language** | ISO language code, e.g. `EN`, `ID` |
   | **Company / Department / Sub-Dept** | Organisation assignment (Admins can assign to any; regular users default to their own org) |

   **Access Level options:**

   | Level | Visible to |
   |---|---|
   | `public` | Everyone |
   | `company` | Users in the same company |
   | `department` | Users in the same department |
   | `sub_department` | Users in the same sub-department |
   | `restricted` | Only the uploader and admins |
   | `confidential` | Only admins |

   **Update Frequency options:** `real_time`, `daily`, `weekly`, `monthly`, `quarterly`, `annually`, `ad_hoc`, `one_time`

4. Click **Upload Document**

### View Document Details

Click on any document title or the **View** button to open the Document Detail page.

The detail page shows:
- All metadata fields
- File information: file name, MIME type, file size
- Status badge
- Version history table (if multiple versions exist)
- Download button

### Edit Document Metadata

> Available to the **original uploader** or any **Admin**.

1. Open the Document Detail page
2. Click **Edit Metadata** (pencil icon)
3. Modify any fields
4. Click **Save Changes**

### Replace a File

> Replaces the physical file while keeping all metadata and version history intact.

1. Open the Document Detail page
2. Click **Replace File** (cloud-upload icon)
3. Select the new file in the dialog
4. Click **Replace File**

The file name, size, MIME type, and content hash are updated automatically.

### Upload a New Version

> Creates a separate version entry, keeping the original file.

1. Open the Document Detail page
2. Click **New Version** (plus-circle icon)
3. Select the new file
4. Enter a version label (e.g. `2.0`) and optional description
5. Click **Upload Version**

All previous versions are listed in the **Version History** table at the bottom of the page.

### Archive a Document

> Requires **Dept Admin** or **System Admin**.

1. Open the Document Detail page
2. Click **Archive** (archive icon)
3. Confirm the prompt

Archived documents remain in the system but are marked with an `Archived` status badge.

### Download a Document

1. Open the Document Detail page
2. Click **Download** (download icon)

The file is downloaded with its original filename.

---

## My Profile

Click your name in the top navigation bar, then select **My Profile**, or click the **Profile** link in the sidebar.

From this page you can update three sections independently:

### Personal Information
- **Full Name**, **Job Title**, **Phone**
- Click **Save Changes** to update

### Organisation
- **Company**, **Department**, **Sub-Department** — each dropdown is dynamically filtered based on the selection above it
- Click **Save Organisation** to update

### Change Password
- Enter your **Current Password**
- Enter and confirm a **New Password** (minimum 8 characters)
- Click **Change Password**

---

## Administration (Admin Only)

The **Admin** section is visible in the left sidebar only for users with the `system_admin` or `dept_admin` role.

### Manage Users

**Admin → Users** shows a searchable, sortable DataTable of all users with columns for name, email, role, status, company, and department.

**Edit a user:**
1. Click the **Edit** button on any row
2. Modify: Full Name, Job Title, Phone, Role, Status, Company, Department, Sub-Department
3. Click **Save**

**Role options:** `viewer`, `contributor`, `dept_admin`, `system_admin`

**Status options:** `active`, `suspended` (suspended users cannot log in)

### Import Users from CSV

Bulk-create users from a CSV file.

1. Click **Import CSV** on the Users page
2. Select your CSV file

   Required columns:
   ```
   full_name, email, password, role
   ```
   Optional columns:
   ```
   job_title, phone, company_id, department_id, sub_dept_id
   ```
3. Click **Import**

The result shows how many users were created and any rows that failed with reasons.

### Manage Companies

**Admin → Companies** — Create, edit, or deactivate company records.

| Field | Description |
|---|---|
| **Name** | Company display name (required) |
| **Code** | Short identifier, e.g. `ACME` (required) |
| **Industry** | Industry sector (optional) |
| **Description** | Free-text notes (optional) |

Click **Add Company** to create. Click **Edit** to modify. Click **Deactivate** to soft-delete.

### Manage Departments

**Admin → Departments** — Create, edit, or deactivate departments under a company.

Use the **Company** filter dropdown at the top to narrow the list by company.

| Field | Description |
|---|---|
| **Name** | Department name (required) |
| **Code** | Short identifier (required) |
| **Company** | Parent company (required) |
| **Description** | Optional notes |

### Manage Sub-Departments

**Admin → Sub-Departments** — Create, edit, or deactivate sub-departments under a department.

Use the **Company** and **Department** filter dropdowns to narrow the list.

| Field | Description |
|---|---|
| **Name** | Sub-department name (required) |
| **Code** | Short identifier (required) |
| **Department** | Parent department (required) |
| **Description** | Optional notes |

### Audit Logs

**Admin → Audit Logs** provides a paginated log of all system actions (30 entries per page).

**Filter by:**
- **Entity Type** — e.g. `document`, `user`, `company`
- **Action** — e.g. `upload`, `login`, `update`, `delete`, `archive`, `download`
- **User** — user ID of the person who performed the action

Press **Enter** or click **Search** to apply filters. Use the **Previous / Next** pagination buttons to navigate. Actions are colour-coded:

| Action | Colour |
|---|---|
| create | Green |
| update | Blue |
| delete | Red |
| login | Cyan |
| logout | Grey |
| upload | Blue |
| download | Cyan |
| archive | Yellow |

---

*RAG Data Collector v1.0 — Internal Documentation*
