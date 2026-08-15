import { Route, Routes } from "react-router-dom";
import { Button } from "@/components/ui/button";

function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8">
      <div className="flex size-12 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
        DM
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">eDMS</h1>
      <p className="text-sm text-muted-foreground">
        Enterprise Document Management System
      </p>
      <Button>Sign in</Button>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  );
}
