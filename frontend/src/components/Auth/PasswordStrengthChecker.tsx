import { useMemo } from "react";

export default function PasswordStrengthChecker({ password = "", t, namespace = "register" }: any) {
  const checks = useMemo(
    () => ({
      letter: /[A-Za-z]/.test(password),
      number: /\d/.test(password),
    }),
    [password]
  );

  const allValid = Object.values(checks).every(Boolean);
  const passwordLength = password.length >= 8;
  const isStrong = allValid && passwordLength;

  const checksKey = namespace === "profile" ? "profile:passwordStrength.checks" : namespace === "vet" ? "register.passwordChecks" : "register.passwordChecks";
  const strongKey = namespace === "profile" ? "profile:passwordStrength.strong" : namespace === "vet" ? "register.strongPassword" : "register.strongPassword";
  const weakKey = namespace === "profile" ? "profile:passwordStrength.weak" : namespace === "vet" ? "register.weakPassword" : "register.weakPassword";

  return (
    <div style={{ marginTop: 6 }}>
      {!isStrong && password.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6, fontSize: 11 }}>
          {[
            { key: "letter", label: "A-Z / a-z", ok: checks.letter },
            { key: "number", label: "0-9", ok: checks.number },
            { key: "length", label: "min 8 chars", ok: passwordLength },
          ].map(({ key, label, ok }) => (
            <span
              key={key}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                padding: "2px 6px",
                borderRadius: 4,
                background: ok ? "rgba(0, 229, 160, 0.15)" : "rgba(107, 114, 128, 0.1)",
                color: ok ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: ok ? 600 : 500,
              }}
            >
              <span>{ok ? "✓" : "○"}</span>
              <span>{label}</span>
            </span>
          ))}
        </div>
      )}
      {password.length > 0 && (
        <div
          style={{
            padding: isStrong ? "4px 0" : "4px 6px",
            borderRadius: 4,
            background: isStrong ? "transparent" : "rgba(239, 68, 68, 0.1)",
            textAlign: "center",
            fontSize: 11,
            fontWeight: isStrong ? 500 : 600,
            color: isStrong ? "var(--accent)" : "#ef4444",
          }}
        >
          {isStrong ? (
            <span>✓ {t(strongKey) || "Strong"}</span>
          ) : (
            <span>✗ {t(weakKey) || "Weak"}</span>
          )}
        </div>
      )}
    </div>
  );
}
