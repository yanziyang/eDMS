import type {
  AuditEntry,
  Group,
  LibraryFolder,
  Notification,
  QuickAccessDoc,
  RecycleItem,
  FavoriteEntry,
  RecentDocument,
  SavedView,
  Site,
  User,
} from "@/types";

export const CURRENT_USER = {
  name: "Jordan Reyes",
  initials: "JR",
  email: "jordan.reyes@edms-demo.local",
  title: "IT Systems Manager",
  role: "System Administrator",
  site: "IT Operations",
};

export const SITES: Site[] = [
  {
    slug: "finance", name: "Finance", description: "Budgets, invoices, and financial reporting.", icon: "landmark", color: "#4f46e5", members: 18, storageUsedGB: 34.2, storageQuotaGB: 100,
    libraries: [{ id: "documents", name: "Documents" }, { id: "contracts", name: "Contracts" }],
  },
  {
    slug: "hr", name: "Human Resources", description: "Policies, onboarding, and employee records.", icon: "users", color: "#0ea5c4", members: 9, storageUsedGB: 12.8, storageQuotaGB: 50,
    libraries: [{ id: "documents", name: "Documents" }, { id: "policies", name: "Policies" }],
  },
  {
    slug: "phoenix", name: "Project Phoenix", description: "Cross-functional product launch workspace.", icon: "rocket", color: "#16a34a", members: 12, storageUsedGB: 21.5, storageQuotaGB: 50,
    libraries: [{ id: "documents", name: "Documents" }],
  },
  {
    slug: "it", name: "IT Operations", description: "Infrastructure runbooks and vendor contracts.", icon: "server", color: "#d97706", members: 7, storageUsedGB: 8.4, storageQuotaGB: 50,
    libraries: [{ id: "documents", name: "Documents" }],
  },
  {
    slug: "marketing", name: "Marketing", description: "Campaigns, brand assets, and press materials.", icon: "megaphone", color: "#db2777", members: 14, storageUsedGB: 41.1, storageQuotaGB: 100,
    libraries: [{ id: "documents", name: "Documents" }],
  },
];

export function findSite(slug: string): Site {
  return SITES.find((s) => s.slug === slug) ?? SITES[0];
}

const F = (
  id: string, name: string, modified: string, modifiedBy: string, ext: string, size: string,
  version: string, tags: string[] = [], checkedOutBy: string | null = null,
) => ({ type: "file" as const, id, name, ext, size, modified, modifiedBy, version, tags, checkedOutBy });

const D = (id: string, name: string, modified: string, modifiedBy: string) =>
  ({ type: "folder" as const, id, name, modified, modifiedBy });

