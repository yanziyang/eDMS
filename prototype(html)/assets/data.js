/* =========================================================================
   eDMS Clickable Prototype — Sample Data
   Fictional demo data only. Drives every page so navigation is fully
   data-driven rather than a set of disconnected static screens.
   ========================================================================= */

const CURRENT_USER = {
  name: "Jordan Reyes",
  initials: "JR",
  email: "jordan.reyes@edms-demo.local",
  title: "IT Systems Manager",
  role: "System Administrator",
  site: "IT Operations"
};

const SITES = [
  { slug: "finance", name: "Finance", description: "Budgets, invoices, and financial reporting.", icon: "landmark", color: "#4f46e5", members: 18, storageUsedGB: 34.2, storageQuotaGB: 100,
    libraries: [ { id: "documents", name: "Documents" }, { id: "contracts", name: "Contracts" } ] },
  { slug: "hr", name: "Human Resources", description: "Policies, onboarding, and employee records.", icon: "users", color: "#0ea5c4", members: 9, storageUsedGB: 12.8, storageQuotaGB: 50,
    libraries: [ { id: "documents", name: "Documents" }, { id: "policies", name: "Policies" } ] },
  { slug: "phoenix", name: "Project Phoenix", description: "Cross-functional product launch workspace.", icon: "rocket", color: "#16a34a", members: 12, storageUsedGB: 21.5, storageQuotaGB: 50,
    libraries: [ { id: "documents", name: "Documents" } ] },
  { slug: "it", name: "IT Operations", description: "Infrastructure runbooks and vendor contracts.", icon: "server", color: "#d97706", members: 7, storageUsedGB: 8.4, storageQuotaGB: 50,
    libraries: [ { id: "documents", name: "Documents" } ] },
  { slug: "marketing", name: "Marketing", description: "Campaigns, brand assets, and press materials.", icon: "megaphone", color: "#db2777", members: 14, storageUsedGB: 41.1, storageQuotaGB: 100,
    libraries: [ { id: "documents", name: "Documents" } ] }
];

function findSite(slug) { return SITES.find(s => s.slug === slug) || SITES[0]; }

