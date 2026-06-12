import Head from "next/head";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <>
      <Head>
        <title>Privacy Policy — Pawliz</title>
        <meta name="description" content="Pawliz Privacy Policy — how we collect, use, and protect your data." key="description" />
        <meta property="og:title" content="Privacy Policy — Pawliz" key="og:title" />
        <meta property="og:description" content="Pawliz Privacy Policy — how we collect, use, and protect your data." key="og:description" />
      </Head>
      <div style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "88px 16px 100px" }}>

          <h1 style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 26, color: "var(--text-primary)", marginBottom: 4 }}>
            Privacy Policy
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 28 }}>
            Effective: June 2026
          </p>

          <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.8, marginBottom: 28 }}>
            Pawliz is committed to protecting your privacy. This page explains what information we collect, how we use it, and how we keep it safe.
          </p>

          <Section title="1. Information We Collect">
            <ul>
              <li><strong>Account details:</strong> Your name and phone number when you sign up.</li>
              <li><strong>Pet information:</strong> Names, photos, and details you add to your pet profiles.</li>
              <li><strong>Location:</strong> Only when you ask to find nearby vets. We do not store your location.</li>
              <li><strong>Usage activity:</strong> How you use the app — to help us improve it.</li>
            </ul>
          </Section>

          <Section title="2. How We Use Your Information">
            <ul>
              <li>To help you find vets near you.</li>
              <li>To show your pet profiles and QR codes.</li>
              <li>To send you relevant in-app updates.</li>
              <li>To improve the platform over time.</li>
            </ul>
          </Section>

          <Section title="3. Keeping You Signed In">
            <p>
              We use secure sign-in tokens to keep you logged in. These are stored safely and are not accessible to other websites or third-party services.
            </p>
          </Section>

          <Section title="4. Sharing Your Data">
            <p>
              We do not sell or share your personal information with anyone. Vet clinic details shown on the map are publicly collected information.
            </p>
            <p style={{ marginTop: 8 }}>
              <strong>Please note:</strong> Lost & Found posts you create — including pet photos, descriptions, and any location information you share — are visible to all platform users, including visitors who are not logged in. Only share information you are comfortable making public.
            </p>
          </Section>

          <Section title="5. Your Data, Your Control">
            <ul>
              <li>You can ask to see what data we hold about you.</li>
              <li>You can ask us to correct or delete your information.</li>
              <li>You can turn off location access anytime in your browser settings.</li>
            </ul>
          </Section>

          <Section title="6. Contact">
            <p>
              Privacy questions? Email us at{" "}
              <a href="mailto:pawlizbd@gmail.com" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
                pawlizbd@gmail.com
              </a>
            </p>
          </Section>

          <Section title="7. Lost & Found Safety">
            <p>
              The Lost & Found board is a community tool. Pawliz does not verify the identity of users who post or respond to lost/found reports.
            </p>
            <ul style={{ marginTop: 8 }}>
              <li><strong>Never send money</strong> (via bKash or any other method) to someone claiming to have found your pet. A common scam is requesting payment for "transport" or a "reward" before returning the animal — Pawliz will never facilitate or endorse such requests.</li>
              <li>Meet in a safe, public place if reuniting a pet in person. Bring someone with you if possible.</li>
              <li>Pawliz bears no responsibility for fraud, financial loss, physical harm, or emotional distress arising from Lost & Found interactions.</li>
              <li>Report suspicious posts to <a href="mailto:pawlizbd@gmail.com" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>pawlizbd@gmail.com</a>.</li>
            </ul>
          </Section>

          <Section title="8. Map & Location Data">
            <p>
              Vet clinic locations shown on the map are based on collected data and are provided for general reference only.
            </p>
            <ul style={{ marginTop: 8 }}>
              <li>Map coordinates and clinic details may not be exact or up to date.</li>
              <li>Collected data may be outdated; clinic addresses, hours, and contact information can change.</li>
              <li>Always confirm clinic address, hours, and availability directly with the clinic before visiting.</li>
            </ul>
          </Section>

          <div style={{ marginTop: 28, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/" style={primaryLinkStyle}>← Home</Link>
            <Link href="/about" style={ghostLinkStyle}>About</Link>
            <Link href="/terms" style={ghostLinkStyle}>Terms</Link>
          </div>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: any) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 15, color: "var(--accent)", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>
        {title}
      </h2>
      <div style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.8 }}>
        {children}
      </div>
    </div>
  );
}

const primaryLinkStyle = {
  display: "inline-flex", alignItems: "center",
  background: "var(--accent)", color: "#0a0a0a",
  fontWeight: 700, padding: "8px 16px", borderRadius: 8,
  textDecoration: "none", fontSize: 13,
};

const ghostLinkStyle = {
  display: "inline-flex", alignItems: "center",
  background: "var(--bg-card)", border: "1px solid var(--border)",
  color: "var(--text-secondary)", fontWeight: 600,
  padding: "8px 14px", borderRadius: 8,
  textDecoration: "none", fontSize: 13,
};