/* Folder + file contents, keyed by "<site>/<library>/<folder>" */
export const LIBRARY_CONTENTS: Record<string, LibraryFolder> = {
  "finance/documents/root": { name: "Documents", parent: null, items: [
    D("invoices", "Invoices", "2026-08-10", "Sarah Chen"),
    D("budgets", "Budgets FY26", "2026-08-01", "Marcus Johnson"),
    F("q3-report", "Q3 Financial Report.xlsx", "2026-08-14", "Sarah Chen", "xlsx", "2.4 MB", "3.0", ["Quarterly", "Finance"]),
    F("budget-forecast", "Budget Forecast FY26.xlsx", "2026-08-12", "Jordan Reyes", "xlsx", "1.1 MB", "1.4", ["Forecast"], "Jordan Reyes"),
    F("audit-checklist", "Audit Checklist 2026.docx", "2026-08-05", "Elena Rodriguez", "docx", "340 KB", "2.0", ["Audit"]),
    F("org-chart", "Org Chart.pdf", "2026-07-29", "David Kim", "pdf", "890 KB", "1.0"),
    F("expense-policy", "Expense Policy.docx", "2026-07-18", "James Wilson", "docx", "210 KB", "4.0", ["Policy"]),
  ] },
  "finance/documents/invoices": { name: "Invoices", parent: { folder: "root", label: "Documents" }, items: [
    F("inv-417", "Invoice_2026_0417.pdf", "2026-08-09", "Sarah Chen", "pdf", "180 KB", "1.0", ["Vendor"]),
    F("inv-418", "Invoice_2026_0418.pdf", "2026-08-09", "Sarah Chen", "pdf", "176 KB", "1.0", ["Vendor"]),
    F("inv-log", "Invoice Tracking Log.xlsx", "2026-08-11", "Marcus Johnson", "xlsx", "410 KB", "6.0"),
  ] },
  "finance/documents/budgets": { name: "Budgets FY26", parent: { folder: "root", label: "Documents" }, items: [
    F("budget-it", "Departmental Budget - IT.xlsx", "2026-08-03", "Marcus Johnson", "xlsx", "980 KB", "2.0", ["FY26"]),
    F("budget-mkt", "Departmental Budget - Marketing.xlsx", "2026-08-03", "Marcus Johnson", "xlsx", "1.0 MB", "2.0", ["FY26"]),
    F("capex", "Capex Plan.pdf", "2026-07-22", "David Kim", "pdf", "560 KB", "1.1"),
  ] },
  "finance/contracts/root": { name: "Contracts", parent: null, items: [
    D("vendor-agreements", "Vendor Agreements", "2026-07-20", "Priya Patel"),
    F("nda-template", "NDA Template.docx", "2026-06-11", "Priya Patel", "docx", "120 KB", "5.0", ["Template", "Legal"]),
    F("msa-acme", "Master Service Agreement - Acme Corp.pdf", "2026-08-02", "James Wilson", "pdf", "1.8 MB", "2.0", ["Vendor"]),
  ] },
  "finance/contracts/vendor-agreements": { name: "Vendor Agreements", parent: { folder: "root", label: "Contracts" }, items: [
    F("va-acme", "Vendor Agreement - Acme Corp.pdf", "2026-08-09", "James Wilson", "pdf", "980 KB", "1.2", ["Vendor", "Active"]),
    F("va-compliance", "Vendor Compliance Checklist.xlsx", "2026-07-15", "James Wilson", "xlsx", "210 KB", "1.0", ["Compliance"]),
    F("va-northwind", "Vendor Agreement - Northwind Logistics.pdf", "2026-06-28", "Priya Patel", "pdf", "1.1 MB", "1.0", ["Vendor"]),
  ] },

  "hr/documents/root": { name: "Documents", parent: null, items: [
    D("onboarding", "Onboarding", "2026-08-06", "Rachel Adams"),
    F("handbook", "Employee Handbook 2026.docx", "2026-08-08", "Rachel Adams", "docx", "1.4 MB", "6.0", ["Policy"]),
    F("benefits", "Benefits Overview.pptx", "2026-07-30", "Tom Baker", "pptx", "3.1 MB", "2.0"),
    F("leave-form", "Leave Request Form.docx", "2026-06-14", "Tom Baker", "docx", "90 KB", "3.0", ["Form"]),
    F("org-directory", "Org Directory.xlsx", "2026-08-13", "Rachel Adams", "xlsx", "260 KB", "9.0"),
  ] },
  "hr/documents/onboarding": { name: "Onboarding", parent: { folder: "root", label: "Documents" }, items: [
    F("hire-checklist", "New Hire Checklist.docx", "2026-08-01", "Rachel Adams", "docx", "150 KB", "4.0", ["Checklist"]),
    F("equipment-req", "IT Equipment Request.docx", "2026-05-19", "Tom Baker", "docx", "80 KB", "1.0"),
  ] },
  "hr/policies/root": { name: "Policies", parent: null, items: [
    D("archived", "Archived", "2026-04-02", "Rachel Adams"),
    F("code-of-conduct", "Code of Conduct.pdf", "2026-07-25", "Rachel Adams", "pdf", "410 KB", "3.0", ["Policy"]),
    F("remote-policy", "Remote Work Policy.docx", "2026-08-04", "Tom Baker", "docx", "180 KB", "2.1", ["Policy"]),
    F("data-protection", "Data Protection Policy.pdf", "2026-07-11", "Rachel Adams", "pdf", "330 KB", "1.0", ["Policy", "Compliance"]),
  ] },
  "hr/policies/archived": { name: "Archived", parent: { folder: "root", label: "Policies" }, items: [] },

  "phoenix/documents/root": { name: "Documents", parent: null, items: [
    D("design-assets", "Design Assets", "2026-08-07", "Aisha Rahman"),
    F("roadmap", "Project Phoenix Roadmap.pptx", "2026-08-13", "Carlos Mendes", "pptx", "4.2 MB", "5.0", ["Roadmap"]),
    F("requirements", "Requirements Spec v2.docx", "2026-08-14", "Liam O'Brien", "docx", "760 KB", "2.3", ["Spec"], "Liam O'Brien"),
    F("sprint-board", "Sprint Planning Board.xlsx", "2026-08-12", "Yuki Tanaka", "xlsx", "310 KB", "12.0"),
    F("arch-diagram", "Architecture Diagram.pdf", "2026-08-02", "Liam O'Brien", "pdf", "1.2 MB", "1.4", ["Architecture"]),
    F("meeting-notes", "Meeting Notes - Aug 2026.docx", "2026-08-14", "Carlos Mendes", "docx", "95 KB", "1.0"),
  ] },
  "phoenix/documents/design-assets": { name: "Design Assets", parent: { folder: "root", label: "Documents" }, items: [
    F("moodboard", "Brand Moodboard.pdf", "2026-07-28", "Aisha Rahman", "pdf", "5.6 MB", "1.0", ["Design"]),
    F("ui-kit", "UI Kit v3.pptx", "2026-08-05", "Aisha Rahman", "pptx", "8.9 MB", "3.0", ["Design"]),
  ] },

  "it/documents/root": { name: "Documents", parent: null, items: [
    F("network-diagram", "Network Diagram.pdf", "2026-07-30", "Grace Lee", "pdf", "2.1 MB", "2.0", ["Infrastructure"]),
    F("runbook", "Server Runbook.docx", "2026-08-11", "Omar Farouk", "docx", "540 KB", "7.0", ["Runbook"]),
    F("irp", "Incident Response Plan.pdf", "2026-06-20", "Jordan Reyes", "pdf", "480 KB", "3.0", ["Security"]),
    F("license-inventory", "Software License Inventory.xlsx", "2026-08-13", "Grace Lee", "xlsx", "220 KB", "15.0"),
    F("vendor-contacts", "Vendor Contacts.xlsx", "2026-07-09", "Omar Farouk", "xlsx", "60 KB", "4.0"),
  ] },

  "marketing/documents/root": { name: "Documents", parent: null, items: [
    D("press-kit", "Press Kit", "2026-07-26", "Victor Alves"),
    F("brand-guidelines", "Brand Guidelines 2026.pdf", "2026-08-01", "Hannah Schmidt", "pdf", "6.3 MB", "4.0", ["Brand"]),
    F("q3-campaign", "Q3 Campaign Plan.pptx", "2026-08-14", "Victor Alves", "pptx", "3.8 MB", "2.0", ["Campaign"]),
    F("press-template", "Press Release Template.docx", "2026-05-30", "Hannah Schmidt", "docx", "70 KB", "2.0", ["Template"]),
    F("social-calendar", "Social Media Calendar.xlsx", "2026-08-12", "Mei Lin", "xlsx", "190 KB", "8.0"),
  ] },
  "marketing/documents/press-kit": { name: "Press Kit", parent: { folder: "root", label: "Documents" }, items: [
    F("logo-pack", "Company Logo Pack.pdf", "2026-06-02", "Victor Alves", "pdf", "12.4 MB", "1.0"),
    F("exec-bios", "Executive Bios.docx", "2026-07-19", "Hannah Schmidt", "docx", "140 KB", "3.0"),
  ] },
};