/* Folder + file contents, keyed by "<site>/<library>/<folder>" */
const LIBRARY_CONTENTS = {
  "finance/documents/root": { name: "Documents", parent: null, items: [
    { type: "folder", id: "invoices", name: "Invoices", modified: "2026-08-10", modifiedBy: "Sarah Chen" },
    { type: "folder", id: "budgets", name: "Budgets FY26", modified: "2026-08-01", modifiedBy: "Marcus Johnson" },
    { type: "file", name: "Q3 Financial Report.xlsx", ext: "xlsx", size: "2.4 MB", modified: "2026-08-14", modifiedBy: "Sarah Chen", version: "3.0", tags: ["Quarterly", "Finance"], checkedOutBy: null },
    { type: "file", name: "Budget Forecast FY26.xlsx", ext: "xlsx", size: "1.1 MB", modified: "2026-08-12", modifiedBy: "Jordan Reyes", version: "1.4", tags: ["Forecast"], checkedOutBy: "Jordan Reyes" },
    { type: "file", name: "Audit Checklist 2026.docx", ext: "docx", size: "340 KB", modified: "2026-08-05", modifiedBy: "Elena Rodriguez", version: "2.0", tags: ["Audit"], checkedOutBy: null },
    { type: "file", name: "Org Chart.pdf", ext: "pdf", size: "890 KB", modified: "2026-07-29", modifiedBy: "David Kim", version: "1.0", tags: [], checkedOutBy: null },
    { type: "file", name: "Expense Policy.docx", ext: "docx", size: "210 KB", modified: "2026-07-18", modifiedBy: "James Wilson", version: "4.0", tags: ["Policy"], checkedOutBy: null }
  ]},
  "finance/documents/invoices": { name: "Invoices", parent: { folder: "root", label: "Documents" }, items: [
    { type: "file", name: "Invoice_2026_0417.pdf", ext: "pdf", size: "180 KB", modified: "2026-08-09", modifiedBy: "Sarah Chen", version: "1.0", tags: ["Vendor"], checkedOutBy: null },
    { type: "file", name: "Invoice_2026_0418.pdf", ext: "pdf", size: "176 KB", modified: "2026-08-09", modifiedBy: "Sarah Chen", version: "1.0", tags: ["Vendor"], checkedOutBy: null },
    { type: "file", name: "Invoice Tracking Log.xlsx", ext: "xlsx", size: "410 KB", modified: "2026-08-11", modifiedBy: "Marcus Johnson", version: "6.0", tags: [], checkedOutBy: null }
  ]},
  "finance/documents/budgets": { name: "Budgets FY26", parent: { folder: "root", label: "Documents" }, items: [
    { type: "file", name: "Departmental Budget - IT.xlsx", ext: "xlsx", size: "980 KB", modified: "2026-08-03", modifiedBy: "Marcus Johnson", version: "2.0", tags: ["FY26"], checkedOutBy: null },
    { type: "file", name: "Departmental Budget - Marketing.xlsx", ext: "xlsx", size: "1.0 MB", modified: "2026-08-03", modifiedBy: "Marcus Johnson", version: "2.0", tags: ["FY26"], checkedOutBy: null },
    { type: "file", name: "Capex Plan.pdf", ext: "pdf", size: "560 KB", modified: "2026-07-22", modifiedBy: "David Kim", version: "1.1", tags: [], checkedOutBy: null }
  ]},
  "finance/contracts/root": { name: "Contracts", parent: null, items: [
    { type: "folder", id: "vendor-agreements", name: "Vendor Agreements", modified: "2026-07-20", modifiedBy: "Priya Patel" },
    { type: "file", name: "NDA Template.docx", ext: "docx", size: "120 KB", modified: "2026-06-11", modifiedBy: "Priya Patel", version: "5.0", tags: ["Template", "Legal"], checkedOutBy: null },
    { type: "file", name: "Master Service Agreement - Acme Corp.pdf", ext: "pdf", size: "1.8 MB", modified: "2026-08-02", modifiedBy: "James Wilson", version: "2.0", tags: ["Vendor"], checkedOutBy: null }
  ]},
  "finance/contracts/vendor-agreements": { name: "Vendor Agreements", parent: { folder: "root", label: "Contracts" }, items: [
    { type: "file", name: "Vendor Agreement - Acme Corp.pdf", ext: "pdf", size: "980 KB", modified: "2026-08-09", modifiedBy: "James Wilson", version: "1.2", tags: ["Vendor", "Active"], checkedOutBy: null },
    { type: "file", name: "Vendor Compliance Checklist.xlsx", ext: "xlsx", size: "210 KB", modified: "2026-07-15", modifiedBy: "James Wilson", version: "1.0", tags: ["Compliance"], checkedOutBy: null },
    { type: "file", name: "Vendor Agreement - Northwind Logistics.pdf", ext: "pdf", size: "1.1 MB", modified: "2026-06-28", modifiedBy: "Priya Patel", version: "1.0", tags: ["Vendor"], checkedOutBy: null }
  ]},

  "hr/documents/root": { name: "Documents", parent: null, items: [
    { type: "folder", id: "onboarding", name: "Onboarding", modified: "2026-08-06", modifiedBy: "Rachel Adams" },
    { type: "file", name: "Employee Handbook 2026.docx", ext: "docx", size: "1.4 MB", modified: "2026-08-08", modifiedBy: "Rachel Adams", version: "6.0", tags: ["Policy"], checkedOutBy: null },
    { type: "file", name: "Benefits Overview.pptx", ext: "pptx", size: "3.1 MB", modified: "2026-07-30", modifiedBy: "Tom Baker", version: "2.0", tags: [], checkedOutBy: null },
    { type: "file", name: "Leave Request Form.docx", ext: "docx", size: "90 KB", modified: "2026-06-14", modifiedBy: "Tom Baker", version: "3.0", tags: ["Form"], checkedOutBy: null },
    { type: "file", name: "Org Directory.xlsx", ext: "xlsx", size: "260 KB", modified: "2026-08-13", modifiedBy: "Rachel Adams", version: "9.0", tags: [], checkedOutBy: null }
  ]},
  "hr/documents/onboarding": { name: "Onboarding", parent: { folder: "root", label: "Documents" }, items: [
    { type: "file", name: "New Hire Checklist.docx", ext: "docx", size: "150 KB", modified: "2026-08-01", modifiedBy: "Rachel Adams", version: "4.0", tags: ["Checklist"], checkedOutBy: null },
    { type: "file", name: "IT Equipment Request.docx", ext: "docx", size: "80 KB", modified: "2026-05-19", modifiedBy: "Tom Baker", version: "1.0", tags: [], checkedOutBy: null }
  ]},
  "hr/policies/root": { name: "Policies", parent: null, items: [
    { type: "folder", id: "archived", name: "Archived", modified: "2026-04-02", modifiedBy: "Rachel Adams" },
    { type: "file", name: "Code of Conduct.pdf", ext: "pdf", size: "410 KB", modified: "2026-07-25", modifiedBy: "Rachel Adams", version: "3.0", tags: ["Policy"], checkedOutBy: null },
    { type: "file", name: "Remote Work Policy.docx", ext: "docx", size: "180 KB", modified: "2026-08-04", modifiedBy: "Tom Baker", version: "2.1", tags: ["Policy"], checkedOutBy: null },
    { type: "file", name: "Data Protection Policy.pdf", ext: "pdf", size: "330 KB", modified: "2026-07-11", modifiedBy: "Rachel Adams", version: "1.0", tags: ["Policy", "Compliance"], checkedOutBy: null }
  ]},
  "hr/policies/archived": { name: "Archived", parent: { folder: "root", label: "Policies" }, items: [] },

  "phoenix/documents/root": { name: "Documents", parent: null, items: [
    { type: "folder", id: "design-assets", name: "Design Assets", modified: "2026-08-07", modifiedBy: "Aisha Rahman" },
    { type: "file", name: "Project Phoenix Roadmap.pptx", ext: "pptx", size: "4.2 MB", modified: "2026-08-13", modifiedBy: "Carlos Mendes", version: "5.0", tags: ["Roadmap"], checkedOutBy: null },
    { type: "file", name: "Requirements Spec v2.docx", ext: "docx", size: "760 KB", modified: "2026-08-14", modifiedBy: "Liam O'Brien", version: "2.3", tags: ["Spec"], checkedOutBy: "Liam O'Brien" },
    { type: "file", name: "Sprint Planning Board.xlsx", ext: "xlsx", size: "310 KB", modified: "2026-08-12", modifiedBy: "Yuki Tanaka", version: "12.0", tags: [], checkedOutBy: null },
    { type: "file", name: "Architecture Diagram.pdf", ext: "pdf", size: "1.2 MB", modified: "2026-08-02", modifiedBy: "Liam O'Brien", version: "1.4", tags: ["Architecture"], checkedOutBy: null },
    { type: "file", name: "Meeting Notes - Aug 2026.docx", ext: "docx", size: "95 KB", modified: "2026-08-14", modifiedBy: "Carlos Mendes", version: "1.0", tags: [], checkedOutBy: null }
  ]},
  "phoenix/documents/design-assets": { name: "Design Assets", parent: { folder: "root", label: "Documents" }, items: [
    { type: "file", name: "Brand Moodboard.pdf", ext: "pdf", size: "5.6 MB", modified: "2026-07-28", modifiedBy: "Aisha Rahman", version: "1.0", tags: ["Design"], checkedOutBy: null },
    { type: "file", name: "UI Kit v3.pptx", ext: "pptx", size: "8.9 MB", modified: "2026-08-05", modifiedBy: "Aisha Rahman", version: "3.0", tags: ["Design"], checkedOutBy: null }
  ]},

  "it/documents/root": { name: "Documents", parent: null, items: [
    { type: "file", name: "Network Diagram.pdf", ext: "pdf", size: "2.1 MB", modified: "2026-07-30", modifiedBy: "Grace Lee", version: "2.0", tags: ["Infrastructure"], checkedOutBy: null },
    { type: "file", name: "Server Runbook.docx", ext: "docx", size: "540 KB", modified: "2026-08-11", modifiedBy: "Omar Farouk", version: "7.0", tags: ["Runbook"], checkedOutBy: null },
    { type: "file", name: "Incident Response Plan.pdf", ext: "pdf", size: "480 KB", modified: "2026-06-20", modifiedBy: "Jordan Reyes", version: "3.0", tags: ["Security"], checkedOutBy: null },
    { type: "file", name: "Software License Inventory.xlsx", ext: "xlsx", size: "220 KB", modified: "2026-08-13", modifiedBy: "Grace Lee", version: "15.0", tags: [], checkedOutBy: null },
    { type: "file", name: "Vendor Contacts.xlsx", ext: "xlsx", size: "60 KB", modified: "2026-07-09", modifiedBy: "Omar Farouk", version: "4.0", tags: [], checkedOutBy: null }
  ]},

  "marketing/documents/root": { name: "Documents", parent: null, items: [
    { type: "folder", id: "press-kit", name: "Press Kit", modified: "2026-07-26", modifiedBy: "Victor Alves" },
    { type: "file", name: "Brand Guidelines 2026.pdf", ext: "pdf", size: "6.3 MB", modified: "2026-08-01", modifiedBy: "Hannah Schmidt", version: "4.0", tags: ["Brand"], checkedOutBy: null },
    { type: "file", name: "Q3 Campaign Plan.pptx", ext: "pptx", size: "3.8 MB", modified: "2026-08-14", modifiedBy: "Victor Alves", version: "2.0", tags: ["Campaign"], checkedOutBy: null },
    { type: "file", name: "Press Release Template.docx", ext: "docx", size: "70 KB", modified: "2026-05-30", modifiedBy: "Hannah Schmidt", version: "2.0", tags: ["Template"], checkedOutBy: null },
    { type: "file", name: "Social Media Calendar.xlsx", ext: "xlsx", size: "190 KB", modified: "2026-08-12", modifiedBy: "Mei Lin", version: "8.0", tags: [], checkedOutBy: null }
  ]},
  "marketing/documents/press-kit": { name: "Press Kit", parent: { folder: "root", label: "Documents" }, items: [
    { type: "file", name: "Company Logo Pack.pdf", ext: "pdf", size: "12.4 MB", modified: "2026-06-02", modifiedBy: "Victor Alves", version: "1.0", tags: [], checkedOutBy: null },
    { type: "file", name: "Executive Bios.docx", ext: "docx", size: "140 KB", modified: "2026-07-19", modifiedBy: "Hannah Schmidt", version: "3.0", tags: [], checkedOutBy: null }
  ]}
};

