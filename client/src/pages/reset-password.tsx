import { ArrowLeft, Lock } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthShell, BrandHeader } from "@/components/app/auth-shell";
import { resetPassword } from "@/features/auth/api";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";

export function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(email, token, password);
      navigate("/login");
    } catch {
      setError("The reset link is invalid or has expired.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell quote="“Set a strong, unique password to protect your account.”" features={[]}>
      <BrandHeader to="/login" />
      <h1 className="mb-1 text-2xl font-bold">Reset your password</h1>
      <p className="mb-6 text-sm text-muted-foreground">Choose a new password for {email}.</p>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <Label className="text-[13px]">New password</Label>
          <InputGroup className="mt-1.5">
            <InputGroupAddon>
              <Lock />
            </InputGroupAddon>
            <InputGroupInput
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
          </InputGroup>
        </div>
        <div>
          <Label className="text-[13px]">Confirm password</Label>
          <InputGroup className="mt-1.5">
            <InputGroupAddon>
              <Lock />
            </InputGroupAddon>
            <InputGroupInput
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
            />
          </InputGroup>
        </div>
        {error && <div className="text-xs text-destructive">{error}</div>}
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Saving…" : "Set new password"}
        </Button>
      </form>

      <Link
        to="/login"
        className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
      >
        <ArrowLeft className="size-4" />
        Back to sign in
      </Link>
    </AuthShell>
  );
}
