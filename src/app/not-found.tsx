import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card" style={{ maxWidth: 520, margin: "8vh auto", textAlign: "center" }}>
      <h2>Nothing lives here.</h2>
      <Link className="btn" href="/">Back to the Hall</Link>
    </div>
  );
}