function getLibraryContents(site, lib, folder) {
  const key = `${site}/${lib}/${folder || "root"}`;
  return LIBRARY_CONTENTS[key] || { name: folder, parent: { folder: "root", label: "Documents" }, items: [] };
}

/* Flattened index of every document, for global search */
const SEARCH_INDEX = Object.entries(LIBRARY_CONTENTS).flatMap(([key, data]) => {
  const [site, lib, folder] = key.split("/");
  return data.items.filter(i => i.type === "file").map(i => ({
    ...i, site, lib, folder,
    siteName: findSite(site).name
  }));
});

const SAMPLE_USERS = [
  { name: "Jordan Reyes", email: "jordan.reyes@edms-demo.local", title: "IT Systems Manager", dept: "IT Operations", role: "System Administrator", status: "Active", lastActive: "Just now" },
  { name: "Sarah Chen", email: "sarah.chen@edms-demo.local", title: "Finance Manager", dept: "Finance", role: "Site Owner", status: "Active", lastActive: "12 min ago" },
  { name: "Marcus Johnson", email: "marcus.johnson@edms-demo.local", title: "Financial Analyst", dept: "Finance", role: "Member", status: "Active", lastActive: "1 hour ago" },
  { name: "Priya Patel", email: "priya.patel@edms-demo.local", title: "Legal Counsel", dept: "Finance", role: "Member", status: "Active", lastActive: "3 hours ago" },
  { name: "David Kim", email: "david.kim@edms-demo.local", title: "Financial Controller", dept: "Finance", role: "Member", status: "Active", lastActive: "Yesterday" },
  { name: "Elena Rodriguez", email: "elena.rodriguez@edms-demo.local", title: "Compliance Officer", dept: "Finance", role: "Member", status: "Active", lastActive: "2 days ago" },
  { name: "James Wilson", email: "james.wilson@edms-demo.local", title: "Procurement Lead", dept: "Finance", role: "Member", status: "Active", lastActive: "5 hours ago" },
  { name: "Rachel Adams", email: "rachel.adams@edms-demo.local", title: "HR Director", dept: "Human Resources", role: "Site Owner", status: "Active", lastActive: "30 min ago" },
  { name: "Tom Baker", email: "tom.baker@edms-demo.local", title: "HR Business Partner", dept: "Human Resources", role: "Member", status: "Active", lastActive: "4 hours ago" },
  { name: "Nina Volkov", email: "nina.volkov@edms-demo.local", title: "Recruiter", dept: "Human Resources", role: "Member", status: "Inactive", lastActive: "3 weeks ago" },
  { name: "Carlos Mendes", email: "carlos.mendes@edms-demo.local", title: "Product Manager", dept: "Project Phoenix", role: "Site Owner", status: "Active", lastActive: "10 min ago" },
  { name: "Aisha Rahman", email: "aisha.rahman@edms-demo.local", title: "UX Designer", dept: "Project Phoenix", role: "Member", status: "Active", lastActive: "1 hour ago" },
  { name: "Liam O'Brien", email: "liam.obrien@edms-demo.local", title: "Engineering Lead", dept: "Project Phoenix", role: "Member", status: "Active", lastActive: "20 min ago" },
  { name: "Yuki Tanaka", email: "yuki.tanaka@edms-demo.local", title: "QA Lead", dept: "Project Phoenix", role: "Member", status: "Active", lastActive: "2 hours ago" },
  { name: "Omar Farouk", email: "omar.farouk@edms-demo.local", title: "IT Support", dept: "IT Operations", role: "Member", status: "Active", lastActive: "6 hours ago" },
  { name: "Grace Lee", email: "grace.lee@edms-demo.local", title: "Systems Engineer", dept: "IT Operations", role: "Member", status: "Active", lastActive: "45 min ago" },
  { name: "Hannah Schmidt", email: "hannah.schmidt@edms-demo.local", title: "Marketing Director", dept: "Marketing", role: "Site Owner", status: "Active", lastActive: "15 min ago" },
  { name: "Victor Alves", email: "victor.alves@edms-demo.local", title: "Content Strategist", dept: "Marketing", role: "Member", status: "Active", lastActive: "1 day ago" },
  { name: "Mei Lin", email: "mei.lin@edms-demo.local", title: "Brand Designer", dept: "Marketing", role: "Member", status: "Inactive", lastActive: "2 months ago" }
];

