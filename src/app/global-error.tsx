"use client";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <html>
      <body>
        <div style={{ padding: 24, fontFamily: "sans-serif" }}>
          <h1>Application error</h1>
          <p>{error.message || "An unexpected error occurred."}</p>
        </div>
      </body>
    </html>
  );
}

