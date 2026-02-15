"use client";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="page">
      <h1 className="page-title">Something went wrong</h1>
      <p className="muted">{error.message || "Please try again."}</p>
      <div className="form-actions">
        <button type="button" className="form-primary" onClick={reset}>
          Retry
        </button>
      </div>
    </div>
  );
}
