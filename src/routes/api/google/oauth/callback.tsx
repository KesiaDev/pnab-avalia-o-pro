import { createFileRoute, redirect } from "@tanstack/react-router";
import { handleGoogleOAuthCallback } from "@/lib/drive-actions";

interface CallbackSearch {
  code?: string;
  state?: string;
  error?: string;
}

export const Route = createFileRoute("/api/google/oauth/callback")({
  validateSearch: (search: Record<string, unknown>): CallbackSearch => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  beforeLoad: async ({ search }) => {
    try {
      const result = await handleGoogleOAuthCallback({
        data: { code: search.code, state: search.state, error: search.error },
      });

      if (!result.ok) {
        throw redirect({
          to: "/fonte-documental",
          search: { google_error: result.errorCode, google_error_detail: result.detail },
        });
      }
      throw redirect({ to: "/fonte-documental", search: { connected: "1" } });
    } catch (err) {
      if (err instanceof Response) throw err; // redirect() já lançado acima
      const message = err instanceof Error ? err.message : String(err);
      throw redirect({
        to: "/fonte-documental",
        search: { google_error: "unexpected", google_error_detail: message.slice(0, 300) },
      });
    }
  },
  component: () => null,
});
