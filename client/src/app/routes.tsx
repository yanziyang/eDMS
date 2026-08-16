import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/app/AppShell";
import { ForgotPassword } from "@/pages/forgot-password";
import { Home } from "@/pages/home";
import { Admin } from "@/pages/admin";
import { Login } from "@/pages/login";
import { Profile } from "@/pages/profile";
import { RecycleBin } from "@/pages/recycle-bin";
import { ResetPassword } from "@/pages/reset-password";
import { Search } from "@/pages/search";
import { SiteHome } from "@/pages/site-home";
import { AdminGroups } from "@/pages/admin/groups";
import { AdminSites } from "@/pages/admin/sites";
import { AdminUsers } from "@/pages/admin/users";
import { AdminAuditLog } from "@/pages/admin/audit-log";
import { AdminSettings } from "@/pages/admin/settings";
import { AdminStorage } from "@/pages/admin/storage";
import { AdminContentTypes } from "@/pages/admin/content-types";
import { LibraryBrowser } from "@/pages/library";

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/forgot-password", element: <ForgotPassword /> },
  { path: "/reset-password", element: <ResetPassword /> },
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/sites/:siteSlug", element: <SiteHome /> },
      { path: "/sites/:siteSlug/libraries/:libraryId", element: <LibraryBrowser /> },
      { path: "/search", element: <Search /> },
      { path: "/recycle-bin", element: <RecycleBin /> },
      { path: "/recycle-bin/:siteSlug", element: <RecycleBin /> },
      { path: "/me/profile", element: <Profile /> },
      {
        path: "/admin",
        element: <Admin />,
        children: [
          { index: true, element: <Navigate to="/admin/users" replace /> },
          { path: "users", element: <AdminUsers /> },
          { path: "groups", element: <AdminGroups /> },
          { path: "sites", element: <AdminSites /> },
          { path: "storage", element: <AdminStorage /> },
          { path: "content-types", element: <AdminContentTypes /> },
          { path: "audit-log", element: <AdminAuditLog /> },
          { path: "settings", element: <AdminSettings /> },
        ],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
