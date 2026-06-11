import Head from "next/head";
import Link from "next/link";

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>About Us — Pawliz</title>
        <meta
          name="description"
          content="Learn about Pawliz — Bangladesh's veterinary platform connecting pet owners with trusted vets."
          key="description"
        />
        <meta property="og:title" content="About Pawliz" key="og:title" />
        <meta
          property="og:description"
          content="Learn about Pawliz — Bangladesh's veterinary platform connecting pet owners with trusted vets."
          key="og:description"
        />
      </Head>
      <div style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "88px 16px 100px" }}>

          <h1 style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 26, color: "var(--text-primary)", marginBottom: 4 }}>
            About <span style={{ color: "var(--accent)" }}>Pawliz</span>
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 28 }}>
            Bangladesh's dedicated veterinary platform.
          </p>

          <Section title="Our Mission">
            <p>
              Pawliz was built to connect pet owners with trusted veterinary clinics across Bangladesh. Finding a reliable vet nearby shouldn't be a challenge — we make it simple, fast, and accessible for every pet owner in the country.
            </p>
          </Section>

          <Section title="What We Offer">
            <FeatureList
              items={[
                { icon: "🗺️", title: "Vet Map", desc: "Find vet clinics near you with contact info and hours." },
                { icon: "🐶", title: "Pet Profiles", desc: "Create profiles for your pets with shareable QR codes for quick identification." },
                { icon: "🔍", title: "Lost & Found", desc: "Report lost pets or help reunite found animals with their owners." },
                { icon: "🤝", title: "Community", desc: "Connect with fellow pet owners and share experiences." },
              ]}
            />
          </Section>

          <Section title="Who We Are">
            <p>
              Pawliz is an independent platform built by pet lovers, for pet lovers. We care about animal welfare and want every pet in Bangladesh to have access to the care they deserve.
            </p>
          </Section>

          <Section title="Platform Limitations">
            <ul>
              <li>
                <strong>Vet listings:</strong> Clinics with a "Verified" badge have submitted documents reviewed by Pawliz, but we cannot guarantee ongoing clinic quality, accuracy of collected data, or current operating status. Always confirm directly with the clinic before visiting.
              </li>
              <li style={{ marginTop: 8 }}>
                <strong>Lost & Found:</strong> This is a community board. Pawliz does not verify poster identities. Never send money (bKash or otherwise) to someone claiming to have found your pet — this is a common scam. Exercise caution in all interactions.
              </li>
              <li style={{ marginTop: 8 }}>
                <strong>Map data:</strong> Vet locations are based on collected data and may not be fully accurate. Coordinates and clinic details may be outdated.
              </li>
            </ul>
            <p style={{ marginTop: 10 }}>
              Read our <Link href="/privacy" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>Privacy Policy</Link> and <Link href="/terms" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>Terms & Conditions</Link> for full details.
            </p>
          </Section>

          <Section title="Contact Us">
            <p>
              Questions or feedback? Email us at{" "}
              <a href="mailto:pawlizbd@gmail.com" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
                pawlizbd@gmail.com
              </a>
            </p>
          </Section>

          <div style={{ marginTop: 28, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/" style={primaryLinkStyle}>← Home</Link>
            <Link href="/privacy" style={ghostLinkStyle}>Privacy</Link>
            <Link href="/terms" style={ghostLinkStyle}>Terms</Link>
          </div>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }) {
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

function FeatureList({ items }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10, marginTop: 6 }}>
      {items.map(({ icon, title, desc }) => (
        <div key={title} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 18, marginBottom: 6 }}>{icon}</div>
          <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 13, marginBottom: 4 }}>{title}</div>
          <div style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.6 }}>{desc}</div>
        </div>
      ))}
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
