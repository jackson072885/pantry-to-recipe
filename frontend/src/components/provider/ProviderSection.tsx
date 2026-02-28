import { useId } from "react";

type ProviderSectionProps = {
  title: string;
  subtitle?: string;
  highlights?: string[];
  children?: React.ReactNode;
};

function ProviderSection({ title, subtitle, highlights = [], children }: ProviderSectionProps) {
  const sectionId = useId();

  return (
    <section
      aria-labelledby={sectionId}
      style={{
        border: "1px solid #dbe4ef",
        borderRadius: 14,
        padding: "0.95rem",
        background: "#ffffff",
        boxShadow: "0 4px 14px rgba(15, 23, 42, 0.05)",
      }}
    >
      <h2
        id={sectionId}
        style={{
          margin: 0,
          fontFamily: '"Space Grotesk", sans-serif',
          fontSize: "1.08rem",
          lineHeight: 1.25,
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p style={{ margin: "0.45rem 0 0", color: "#475569", fontSize: "0.94rem" }}>{subtitle}</p>
      )}
      {highlights.length > 0 && (
        <ul style={{ margin: "0.7rem 0 0", paddingLeft: "1.05rem" }}>
          {highlights.map((point) => (
            <li key={point} style={{ marginTop: "0.35rem", color: "#1e293b" }}>
              {point}
            </li>
          ))}
        </ul>
      )}
      {children ? <div style={{ marginTop: "0.7rem" }}>{children}</div> : null}
    </section>
  );
}

export default ProviderSection;
