import { B } from "../../utils/constants";

export default function Card({ children, style }) {
  return (
    <div style={{ background: "white", border: `1px solid ${B.border}`, borderRadius: 12, padding: "18px 20px", ...style }}>
      {children}
    </div>
  );
}
