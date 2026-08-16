import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { setShareToken } from "@/features/share-links/token";

export function ShareLink() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      setShareToken(token);
      toast.success("Share link applied — open the document from search or your libraries");
    } else {
      toast.error("Invalid share link");
    }
    navigate("/", { replace: true });
  }, [token, navigate]);

  return (
    <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
      Applying share link…
    </div>
  );
}
