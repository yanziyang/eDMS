import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthShell } from "@/components/app/auth-shell";
import { useAuth } from "@/features/auth/auth-context";
import { Button } from "@/components/ui/button";

export function SsoComplete() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { completeSso } = useAuth();
  const handled = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (handled.current) {
      return;
    }
    handled.current = true;

    const providerError = searchParams.get("error");
    const code = searchParams.get("code");
    if (providerError) {
      setError("Your organization could not complete sign-in. Please try again.");
      return;
    }
    if (!code) {
      setError("The sign-in link is missing or has expired. Please start again.");
      return;
    }

    // Remove the one-time code from the visible URL/history before exchanging it.
    navigate("/sso/complete", { replace: true });
    completeSso(code)
      .then(() => navigate("/", { replace: true }))
      .catch(() => setError("We could not complete sign-in. Please start again."));
  }, [completeSso, navigate, searchParams]);

  return (
    <AuthShell
      quote="“One secure sign-in, then every document your team needs.”"
      features={["Single sign-on with your organization", "Access tokens stay in memory", "Every login is audited"]}
    >
      <div className="flex flex-col items-center text-center">
        {error ? (
          <>
            <h1 className="mb-2 text-2xl font-bold">Sign-in could not be completed</h1>
            <p className="mb-6 text-sm text-muted-foreground">{error}</p>
            <Button asChild size="lg" className="w-full">
              <Link to="/login">Back to sign in</Link>
            </Button>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-2xl font-bold">Completing sign-in…</h1>
            <p role="status" className="text-sm text-muted-foreground">
              Verifying your organization account. This will only take a moment.
            </p>
          </>
        )}
      </div>
    </AuthShell>
  );
}
