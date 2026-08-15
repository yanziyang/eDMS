import type { ReactNode } from "react";
import { CircleCheck, Database } from "lucide-react";
import { Link } from "react-router-dom";

export function AuthShell({
  children,
  quote,
  features,
}: {
  children: ReactNode;
  quote: string;
  features: string[];
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-[380px]">{children}</div>
      </div>
      <div className="auth-panel-brand hidden md:flex">
        <div className="content relative z-[1]">
          <div className="flex items-center gap-2.5 text-[17px] font-bold">
            <div className="flex size-9 items-center justify-center rounded-[10px] bg-white/18">
              <Database className="size-5 text-white" />
            </div>
            eDMS
          </div>
        </div>
        <div className="content relative z-[1]">
          <div className="max-w-[30ch] text-xl font-medium leading-[1.45]">{quote}</div>
          <div className="mt-8 flex flex-col gap-3 text-[13.5px]">
            {features.map((f) => (
              <div key={f} className="flex items-center gap-2">
                <CircleCheck className="size-4 shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>
        <div className="content relative z-[1] text-xs opacity-75">
          © 2026 eDMS — Internal enterprise prototype
        </div>
      </div>
    </div>
  );
}

export function BrandHeader({ to }: { to?: string }) {
  return (
    <Link to={to ?? "/login"} className="mb-8 flex w-fit items-center gap-2">
      <div className="mark size-[38px] rounded-[10px]">DM</div>
      <div>
        <div className="text-lg font-bold leading-[1.1]">eDMS</div>
        <div className="text-xs text-muted-foreground">Enterprise Document Management</div>
      </div>
    </Link>
  );
}
