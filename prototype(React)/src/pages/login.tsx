import { useState } from "react";
import { CircleX, Eye, Lock, Mail, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "@/components/app/auth-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("jordan.reyes@edms-demo.local");
  const [password, setPassword] = useState("demo-password");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!email.trim()) next.email = "Enter your email address";
    if (!password.trim()) next.password = "Enter your password";
    setErrors(next);
    if (next.email || next.password) return;
    setSubmitting(true);
    setTimeout(() => navigate("/home"), 500);
  };

  return (
    <AuthShell
      quote="“Every contract, policy, and report — organized, versioned, and exactly where your team expects it.”"
      features={[
        "Version history & check-in / check-out",
        "Granular, inheritable permissions",
        "Organization-wide instant search",
        "Full audit trail on every action",
      ]}
    >
      <div className="mb-8 flex items-center gap-2">
        <div className="mark size-[38px] rounded-[10px]">DM</div>
        <div>
          <div className="text-lg font-bold leading-[1.1]">eDMS</div>
          <div className="text-xs text-muted-foreground">Enterprise Document Management</div>
        </div>
      </div>

      <h1 className="mb-1 text-2xl font-bold">Welcome back</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Sign in with your organization account to continue.
      </p>

      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div>
          <Label className="text-[13px]">Email address</Label>
          <InputGroup
            className={cn("mt-1.5", errors.email && "border-destructive")}
            data-invalid={!!errors.email}
          >
            <InputGroupAddon>
              <Mail />
            </InputGroupAddon>
            <InputGroupInput
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              aria-invalid={!!errors.email}
            />
          </InputGroup>
          {errors.email && (
            <div className="mt-1 flex items-center gap-1 text-xs text-destructive">
              <CircleX className="size-3.5" />
              {errors.email}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label className="text-[13px]">Password</Label>
            <Link to="/forgot-password" className="text-xs font-medium text-primary">
              Forgot password?
            </Link>
          </div>
          <InputGroup
            className={cn("mt-1.5", errors.password && "border-destructive")}
            data-invalid={!!errors.password}
          >
            <InputGroupAddon>
              <Lock />
            </InputGroupAddon>
            <InputGroupInput
              type={showPw ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              aria-invalid={!!errors.password}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton size="icon-xs" onClick={() => setShowPw((s) => !s)} aria-label="Show password">
                <Eye className={cn(showPw && "text-primary")} />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          {errors.password && (
            <div className="mt-1 flex items-center gap-1 text-xs text-destructive">
              <CircleX className="size-3.5" />
              {errors.password}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="rememberMe" checked={remember} onCheckedChange={(c) => setRemember(!!c)} />
          <label htmlFor="rememberMe" className="cursor-pointer text-[13px]">
            Keep me signed in
          </label>
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        OR
        <div className="h-px flex-1 bg-border" />
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <span className="w-full">
            <Button variant="outline" className="w-full" disabled>
              <ShieldCheck data-icon="inline-start" />
              Sign in with company SSO (SAML2 / OIDC)
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Configured by your administrator in a future release</TooltipContent>
      </Tooltip>

      <div className="demo-creds mt-6">
        <strong>Prototype note:</strong> this is a visual walkthrough with no real backend. Any email /
        password combination signs you in as <code>Jordan Reyes</code>, System Administrator.
      </div>
    </AuthShell>
  );
}
