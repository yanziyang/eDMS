import { Eye, Lock, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "@/components/app/auth-shell";
import { useAuth } from "@/features/auth/auth-context";
import { getSsoProviders } from "@/features/auth/api";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ssoProviders, setSsoProviders] = useState({ oidc: false, saml: false });

  useEffect(() => {
    let cancelled = false;
    getSsoProviders()
      .then((providers) => {
        if (!cancelled) {
          setSsoProviders(providers);
        }
      })
      .catch(() => {
        // SSO is optional; a provider discovery failure must not hide local login.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate("/", { replace: true });
    } catch {
      setError("Invalid email or password.");
    } finally {
      setSubmitting(false);
    }
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
        <div className="flex size-[38px] items-center justify-center rounded-[10px] bg-primary font-bold text-primary-foreground">
          DM
        </div>
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
          <Label htmlFor="login-email" className="text-[13px]">Email address</Label>
          <InputGroup className="mt-1.5">
            <InputGroupAddon>
              <Mail />
            </InputGroupAddon>
            <InputGroupInput
              id="login-email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
            />
          </InputGroup>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password" className="text-[13px]">Password</Label>
            <Link to="/forgot-password" className="text-xs font-medium text-primary">
              Forgot password?
            </Link>
          </div>
          <InputGroup className={cn("mt-1.5", error && "border-destructive")} data-invalid={!!error}>
            <InputGroupAddon>
              <Lock />
            </InputGroupAddon>
            <InputGroupInput
              id="login-password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              aria-invalid={!!error}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label="Show password"
              >
                <Eye className={cn(showPassword && "text-primary")} />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          {error && <div className="mt-1 text-xs text-destructive">{error}</div>}
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {(ssoProviders.oidc || ssoProviders.saml) && (
        <div className="mt-6 flex flex-col gap-3">
          <div className="relative flex items-center">
            <div className="h-px flex-1 bg-border" />
            <span className="px-3 text-xs text-muted-foreground">or continue with</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          {ssoProviders.oidc && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => {
                window.location.href = "/api/v1/auth/sso/oidc/challenge";
              }}
            >
              Sign in with SSO
            </Button>
          )}
          {ssoProviders.saml && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => {
                window.location.href = "/api/v1/auth/sso/saml/challenge";
              }}
            >
              Sign in with SAML SSO
            </Button>
          )}
        </div>
      )}
    </AuthShell>
  );
}