const SAMPLE_GROUPS = [
  { name: "Finance Owners", type: "Site group", members: 2, site: "Finance" },
  { name: "Finance Members", type: "Site group", members: 6, site: "Finance" },
  { name: "Finance Visitors", type: "Site group", members: 10, site: "Finance" },
  { name: "HR Owners", type: "Site group", members: 1, site: "Human Resources" },
  { name: "HR Members", type: "Site group", members: 4, site: "Human Resources" },
  { name: "HR Visitors", type: "Site group", members: 4, site: "Human Resources" },
  { name: "Phoenix Owners", type: "Site group", members: 1, site: "Project Phoenix" },
  { name: "Phoenix Members", type: "Site group", members: 8, site: "Project Phoenix" },
  { name: "Phoenix Visitors", type: "Site group", members: 3, site: "Project Phoenix" },
  { name: "IT Owners", type: "Site group", members: 1, site: "IT Operations" },
  { name: "IT Members", type: "Site group", members: 3, site: "IT Operations" },
  { name: "Marketing Owners", type: "Site group", members: 1, site: "Marketing" },
  { name: "Marketing Members", type: "Site group", members: 5, site: "Marketing" },
  { name: "Executive Leadership", type: "Custom group", members: 6, site: "Cross-site (Read)" },
  { name: "Finance Auditors", type: "Custom group", members: 3, site: "Finance (Read)" }
];

