import { login } from "@/app/actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; missing?: string }> }) {
  const sp = await searchParams;
  return (
    <div style={{ maxWidth: 420, margin: "12vh auto", textAlign: "center" }}>
      <h1 style={{ color: "var(--gold)" }}>Evicting the Suitors</h1>
      <p className="muted serif" style={{ fontStyle: "italic" }}>&ldquo;Unless the LORD builds the house, those who build it labor in vain.&rdquo; (Psalm 127:1)</p>
      {sp.missing ? (
        <div className="flash warn" style={{ marginTop: 24 }}>APP_PASSPHRASE isn&rsquo;t set on the server. Add it in your Vercel project settings and redeploy.</div>
      ) : (
        <form action={login} className="card" style={{ marginTop: 24, textAlign: "left" }}>
          <input type="hidden" name="next" value={sp.next ?? "/"} />
          <label htmlFor="passphrase">Passphrase</label>
          <input id="passphrase" name="passphrase" type="password" autoFocus required autoComplete="current-password" />
          {sp.error && <p style={{ color: "var(--danger)", marginTop: 8 }}>That&rsquo;s not it.</p>}
          <button className="primary" style={{ marginTop: 12, width: "100%" }}>Enter the house</button>
        </form>
      )}
    </div>
  );
}
