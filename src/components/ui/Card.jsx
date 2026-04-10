import { B } from "../../utils/constants";

export default function Card({ children, style }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.78)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
      border: `1px solid ${B.border}`, borderRadius: 14, padding: "18px 20px",
      boxShadow: B.shadow, transition: "box-shadow 0.2s ease, transform 0.2s ease",
      ...style,
    }}>
      {children}
    </div>
  );
}
