export default function Avatar({ nome, size = 38 }) {
  const ini = (nome || "?").trim().split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const hue = [...(nome || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % 340;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `hsl(${hue},32%,92%)`, border: `2px solid hsl(${hue},32%,78%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.32, fontWeight: 700, color: `hsl(${hue},45%,30%)`,
      fontFamily: "'Poppins', sans-serif",
    }}>
      {ini}
    </div>
  );
}
