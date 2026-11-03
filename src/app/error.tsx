"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const noDb = error.message?.includes("DATABASE_URL") || error.message?.includes("does not exist");
  return (
    <div className="card" style={{ maxWidth: 640, margin: "8vh auto" }}>
      <h2>{noDb ? "The house has no foundation yet" : "Something went wrong"}</h2>
      {noDb ? (
        <>
          <p className="muted">The app needs a Neon Postgres database. Set <code>DATABASE_URL</code>, then run:</p>
          <pre style={{ background: "var(--soft)", padding: 12, borderRadius: 8 }}>npm run db:seed</pre>
        </>
      ) : (
        <p className="muted">{error.message || "Unknown error"}</p>
      )}
      <button onClick={reset}>Try again</button>
    </div>
  );
}
