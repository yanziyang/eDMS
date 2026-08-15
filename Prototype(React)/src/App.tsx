import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/app/app-layout";
import { ForgotPassword } from "@/pages/forgot-password";
import { Login } from "@/pages/login";
import { Home } from "@/pages/home";
import { SiteHome } from "@/pages/site-home";
import { Library } from "@/pages/library";
import { Search } from "@/pages/search";
import { RecycleBin } from "@/pages/recycle-bin";
import { Profile } from "@/pages/profile";
import { AdminAuditLog } from "@/pages/admin/audit-log";
import { AdminGroups } from "@/pages/admin/groups";
import { AdminSettings } from "@/pages/admin/settings";
import { AdminSites } from "@/pages/admin/sites";
import { AdminStorage } from "@/pages/admin/storage";
import { AdminUsers } from "@/pages/admin/users";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route element={<AppLayout />}>
        <Route path="/home" element={<Home />} />
        <Route path="/sites/:slug" element={<SiteHome />} />
        <Route path="/sites/:slug/:lib" element={<Library />} />
        <Route path="/sites/:slug/:lib/:folder" element={<Library />} />
        <Route path="/search" element={<Search />} />
        <Route path="/recycle-bin" element={<RecycleBin />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/groups" element={<AdminGroups />} />
        <Route path="/admin/sites" element={<AdminSites />} />
        <Route path="/admin/storage" element={<AdminStorage />} />
        <Route path="/admin/audit-log" element={<AdminAuditLog />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
        <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Route>
    </Routes>
  );
}
