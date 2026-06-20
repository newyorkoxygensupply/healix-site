"use client";

/** Last-resort boundary if the root layout itself throws (e.g. the Header's
 *  getMeta() call somehow throws past its own try/catch). Must render a full
 *  <html>/<body> since it replaces the root layout entirely. Deliberately
 *  has zero external dependencies — nothing here should be able to fail. */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
          Healix is temporarily unavailable
        </h1>
        <p style={{ color: "#515154", maxWidth: 420 }}>
          Please try again in a moment, or call us at (888) 585-6510.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            borderRadius: 999,
            background: "#1d4ed8",
            color: "#fff",
            padding: "0.6rem 1.4rem",
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