export function getLibraryContents(site: string, lib: string, folder: string): LibraryFolder {
  const key = `${site}/${lib}/${folder || "root"}`;
  return LIBRARY_CONTENTS[key] ?? { name: folder, parent: { folder: "root", label: "Documents" }, items: [] };
}

export const SEARCH_INDEX = Object.entries(LIBRARY_CONTENTS).flatMap(([key, data]) => {
  const [site, lib, folder] = key.split("/");
  return data.items
    .filter((i) => i.type === "file")
    .map((i) => ({ ...i, site, lib, folder, siteName: findSite(site).name }));
});

export const SAMPLE_USERS: User[] = [
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
  { name: "Mei Lin", email: "mei.lin@edms-demo.local", title: "Brand Designer", dept: "Marketing", role: "Member", status: "Inactive", lastActive: "2 months ago" },
];

export const SAMPLE_GROUPS: Group[] = [
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
  { name: "Finance Auditors", type: "Custom group", members: 3, site: "Finance (Read)" },
];

export const AUDIT_ACTIONS = ["Upload", "Download", "View", "EditMetadata", "Delete", "Restore", "Rename", "Move", "Copy", "CheckOut", "CheckIn", "PermissionChange", "Share", "Login"];

export const AUDIT_LOG: AuditEntry[] = [
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
  { time: "2026-08-06 10:16", user: "Jordan Reyes", action: "PermissionChange", object: "Nina Volkov (deactivated)", site: "Admin", ip: "10.20.4.11" },
];

