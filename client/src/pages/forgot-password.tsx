import { ArrowLeft, Mail } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthShell, BrandHeader } from "@/components/app/auth-shell";
import { forgotPassword } from "@/features/auth/api";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await forgotPassword(email.trim());
    } finally {
      setSubmitting(false);
      setSent(true);
    }
  };

  return (
    <AuthShell
      quote="“Account recovery, the way it should be — fast, secure, and audited.”"
      features={[
        "Single-use, time-limited reset links",
        "Every reset attempt is logged",
        "SSO accounts reset via your IdP",
      ]}
    >
      <BrandHeader to="/login" />

      {!sent ? (
        <div>
          <h1 className="mb-1 text-2xl font-bold">Forgot your password?</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Enter the email address associated with your account and we&apos;ll send a link to
            reset your password.
          </p>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <Label className="text-[13px]">Email address</Label>
              <InputGroup className="mt-1.5">
                <InputGroupAddon>
                  <Mail />
                </InputGroupAddon>
                <InputGroupInput
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </InputGroup>
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-success-soft text-success">
            <Mail className="size-6" />
          </div>
          <h1 className="mb-1 text-2xl font-bold">Check your inbox</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            If an account exists for <strong>{email.trim() || "your email address"}</strong>, a
            password reset link has been sent. The link expires in 1 hour.
          </p>
        </div>
      )}

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
