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

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/forgot-password", element: <ForgotPassword /> },
  { path: "/reset-password", element: <ResetPassword /> },
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/search", element: <Search /> },
      { path: "/recycle-bin", element: <RecycleBin /> },
      { path: "/recycle-bin/:siteSlug", element: <RecycleBin /> },
      { path: "/me/profile", element: <Profile /> },
      { path: "/admin", element: <Admin /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