export const RECYCLE_BIN_ITEMS: RecycleItem[] = [
  { type: "file", name: "Draft Press Release.docx", ext: "docx", size: "88 KB", site: "Marketing", originalPath: "Documents", deletedBy: "Hannah Schmidt", deletedAt: "2026-08-09 20:14" },
  { type: "file", name: "Old Vendor List.xlsx", ext: "xlsx", size: "150 KB", site: "Finance", originalPath: "Documents", deletedBy: "James Wilson", deletedAt: "2026-08-08 13:02" },
  { type: "folder", name: "2025 Archive", ext: null, size: "—", site: "Finance", originalPath: "Contracts", deletedBy: "Priya Patel", deletedAt: "2026-08-05 09:40" },
  { type: "file", name: "Interview Scorecard - Template.docx", ext: "docx", size: "64 KB", site: "Human Resources", originalPath: "Documents / Onboarding", deletedBy: "Nina Volkov", deletedAt: "2026-08-04 16:55" },
  { type: "file", name: "Legacy Network Diagram.pdf", ext: "pdf", size: "1.9 MB", site: "IT Operations", originalPath: "Documents", deletedBy: "Grace Lee", deletedAt: "2026-08-02 11:21" },
  { type: "file", name: "Campaign Brief - Q2.pptx", ext: "pptx", size: "2.7 MB", site: "Marketing", originalPath: "Documents", deletedBy: "Victor Alves", deletedAt: "2026-07-30 17:10" },
  { type: "file", name: "Duplicate Budget Sheet.xlsx", ext: "xlsx", size: "410 KB", site: "Finance", originalPath: "Documents / Budgets FY26", deletedBy: "Marcus Johnson", deletedAt: "2026-07-28 09:05" },
];

export const NOTIFICATIONS: Notification[] = [
  { icon: "share", title: "Sarah Chen shared a file with you", desc: "Q3 Financial Report.xlsx", time: "12 min ago", unread: true },
  { icon: "history", title: "Document checked in", desc: "Server Runbook.docx by Omar Farouk", time: "2 hours ago", unread: true },
  { icon: "userPlus", title: "You were added to a group", desc: "Executive Leadership", time: "Yesterday", unread: true },
  { icon: "alertTriangle", title: "Storage quota warning", desc: "Marketing site is at 82% of quota", time: "Yesterday", unread: false },
  { icon: "trash", title: "Item restored", desc: "Vendor Onboarding Guide.pdf by Sarah Chen", time: "2 days ago", unread: false },
];

export const QUICK_ACCESS: QuickAccessDoc[] = [
  { site: "finance", lib: "documents", folder: "root", name: "Q3 Financial Report.xlsx", ext: "xlsx" },
  { site: "phoenix", lib: "documents", folder: "root", name: "Project Phoenix Roadmap.pptx", ext: "pptx" },
  { site: "hr", lib: "documents", folder: "root", name: "Employee Handbook 2026.docx", ext: "docx" },
  { site: "marketing", lib: "documents", folder: "root", name: "Brand Guidelines 2026.pdf", ext: "pdf" },
];

