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

  // Segmented strength rail (Refined): one filled bar per passing rule.
  const score = [checks.letter, checks.number, passwordLength].filter(Boolean).length;
  const railColor = isStrong ? "var(--accent)" : score >= 2 ? "var(--gold)" : "var(--danger)";

  return (
    <div style={{ marginTop: 6 }}>
      {password.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          {[0, 1, 2].map((i) => (
            <i
              key={i}
              style={{
                flex: 1,
                height: 5,
                borderRadius: 999,
                background: i < score ? railColor : "var(--border-2)",
                transition: "background 0.25s var(--ease)",
              }}
            />
          ))}
        </div>
      )}
      {!isStrong && password.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6, fontSize: 11 }}>
          {[
            { key: "letter", label: "A-Z / a-z", ok: checks.letter },
            { key: "number", label: "0-9", ok: checks.number },
            { key: "length", label: "min 8 chars", ok: passwordLength },
          ].map(({ key, label, ok }: any) => (
            <span
              key={key}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                padding: "2px 6px",
                borderRadius: 4,
                background: ok ? "var(--mint-soft)" : "var(--bg-elevated)",
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
            background: isStrong ? "transparent" : "var(--danger-soft)",
            textAlign: "center",
            fontSize: 11,
            fontWeight: isStrong ? 500 : 600,
            color: isStrong ? "var(--accent)" : "var(--danger)",
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
