import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { petsAPI, getImageUrl } from "../../lib/api";
import ContactFormModal from "../../components/ContactFormModal";

export default function PublicPetProfile({ initialPet = null }: any) {
  const router = useRouter();
  const { petId } = router.query;
  // Seed from SSR so OG/first paint match; client useEffect still refetches as source of truth.
  const [pet, setPet] = useState(initialPet);
  const [loading, setLoading] = useState(!initialPet);
  const [notFound, setNotFound] = useState(false);
  const [petImages, setPetImages] = useState(() => {
    const imgs = initialPet?.images;
    if (!imgs) return [];
    const arr = Array.isArray(imgs)
      ? imgs
      : (() => { try { return JSON.parse(imgs); } catch { return []; } })();
    return Array.isArray(arr) ? arr : [];
  });
  const [isDesktop, setIsDesktop] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!petId) return;
    petsAPI
      .getPublic(petId as string)
      .then((res: any) => {
        setPet(res.pet);
        if (res.pet.images) {
          const images = Array.isArray(res.pet.images)
            ? res.pet.images
            : (() => { try { return JSON.parse(res.pet.images); } catch { return []; } })();
          setPetImages(Array.isArray(images) ? images : []);
        }
      })
      // Only flag not-found if SSR didn't already provide a valid pet — a transient
      // client refetch failure must not hide a pet the server already resolved.
      .catch(() => setPet((prev: any) => { if (!prev) setNotFound(true); return prev; }))
      .finally(() => setLoading(false));
  }, [petId]);

  const typeEmoji = pet?.type === "cat" ? "🐱" : "🐕";
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // First pet image as an absolute URL for OG/Twitter cards (null when none).
  const ogImageRaw = (() => {
    const imgs = pet?.images;
    if (!imgs) return null;
    const arr = Array.isArray(imgs)
      ? imgs
      : (() => { try { return JSON.parse(imgs); } catch { return []; } })();
    return Array.isArray(arr) && arr[0] ? arr[0] : null;
  })();
  const ogImage = ogImageRaw ? getImageUrl(ogImageRaw) : null;

  function formatAge(age: any) {
    // age is free-text (VARCHAR), e.g. "2 year 3 month" — render as-is.
    if (age === null || age === undefined) return null;
    const str = String(age).trim();
    return str || null;
  }


  function nextImage() {
    if (petImages.length > 1) {
      setCurrentImageIndex((prev: any) => (prev + 1) % petImages.length);
    }
  }

  function prevImage() {
    if (petImages.length > 1) {
      setCurrentImageIndex((prev: any) =>
        prev === 0 ? petImages.length - 1 : prev - 1,
      );
    }
  }

  return (
    <>
      <Head>
        <title>
          {pet ? `${pet.name} — Pawliz` : "Pet Profile — Pawliz"}
        </title>
        {pet && (
          <>
            <meta
              name="description"
              content={`${pet.name}${pet.is_lost ? " is LOST" : ""} — view this pet's profile on Pawliz.`}
              key="description"
            />
            <meta property="og:title" content={`${pet.name} — Pawliz`} key="og:title" />
            <meta
              property="og:description"
              content={pet.is_lost ? `🔴 ${pet.name} is LOST. Please help reunite this pet with its owner.` : `${pet.name}'s pet profile on Pawliz.`}
              key="og:description"
            />
            {ogImage && <meta property="og:image" content={ogImage} key="og:image" />}
            {ogImage && <meta name="twitter:image" content={ogImage} key="twitter:image" />}
          </>
        )}
      </Head>
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg-primary)",
          display: "flex",
          // Top-align so a tall card scrolls instead of clipping under the fixed
          // header / bottom nav; center horizontally only.
          alignItems: "flex-start",
          justifyContent: "center",
          paddingLeft: 16,
          paddingRight: 16,
          // Offset the fixed Navbar (top) and BottomNavBar (~80px, bottom).
          paddingTop: "calc(var(--header-height) + 16px)",
          paddingBottom: "calc(80px + env(safe-area-inset-bottom) + 16px)",
        }}
      >
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🐾</div>
            <div>Loading pet profile...</div>
          </div>
        ) : notFound ? (
          <div
            style={{
              textAlign: "center",
              color: "var(--text-muted)",
              maxWidth: 360,
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>😔</div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: 8,
              }}
            >
              Pet Not Found
            </div>
            <div style={{ fontSize: 14 }}>
              This QR code may be invalid or the pet may have been removed.
            </div>
          </div>
        ) : (
          pet && (
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 20,
                padding: isDesktop ? 40 : 32,
                maxWidth: isDesktop ? 1280 : 420,
                width: "100%",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              {/* Brand */}
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    fontWeight: 600,
                  }}
                >
                  🐾 Pawliz
                </div>
              </div>

              {/* Lost alert */}
              {pet.is_lost && (
                <div
                  style={{
                    background: "var(--danger)",
                    color: "#fff",
                    borderRadius: 12,
                    padding: "12px 16px",
                    textAlign: "center",
                    fontWeight: 700,
                    fontSize: 15,
                    marginBottom: 20,
                    animation: "pulse 1.5s ease-in-out infinite",
                  }}
                >
                  🔴 THIS PET IS LOST — Please contact the owner!
                </div>
              )}

              <div
                style={{
                  display: isDesktop ? "grid" : "block",
                  gridTemplateColumns: isDesktop ? "320px 1fr" : "1fr",
                  gap: isDesktop ? 32 : 0,
                  alignItems: "start",
                }}
              >
              {/* Pet image or avatar */}
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                {petImages.length > 0 ? (
                  <div
                    style={{
                      width: "100%",
                      maxWidth: isDesktop ? 280 : 200,
                      margin: "0 auto 12px",
                      borderRadius: 16,
                      overflow: "hidden",
                      border: "3px solid var(--border-accent)",
                      background: "var(--bg-elevated)",
                      aspectRatio: "1",
                      position: "relative",
                      display: "inline-block",
                    }}
                  >
                    <img
                      key={currentImageIndex}
                      src={getImageUrl(petImages[currentImageIndex]) ?? undefined}
                      alt={`${pet.name} - image ${currentImageIndex + 1}`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                      onError={(e: any) => {
                        console.error(
                          "Failed to load image:",
                          getImageUrl(petImages[currentImageIndex]),
                        );
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: "50%",
                      background:
                        "linear-gradient(135deg, var(--accent), #00b87a)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 38,
                      border: "3px solid var(--border-accent)",
                    }}
                  >
                    {typeEmoji}
                  </div>
                )}

                {/* Image navigation */}
                {petImages.length > 1 && (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      justifyContent: "center",
                      marginTop: 12,
                      alignItems: "center",
                    }}
                  >
                    <button
                      onClick={prevImage}
                      style={{
                        background: "var(--accent)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 50,
                        width: 32,
                        height: 32,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      ←
                    </button>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                        minWidth: 50,
                        textAlign: "center",
                      }}
                    >
                      {currentImageIndex + 1} / {petImages.length}
                    </div>
                    <button
                      onClick={nextImage}
                      style={{
                        background: "var(--accent)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 50,
                        width: 32,
                        height: 32,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      →
                    </button>
                  </div>
                )}
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 26,
                    fontWeight: 800,
                    color: "var(--text-primary)",
                  }}
                >
                  {pet.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--accent)",
                    fontFamily: "monospace",
                    fontWeight: 600,
                    marginTop: 4,
                  }}
                >
                  {pet.pet_id}
                </div>
              </div>

              <div>
              {/* Pet details */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                }}
              >
                {[
                  {
                    label: "Type",
                    value: pet.type
                      ? pet.type.charAt(0).toUpperCase() + pet.type.slice(1)
                      : null,
                  },
                  { label: "Breed", value: pet.breed },
                  {
                    label: "Gender",
                    value: pet.gender
                      ? pet.gender.charAt(0).toUpperCase() + pet.gender.slice(1)
                      : null,
                  },
                  { label: "Age", value: formatAge(pet.age) },
                  { label: "Color", value: pet.color },
                  {
                    label: "Weight",
                    value: pet.weight ? `${pet.weight} kg` : null,
                  },
                ].map(({ label, value }: any) =>
                  value ? (
                    <div
                      key={label}
                      style={{
                        background: "var(--bg-elevated)",
                        borderRadius: 10,
                        padding: "10px 14px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.4px",
                        }}
                      >
                        {label}
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          color: "var(--text-primary)",
                          fontWeight: 600,
                          marginTop: 3,
                        }}
                      >
                        {value}
                      </div>
                    </div>
                  ) : null,
                )}
              </div>

              {/* Medical summary */}
              {(pet.vaccination_status ||
                pet.medical_conditions ||
                pet.allergies) && (
                <div
                  style={{
                    marginTop: 16,
                    background: "var(--bg-elevated)",
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      color: "var(--text-primary)",
                      marginBottom: 10,
                    }}
                  >
                    🏥 Medical Summary
                  </div>
                  {pet.vaccination_status && (
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--text-secondary)",
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>Vaccination: </span>
                      {pet.vaccination_status}
                      {pet.next_vaccination_due && (
                        <span>
                          {" "}
                          (next due{" "}
                          {new Date(pet.next_vaccination_due).toLocaleDateString()})
                        </span>
                      )}
                    </div>
                  )}
                  {pet.medical_conditions && (
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--text-secondary)",
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>Conditions: </span>
                      {pet.medical_conditions}
                    </div>
                  )}
                  {pet.allergies && (
                    <div
                      style={{ fontSize: 13, color: "var(--text-secondary)" }}
                    >
                      <span style={{ fontWeight: 600 }}>Allergies: </span>
                      {pet.allergies}
                    </div>
                  )}
                </div>
              )}

              {/* Behavior summary */}
              {(() => {
                const hasBool = (v: any) => v === true || v === false;
                const bool2str = (v: any) =>
                  v === true ? "Yes ✅" : v === false ? "No ❌" : null;
                const rows = [
                  {
                    label: "Temperament",
                    value: pet.temperament
                      ? pet.temperament.charAt(0).toUpperCase() +
                        pet.temperament.slice(1)
                      : null,
                  },
                  { label: "Potty Trained", value: bool2str(pet.potty_trained) },
                  { label: "Knows Commands", value: bool2str(pet.knows_commands) },
                  {
                    label: "Good with Strangers",
                    value: bool2str(pet.good_with_strangers),
                  },
                  { label: "Good with Kids", value: bool2str(pet.good_with_kids) },
                  {
                    label: "Good with Other Pets",
                    value: bool2str(pet.good_with_pets),
                  },
                ].filter((r: any) => r.value);
                const show =
                  pet.temperament ||
                  pet.special_notes ||
                  hasBool(pet.potty_trained) ||
                  hasBool(pet.knows_commands) ||
                  hasBool(pet.good_with_strangers) ||
                  hasBool(pet.good_with_kids) ||
                  hasBool(pet.good_with_pets);
                if (!show) return null;
                return (
                  <div
                    style={{
                      marginTop: 16,
                      background: "var(--bg-elevated)",
                      borderRadius: 12,
                      padding: 16,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        color: "var(--text-primary)",
                        marginBottom: 10,
                      }}
                    >
                      🐾 Behavior
                    </div>
                    {rows.map(({ label, value }: any) => (
                      <div
                        key={label}
                        style={{
                          fontSize: 13,
                          color: "var(--text-secondary)",
                          marginBottom: 6,
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{label}: </span>
                        {value}
                      </div>
                    ))}
                    {pet.special_notes && (
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--text-secondary)",
                          marginTop: rows.length ? 4 : 0,
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>Special Notes: </span>
                        {pet.special_notes}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Food & diet */}
              {(pet.food_types ||
                pet.meals_per_day ||
                pet.dietary_restrictions ||
                pet.appetite_notes) && (
                <div
                  style={{
                    marginTop: 16,
                    background: "var(--bg-elevated)",
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      color: "var(--text-primary)",
                      marginBottom: 10,
                    }}
                  >
                    🍽️ Food & Diet
                  </div>
                  {[
                    { label: "Food Types", value: pet.food_types },
                    { label: "Meals / Day", value: pet.meals_per_day },
                    { label: "Dietary Restrictions", value: pet.dietary_restrictions },
                    { label: "Appetite Notes", value: pet.appetite_notes },
                  ].map(({ label, value }: any) =>
                    value ? (
                      <div
                        key={label}
                        style={{
                          fontSize: 13,
                          color: "var(--text-secondary)",
                          marginBottom: 6,
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{label}: </span>
                        {value}
                      </div>
                    ) : null,
                  )}
                </div>
              )}

              {/* Owner contact */}
              <div
                style={{
                  marginTop: 20,
                  background: "rgba(0,230,118,0.08)",
                  border: "1px solid rgba(0,230,118,0.25)",
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    color: "var(--accent)",
                    marginBottom: 8,
                  }}
                >
                  👤 Owner
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      color: "var(--text-primary)",
                      fontWeight: 600,
                    }}
                  >
                    {pet.owner_name}
                  </div>
                  <button
                    onClick={() => setContactOpen(true)}
                    style={{
                      background: "var(--accent)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      padding: "8px 16px",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    📞 Contact Now
                  </button>
                </div>
              </div>
              </div>
              </div>

              <div
                style={{
                  textAlign: "center",
                  marginTop: 20,
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                Powered by Pawliz 🐾
              </div>
            </div>
          )
        )}
      </div>

      {pet && (
        <ContactFormModal
          open={contactOpen}
          onClose={() => setContactOpen(false)}
          postId={pet.id}
          postType="pet"
          ownerName={pet.owner_name}
        />
      )}
    </>
  );
}

// Server-side fetch of the PUBLIC pet so crawlers get real OG tags (the page
// otherwise loads the pet client-side and ships empty OG). Fail-safe: any error
// (incl. Render free-tier cold start) returns { pet: null } and the client
// useEffect still fetches — identical to the previous behavior, no hard error.
export async function getServerSideProps({ params }: any) {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
  try {
    const r = await fetch(`${base}/v1/pets/public/${encodeURIComponent(params.petId)}`);
    if (!r.ok) return { props: { initialPet: null } };
    const data = await r.json();
    return { props: { initialPet: data.pet || null } };
  } catch {
    return { props: { initialPet: null } };
  }
}