export const RECENT_DOCUMENTS: RecentDocument[] = [
  { site: "phoenix", lib: "documents", folder: "root", name: "Requirements Spec v2.docx", ext: "docx", modified: "2026-08-14", modifiedBy: "Liam O'Brien", action: "Viewed" },
  { site: "finance", lib: "documents", folder: "root", name: "Q3 Financial Report.xlsx", ext: "xlsx", modified: "2026-08-14", modifiedBy: "Sarah Chen", action: "Modified" },
  { site: "marketing", lib: "documents", folder: "root", name: "Q3 Campaign Plan.pptx", ext: "pptx", modified: "2026-08-14", modifiedBy: "Victor Alves", action: "Uploaded" },
  { site: "hr", lib: "documents", folder: "root", name: "Employee Handbook 2026.docx", ext: "docx", modified: "2026-08-08", modifiedBy: "Rachel Adams", action: "Viewed" },
  { site: "it", lib: "documents", folder: "root", name: "Server Runbook.docx", ext: "docx", modified: "2026-08-11", modifiedBy: "Omar Farouk", action: "Viewed" },
];

export const FAVORITE_ENTRIES: FavoriteEntry[] = [
  { key: "site:finance", type: "site", name: "Finance", href: "/sites/finance", detail: "Site · 18 members" },
  { key: "library:finance/documents", type: "library", name: "Finance Documents", href: "/sites/finance/documents/root", detail: "Library · Finance" },
  { key: "folder:finance/documents/invoices", type: "folder", name: "Invoices", href: "/sites/finance/documents/invoices", detail: "Folder · Finance / Documents" },
  { key: "document:phoenix/documents/root/requirements", type: "document", name: "Requirements Spec v2.docx", href: "/sites/phoenix/documents/root", detail: "Document · Project Phoenix / Documents", ext: "docx" },
];

export const SAVED_VIEWS: Record<string, SavedView[]> = {
  "finance/documents/root": [
    { id: "all", name: "All items", filter: "", sortKey: "name", sortDir: "asc", groupBy: "none", isDefault: true },
    { id: "recent-files", name: "Recently modified files", filter: "", sortKey: "modified", sortDir: "desc", groupBy: "type" },
    { id: "finance-tags", name: "Finance tagged", filter: "finance", sortKey: "name", sortDir: "asc", groupBy: "none" },
  ],
  "phoenix/documents/root": [
    { id: "all", name: "All items", filter: "", sortKey: "name", sortDir: "asc", groupBy: "none", isDefault: true },
    { id: "roadmap", name: "Roadmap and specs", filter: "roadmap", sortKey: "modified", sortDir: "desc", groupBy: "none" },
  ],
};

/* Storage usage report data */
export const STORAGE_TREND = [68, 74, 81, 90, 101, 108, 118]; /* GB, last 7 months incl. current */
export const STORAGE_TREND_LABELS = ["Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];
export const FILE_TYPE_BREAKDOWN = [
  { label: "PDF", value: 42.1, color: "hsl(var(--chart-1))" },
  { label: "Word", value: 28.4, color: "hsl(var(--chart-2))" },
  { label: "Excel", value: 24.6, color: "hsl(var(--chart-3))" },
  { label: "PowerPoint", value: 18.9, color: "hsl(var(--chart-4))" },
  { label: "Other", value: 4.0, color: "hsl(var(--chart-5))" },
];

export const THEME_META = [
  { id: "default", name: "Default", desc: "Light · Indigo accent", bg: "#ffffff", sidebar: "#f7f8fb", primary: "#4338ca", card: "#eef0f6" },
  { id: "midnight", name: "Midnight", desc: "Dark · Indigo accent", bg: "#0d1424", sidebar: "#0a1020", primary: "#a5b4fc", card: "#18213a" },
  { id: "ocean", name: "Ocean", desc: "Light · Blue accent", bg: "#fbfeff", sidebar: "#eef7fb", primary: "#0a79b3", card: "#e3f2f9" },
  { id: "forest", name: "Forest", desc: "Light · Green accent", bg: "#fdfcf9", sidebar: "#f5f4ea", primary: "#1f7a4d", card: "#eaf2e3" },
] as const;