const AUDIT_ACTIONS = ["Upload", "Download", "View", "EditMetadata", "Delete", "Restore", "Rename", "Move", "Copy", "CheckOut", "CheckIn", "PermissionChange", "Share", "Login"];

const AUDIT_LOG = [
  { time: "2026-08-15 09:14", user: "Jordan Reyes", action: "Login", object: "—", site: "—", ip: "10.20.4.11" },
  { time: "2026-08-15 09:02", user: "Sarah Chen", action: "CheckIn", object: "Q3 Financial Report.xlsx", site: "Finance", ip: "10.20.4.22" },
  { time: "2026-08-14 17:41", user: "Jordan Reyes", action: "CheckOut", object: "Budget Forecast FY26.xlsx", site: "Finance", ip: "10.20.4.11" },
  { time: "2026-08-14 16:55", user: "Liam O'Brien", action: "CheckOut", object: "Requirements Spec v2.docx", site: "Project Phoenix", ip: "10.20.6.44" },
  { time: "2026-08-14 15:30", user: "Carlos Mendes", action: "Upload", object: "Meeting Notes - Aug 2026.docx", site: "Project Phoenix", ip: "10.20.6.10" },
  { time: "2026-08-14 14:02", user: "Victor Alves", action: "EditMetadata", object: "Q3 Campaign Plan.pptx", site: "Marketing", ip: "10.20.9.15" },
  { time: "2026-08-14 11:18", user: "Grace Lee", action: "Upload", object: "Software License Inventory.xlsx", site: "IT Operations", ip: "10.20.2.7" },
  { time: "2026-08-13 18:22", user: "Rachel Adams", action: "Share", object: "Org Directory.xlsx", site: "Human Resources", ip: "10.20.5.19" },
  { time: "2026-08-13 16:47", user: "Mei Lin", action: "Download", object: "Social Media Calendar.xlsx", site: "Marketing", ip: "10.20.9.31" },
  { time: "2026-08-13 14:05", user: "James Wilson", action: "Upload", object: "Master Service Agreement - Acme Corp.pdf", site: "Finance", ip: "10.20.4.51" },
  { time: "2026-08-13 10:33", user: "Jordan Reyes", action: "PermissionChange", object: "Contracts library", site: "Finance", ip: "10.20.4.11" },
  { time: "2026-08-12 19:02", user: "Yuki Tanaka", action: "EditMetadata", object: "Sprint Planning Board.xlsx", site: "Project Phoenix", ip: "10.20.6.61" },
  { time: "2026-08-12 15:41", user: "Marcus Johnson", action: "Move", object: "Departmental Budget - IT.xlsx", site: "Finance", ip: "10.20.4.28" },
  { time: "2026-08-12 13:12", user: "Tom Baker", action: "Upload", object: "Remote Work Policy.docx", site: "Human Resources", ip: "10.20.5.44" },
  { time: "2026-08-11 17:55", user: "Omar Farouk", action: "CheckIn", object: "Server Runbook.docx", site: "IT Operations", ip: "10.20.2.19" },
  { time: "2026-08-11 12:20", user: "Aisha Rahman", action: "Upload", object: "UI Kit v3.pptx", site: "Project Phoenix", ip: "10.20.6.77" },
  { time: "2026-08-10 16:09", user: "Sarah Chen", action: "Restore", object: "Vendor Onboarding Guide.pdf", site: "Finance", ip: "10.20.4.22" },
  { time: "2026-08-10 11:38", user: "David Kim", action: "View", object: "Org Chart.pdf", site: "Finance", ip: "10.20.4.09" },
  { time: "2026-08-09 20:14", user: "Hannah Schmidt", action: "Delete", object: "Draft Press Release.docx", site: "Marketing", ip: "10.20.9.02" },
  { time: "2026-08-09 14:27", user: "Priya Patel", action: "Rename", object: "NDA Template.docx", site: "Finance", ip: "10.20.4.63" },
  { time: "2026-08-08 09:51", user: "Elena Rodriguez", action: "Download", object: "Audit Checklist 2026.docx", site: "Finance", ip: "10.20.4.71" },
  { time: "2026-08-07 18:03", user: "Nina Volkov", action: "Login", object: "—", site: "—", ip: "10.20.5.90" },
  { time: "2026-08-07 15:44", user: "Grace Lee", action: "Copy", object: "Network Diagram.pdf", site: "IT Operations", ip: "10.20.2.07" },
  { time: "2026-08-06 10:16", user: "Jordan Reyes", action: "PermissionChange", object: "Nina Volkov (deactivated)", site: "Admin", ip: "10.20.4.11" }
];

