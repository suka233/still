import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/ui/button.js";
import { useI18n, useStill } from "../context.js";

/** Loading skeleton and "background service unavailable" banner shared by views. */
export function StatusState({ rows = 3 }: { rows?: number }) {
  const { t } = useI18n();
  const status = useStill((s) => s.status);
  const error = useStill((s) => s.error);
  const refresh = useStill((s) => s.refresh);
  const [retrying, setRetrying] = useState(false);

  if (status === "loading") {
    return (
      <div aria-busy aria-label={t("loading")} className="still:flex still:flex-col still:gap-2">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="still:flex still:items-center still:gap-2.5 still:py-1">
            <div className="still:size-8 still:rounded-md still:bg-muted still:animate-pulse" />
            <div className="still:flex still:flex-1 still:flex-col still:gap-1.5">
              <div className="still:h-3 still:w-2/3 still:rounded still:bg-muted still:animate-pulse" />
              <div className="still:h-2.5 still:w-1/3 still:rounded still:bg-muted still:animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div role="alert" className="still:flex still:flex-col still:gap-2 still:rounded-lg still:border still:border-destructive/30 still:bg-destructive/5 still:p-3 still:text-sm">
        <p>{t("error.kernel")}</p>
        {error && <p className="still:text-xs still:text-muted-foreground still:break-all">{error}</p>}
        <Button
          size="sm"
          variant="outline"
          className="still:self-start"
          disabled={retrying}
          onClick={() => {
            setRetrying(true);
            void refresh().finally(() => setRetrying(false));
          }}
        >
          <RefreshCwIcon className={retrying ? "still:animate-spin" : undefined} />
          {t("retry")}
        </Button>
      </div>
    );
  }

  return null;
}
