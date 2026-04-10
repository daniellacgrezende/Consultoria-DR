import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { B } from "../utils/constants";

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = isSignUp ? await signUp(email, password) : await signIn(email, password);
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, #1D3557, #264773)`, fontFamily: "Helvetica Neue, Arial, sans-serif" }}>
      <div style={{ background: "white", borderRadius: 16, padding: "40px 36px", width: "100%", maxWidth: 400, boxShadow: "0 32px 80px rgba(6,24,65,0.3)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8 }}>
            <svg width="36" height="36" viewBox="0 0 60 60" fill="none">
              <path d="M8 8 L8 36 L34 36 Q50 36 50 22 Q50 8 34 8 Z" fill={B.navy} opacity="0.95" />
              <path d="M8 42 L8 54 L28 54 L50 42 Z" fill={B.navy} opacity="0.65" />
            </svg>
            <span style={{ color: B.navy, fontWeight: 900, fontSize: 20, letterSpacing: "0.14em" }}>CONSULTORIA DR</span>
          </div>
          <p style={{ color: B.gray, fontSize: 13, margin: 0 }}>CRM 360 — Gestão de Clientes</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>E-mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="seu@email.com" style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", border: `1px solid ${B.border}`, borderRadius: 8, fontSize: 14, color: B.navy, outline: "none", fontFamily: "inherit" }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8899bb", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Senha</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" minLength={6} style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", border: `1px solid ${B.border}`, borderRadius: 8, fontSize: 14, color: B.navy, outline: "none", fontFamily: "inherit" }} />
          </div>

          {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#dc2626" }}>{error}</div>}

          <button type="submit" disabled={loading} style={{ width: "100%", padding: "12px", background: "#D30000", color: "white", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Aguarde..." : isSignUp ? "CRIAR CONTA" : "ENTRAR"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button onClick={() => { setIsSignUp(!isSignUp); setError(""); }} style={{ background: "none", border: "none", color: "#2563eb", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            {isSignUp ? "Já tenho conta → Entrar" : "Criar nova conta"}
          </button>
        </div>
      </div>
    </div>
  );
}