const RECYCLE_BIN_ITEMS = [
  { type: "file", name: "Draft Press Release.docx", ext: "docx", size: "88 KB", site: "Marketing", originalPath: "Documents", deletedBy: "Hannah Schmidt", deletedAt: "2026-08-09 20:14" },
  { type: "file", name: "Old Vendor List.xlsx", ext: "xlsx", size: "150 KB", site: "Finance", originalPath: "Documents", deletedBy: "James Wilson", deletedAt: "2026-08-08 13:02" },
  { type: "folder", name: "2025 Archive", ext: null, size: "—", site: "Finance", originalPath: "Contracts", deletedBy: "Priya Patel", deletedAt: "2026-08-05 09:40" },
  { type: "file", name: "Interview Scorecard - Template.docx", ext: "docx", size: "64 KB", site: "Human Resources", originalPath: "Documents / Onboarding", deletedBy: "Nina Volkov", deletedAt: "2026-08-04 16:55" },
  { type: "file", name: "Legacy Network Diagram.pdf", ext: "pdf", size: "1.9 MB", site: "IT Operations", originalPath: "Documents", deletedBy: "Grace Lee", deletedAt: "2026-08-02 11:21" },
  { type: "file", name: "Campaign Brief - Q2.pptx", ext: "pptx", size: "2.7 MB", site: "Marketing", originalPath: "Documents", deletedBy: "Victor Alves", deletedAt: "2026-07-30 17:10" },
  { type: "file", name: "Duplicate Budget Sheet.xlsx", ext: "xlsx", size: "410 KB", site: "Finance", originalPath: "Documents / Budgets FY26", deletedBy: "Marcus Johnson", deletedAt: "2026-07-28 09:05" }
];

