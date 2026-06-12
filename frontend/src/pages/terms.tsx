import Head from "next/head";
import Link from "next/link";

export default function TermsPage() {
  return (
    <>
      <Head>
        <title>Terms & Conditions — Pawliz</title>
        <meta name="description" content="Pawliz Terms and Conditions — rules for using our platform." key="description" />
        <meta property="og:title" content="Terms & Conditions — Pawliz" key="og:title" />
        <meta property="og:description" content="Pawliz Terms and Conditions — rules for using our platform." key="og:description" />
      </Head>
      <div style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "88px 16px 100px" }}>

          <h1 style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 26, color: "var(--text-primary)", marginBottom: 4 }}>
            Terms & Conditions
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 28 }}>
            Effective: June 2026
          </p>

          <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.8, marginBottom: 28 }}>
            By using Pawliz, you agree to these terms. Please read them carefully. If you do not agree, please do not use the platform.
          </p>

          <Section title="1. Who Can Use Pawliz">
            <p>
              You must be at least 13 years old to create an account. By signing up, you confirm that all the information you provide is accurate and truthful.
            </p>
          </Section>

          <Section title="2. Using the Platform Responsibly">
            <ul>
              <li>Do not use Pawliz for anything illegal or harmful.</li>
              <li>Do not post false information about pets, vets, or lost/found reports.</li>
              <li>Do not harass, spam, or misuse other users or vet listings.</li>
              <li>Do not attempt to access areas of the platform you are not authorized to use.</li>
            </ul>
          </Section>

          <Section title="3. Your Account">
            <p>
              You are responsible for keeping your account secure. If you think someone else has access to your account, contact us right away at{" "}
              <a href="mailto:pawlizbd@gmail.com" style={{ color: "var(--accent)", textDecoration: "none" }}>
                pawlizbd@gmail.com
              </a>.
            </p>
          </Section>

          <Section title="4. Vet Listings">
            <p>
              Vet clinic information on Pawliz is for reference only. Clinic data is based on collected information and may be incomplete, inaccurate, or outdated.
            </p>
            <ul style={{ marginTop: 8 }}>
              <li>
                The <strong>"Verified"</strong> badge means the clinic submitted documents that Pawliz manually reviewed for legitimacy at the time of submission. It does not mean Pawliz monitors ongoing operations, inspects clinic quality, or guarantees that the clinic is currently open, properly staffed, or providing safe care.
              </li>
              <li style={{ marginTop: 6 }}>
                Verification is a point-in-time check. Clinics may close, relocate, change ownership, or change staff after verification.
              </li>
              <li style={{ marginTop: 6 }}>
                Submitted documents are retained by Pawliz and may be used by users or authorities for legal or official purposes if needed.
              </li>
              <li style={{ marginTop: 6 }}>
                <strong>Users rely on vet listings entirely at their own risk.</strong> Always contact the clinic directly to confirm availability, qualifications, and current status before visiting or following any advice.
              </li>
            </ul>
            <p style={{ marginTop: 10 }}>
              <strong style={{ color: "var(--text-primary)" }}>Important:</strong> Pawliz does not provide veterinary advice. Never rely on platform content as a substitute for professional veterinary consultation.
            </p>
          </Section>

          <Section title="5. Your Content">
            <p>
              Photos and information you add to your pet profiles remain yours. By uploading, you allow us to display that content within the platform. Please only upload content you own or have permission to share.
            </p>
          </Section>

          <Section title="6. Lost & Found">
            <p>
              The Lost & Found board is a community tool. Pawliz does not verify the identity of users, guarantee outcomes, or take responsibility for interactions that occur through this feature.
            </p>
            <ul style={{ marginTop: 8 }}>
              <li>
                <strong>Do not send money or valuables</strong> to anyone through this platform or as a result of a Lost & Found post. A common scam involves someone falsely claiming to have your pet and requesting bKash payment for "transport" or a "reward." Pawliz will never facilitate, request, or endorse such payments.
              </li>
              <li style={{ marginTop: 6 }}>
                Pawliz is not liable for any financial loss, physical harm, or emotional distress resulting from Lost & Found interactions.
              </li>
              <li style={{ marginTop: 6 }}>
                Users who post fraudulent or misleading reports may be permanently banned and their information may be reported to relevant authorities.
              </li>
            </ul>
          </Section>

          <Section title="7. Vet Chat & Medical Advice">
            <p>
              Any communication facilitated through Pawliz between users and veterinary professionals — including any future chat or messaging features — is strictly informational.
            </p>
            <ul style={{ marginTop: 8 }}>
              <li>Nothing on Pawliz constitutes professional veterinary advice, diagnosis, or treatment.</li>
              <li>Always consult a licensed, in-person veterinarian before making health decisions for your pet.</li>
              <li>Pawliz bears no liability for any pet injury, illness, or death resulting from reliance on platform communications or content.</li>
            </ul>
          </Section>

          <Section title="8. Map Accuracy">
            <p>
              Vet clinic locations, addresses, hours, and contact information displayed on the map are based on collected data and are provided for general guidance only.
            </p>
            <ul style={{ marginTop: 8 }}>
              <li>Pawliz does not guarantee the real-world accuracy of any map listing.</li>
              <li>Map data may be approximate, outdated, or incomplete.</li>
              <li>Always verify clinic details directly before travelling or making any decisions based on map information.</li>
            </ul>
          </Section>

          <Section title="9. Limitation of Liability">
            <p>
              Pawliz is provided as-is. To the fullest extent permitted by law, Pawliz is not liable for:
            </p>
            <ul style={{ marginTop: 8 }}>
              <li>Any harm to your pet arising from acting on vet listing information, map data, or any platform content.</li>
              <li>Any financial loss arising from Lost & Found fraud, scams, or interactions with other users.</li>
              <li>Inaccurate, outdated, or missing information in vet listings or map data.</li>
              <li>The conduct, actions, or omissions of any third party — including registered vets, clinic staff, or other users — on or off the platform.</li>
              <li>Service interruptions, data loss, or technical failures.</li>
            </ul>
          </Section>

          <Section title="10. Changes to These Terms">
            <p>
              We may update these terms from time to time. Continued use of Pawliz after changes means you accept the updated terms. The effective date at the top will always reflect the latest version.
            </p>
          </Section>

          <Section title="11. Contact">
            <p>
              Questions about these terms? Email us at{" "}
              <a href="mailto:pawlizbd@gmail.com" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
                pawlizbd@gmail.com
              </a>
            </p>
          </Section>

          <div style={{ marginTop: 28, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/" style={primaryLinkStyle}>← Home</Link>
            <Link href="/about" style={ghostLinkStyle}>About</Link>
            <Link href="/privacy" style={ghostLinkStyle}>Privacy</Link>
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