const NOTIFICATIONS = [
  { icon: "share", title: "Sarah Chen shared a file with you", desc: "Q3 Financial Report.xlsx", time: "12 min ago", unread: true },
  { icon: "history", title: "Document checked in", desc: "Server Runbook.docx by Omar Farouk", time: "2 hours ago", unread: true },
  { icon: "userPlus", title: "You were added to a group", desc: "Executive Leadership", time: "Yesterday", unread: true },
  { icon: "alertTriangle", title: "Storage quota warning", desc: "Marketing site is at 82% of quota", time: "Yesterday", unread: false },
  { icon: "trash", title: "Item restored", desc: "Vendor Onboarding Guide.pdf by Sarah Chen", time: "2 days ago", unread: false }
];

const QUICK_ACCESS = [
  { site: "finance", lib: "documents", folder: "root", name: "Q3 Financial Report.xlsx", ext: "xlsx" },
  { site: "phoenix", lib: "documents", folder: "root", name: "Project Phoenix Roadmap.pptx", ext: "pptx" },
  { site: "hr", lib: "documents", folder: "root", name: "Employee Handbook 2026.docx", ext: "docx" },
  { site: "marketing", lib: "documents", folder: "root", name: "Brand Guidelines 2026.pdf", ext: "pdf" }
];

/* Storage usage report data */
const STORAGE_TREND = [ 68, 74, 81, 90, 101, 108, 118 ]; /* GB, last 7 months incl. current */
const STORAGE_TREND_LABELS = ["Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];
const FILE_TYPE_BREAKDOWN = [
  { label: "PDF", value: 42.1, color: "hsl(var(--chart-1))" },
  { label: "Word", value: 28.4, color: "hsl(var(--chart-2))" },
  { label: "Excel", value: 24.6, color: "hsl(var(--chart-3))" },
  { label: "PowerPoint", value: 18.9, color: "hsl(var(--chart-4))" },
  { label: "Other", value: 4.0, color: "hsl(var(--chart-5))" }
];
