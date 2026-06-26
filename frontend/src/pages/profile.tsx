import { useState, useEffect, useCallback, useRef } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useNavbar } from "../context/NavbarContext";
import { profileAPI, getImageUrl } from "../lib/api";
import PetCard, { AddPetCard } from "../components/Profile/PetCard";
import ProfileCommunityPosts from "../components/Community/ProfileCommunityPosts";
import { BADGE_CONFIG } from "../components/Profile/ProfileCompletion";
import PasswordStrengthChecker from "../components/Auth/PasswordStrengthChecker";
import { useTranslation } from "react-i18next";


export default function ProfilePage() {
  const { user, loading: authLoading, updateUser, logout } = useAuth();
  const { toast } = useToast();
  const { theme } = useNavbar();
  const router = useRouter();
  const { t } = useTranslation(["profile", "common"]);

  const [isDesktop, setIsDesktop] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [pets, setPets] = useState<any[]>([]);
  const [completion, setCompletion] = useState({
    percentage: 0,
    badge: "bronze",
  });
  const [loadingProfile, setLoadingProfile] = useState(true);

  // User form — always visible & editable (no edit-toggle)
  const [userForm, setUserForm] = useState<any>({});
  const [savingUser, setSavingUser] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<any>(null); // null | 'saving' | 'saved'
  const autoSaveTimer = useRef<any>(null);

  // Password form
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [pwForm, setPwForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [savingPw, setSavingPw] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Profile picture upload
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const profilePictureInputRef = useRef<any>(null);

  // Add-pet inline form (triggered by small header button)
  const [showAddPet, setShowAddPet] = useState(false);

  // Scroll target for the completion "Complete profile" CTA
  const accountRef = useRef<any>(null);

  // Desktop detection
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [authLoading, user, router]);

  // Load profile
  const loadProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const [profileRes, completionRes] = await Promise.all([
        profileAPI.get(),
        profileAPI.completion(),
      ]);
      const u = profileRes.user;
      setProfile(u);
      setPets(profileRes.pets || []);
      setCompletion(completionRes);
      // Hydrate the always-visible account form from the loaded profile.
      setUserForm({
        name: u?.name || "",
        email: u?.email || "",
        dob: u?.dob ? u.dob.split("T")[0] : "",
        address: u?.address || "",
        occupation: u?.occupation || "",
      });
    } catch (err: any) {
      toast("Failed to load profile", "error");
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) loadProfile();
  }, [authLoading, user?.id, loadProfile]);

  // Refresh completion after changes
  const refreshCompletion = useCallback(async () => {
    try {
      const res = await profileAPI.completion();
      setCompletion(res);
    } catch {}
  }, []);

  // Auto-save user profile (debounced)
  const handleUserFormChange = (k: any, v: any) => {
    setUserForm((f: any) => ({ ...f, [k]: v }));
    setAutoSaveStatus("saving");
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try {
        const res = await profileAPI.update({ ...userForm, [k]: v });
        setProfile(res.user);
        updateUser(res.user);
        setAutoSaveStatus("saved");
        refreshCompletion();
        setTimeout(() => setAutoSaveStatus(null), 2500);
      } catch {
        setAutoSaveStatus(null);
      }
    }, 1800);
  };

  // Save user profile manually
  const handleSaveUser = async () => {
    if (!userForm.name?.trim()) {
      toast("Name is required", "error");
      return;
    }
    clearTimeout(autoSaveTimer.current);
    setSavingUser(true);
    try {
      const res = await profileAPI.update(userForm);
      setProfile(res.user);
      updateUser(res.user);
      setAutoSaveStatus(null);
      toast("Profile updated successfully!", "success");
      refreshCompletion();
    } catch (err: any) {
      toast(err.message || "Failed to update profile", "error");
    } finally {
      setSavingUser(false);
    }
  };

  // Save password
  const handleSavePassword = async (e: any) => {
    e.preventDefault();
    if (!pwForm.current_password || !pwForm.new_password) {
      toast("All password fields are required", "error");
      return;
    }
    if (pwForm.new_password !== pwForm.confirm_password) {
      toast("New passwords do not match", "error");
      return;
    }
    const hasLetter = /[A-Za-z]/.test(pwForm.new_password);
    const hasNum = /\d/.test(pwForm.new_password);
    if (!hasLetter || !hasNum || pwForm.new_password.length < 8) {
      toast("Password must be at least 8 characters with letters and numbers", "error");
      return;
    }
    setSavingPw(true);
    try {
      await profileAPI.updatePassword({
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      toast("Password updated successfully!", "success");
      setShowPasswordForm(false);
      setPwForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
    } catch (err: any) {
      toast(err.message || "Failed to update password", "error");
    } finally {
      setSavingPw(false);
    }
  };

  const handlePetCreated = (pet: any) => {
    setPets((prev: any) => [...prev, pet]);
    refreshCompletion();
  };

  const handlePetDeleted = (petId: any) => {
    setPets((prev: any) => prev.filter((p: any) => p.id !== petId));
    refreshCompletion();
  };

  const handlePetUpdated = (updatedPet: any) => {
    setPets((prev: any) =>
      prev.map((p: any) => (p.id === updatedPet.id ? updatedPet : p)),
    );
    refreshCompletion();
  };

  const handleUploadProfilePicture = async (file: any) => {
    if (!file) return;
    setUploadingPicture(true);
    try {
      const res = await profileAPI.uploadPicture(file);
      setProfile((p: any) => ({ ...p, profile_picture: res.user.profile_picture }));
      updateUser(res.user);
      toast("Profile picture updated!", "success");
      refreshCompletion();
    } catch (err: any) {
      toast(err.message || "Failed to upload picture", "error");
    } finally {
      setUploadingPicture(false);
    }
  };

  if (authLoading || loadingProfile) {
    // Render the spinner inside the SAME page shell the loaded state uses, so the
    // top-level container doesn't resize/shift when data resolves (CLS fix).
    return (
      <div
        style={{
          minHeight: "100vh",
          paddingTop: "calc(var(--header-height) + 20px)",
          paddingBottom: 80,
        }}
      >
        <div
          style={{
            maxWidth: isDesktop ? 1200 : 860,
            margin: "0 auto",
            padding: isDesktop ? "0 32px" : "0 16px",
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>🐾</div>
          <div>{t("profile:loadingProfile")}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>My Profile — Pawliz</title>
      </Head>

      <div
        className="pf-page"
        style={{
          minHeight: "100vh",
          paddingTop: "calc(var(--header-height) + 20px)",
          paddingBottom: 80,
        }}
      >
        <div className="pf-shell">

          {/* Compact header — avatar + name/contact + completion in one glass card */}
          <div className="glass profile-head reveal" style={{ marginBottom: 22 }}>
            <div
              className="pf-avatar"
              onClick={() => profilePictureInputRef.current?.click()}
              style={{
                width: 72,
                height: 72,
                borderRadius: "42% 58% 56% 44% / 50% 44% 56% 50%",
                backgroundImage: profile?.profile_picture
                  ? `url('${getImageUrl(profile.profile_picture)}')`
                  : "var(--grad-cool)",
                backgroundSize: "cover",
                backgroundPosition: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                fontWeight: 800,
                fontFamily: "var(--font-head)",
                color: "var(--on-accent)",
                flexShrink: 0,
                cursor: "pointer",
                transition: "all 0.2s",
                position: "relative",
                boxShadow: "var(--shadow-glow)",
              }}
              onMouseEnter={(e: any) => {
                e.currentTarget.style.opacity = "0.8";
              }}
              onMouseLeave={(e: any) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              {!profile?.profile_picture &&
                profile?.name?.charAt(0).toUpperCase()}
              {uploadingPicture && (
                <div
                  style={{
                    position: "absolute",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    height: "100%",
                    background: "rgba(0,0,0,0.5)",
                    borderRadius: "50%",
                    color: "#fff",
                    fontSize: 12,
                  }}
                >
                  ⏳
                </div>
              )}
            </div>
            <input
              ref={profilePictureInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e: any) => {
                if (e.target.files?.[0]) {
                  handleUploadProfilePicture(e.target.files[0]);
                }
              }}
              disabled={uploadingPicture}
            />
            <div className="info" style={{ minWidth: 0, flex: 1 }}>
              <h1 style={{ margin: 0, wordBreak: "break-word" }}>{profile?.name}</h1>
              <p className="muted" style={{
                marginTop: 4,
                fontSize: 13,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "4px 10px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                {profile?.phone && <span>{profile.phone}</span>}
                {profile?.phone && profile?.email && <span style={{ color: "var(--text-muted)" }}>·</span>}
                {profile?.email && <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{profile.email}</span>}
              </p>
            </div>
            {(() => {
              const pct = completion.percentage;
              const cfg = (BADGE_CONFIG as any)[completion.badge] || BADGE_CONFIG.bronze;
              const tier =
                pct >= 100 ? cfg.color : pct >= 50 ? BADGE_CONFIG.gold.color : BADGE_CONFIG.bronze.color;
              const nextBadge = pct >= 100 ? null : pct >= 50 ? "Diamond" : "Gold";
              const nextAt = pct >= 50 ? 100 : 50;
              const toNext = Math.max(0, nextAt - pct);
              return (
                <div
                  className="completion"
                  style={{
                    minWidth: 248,
                    flex: "none",
                    background: `linear-gradient(135deg, ${tier}22, var(--glass-hi))`,
                    border: `1px solid ${tier}55`,
                    boxShadow: `0 0 24px -8px ${tier}66`,
                  }}
                >
                  <span
                    className="badge-ring animate-ring"
                    style={{
                      width: 68,
                      height: 68,
                      ["--pf-ring" as any]: `${pct}%`,
                      background: `conic-gradient(${tier} var(--pf-ring), var(--border) 0)`,
                      boxShadow: `0 0 18px -4px ${tier}aa`,
                    }}
                  >
                    <i style={{ width: 54, height: 54, fontSize: 17, color: tier }}>{pct}%</i>
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 18, lineHeight: 1 }}>{cfg.emoji}</span>
                      <b style={{ color: tier, fontSize: 15 }}>
                        {cfg.label} {t("profile:badgeProfile", { defaultValue: "profile" })}
                      </b>
                    </div>
                    <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.4 }}>
                      {pct >= 100
                        ? `🎉 ${t("profile:completeMsg", { defaultValue: "Profile complete — you're a star!" })}`
                        : t("profile:nextBadgeHint", {
                            defaultValue: `${toNext}% more to unlock ${nextBadge}`,
                            count: toNext,
                            badge: nextBadge,
                          })}
                    </p>
                    {pct < 100 && (
                      <button
                        onClick={() => accountRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                        className="keep-latin"
                        style={{
                          marginTop: 6,
                          padding: 0,
                          background: "none",
                          border: "none",
                          color: tier,
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {t("profile:completeCta", { defaultValue: "Complete profile" })}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Two-column body: left = pets + community · right = account (always editable) */}
          <div className="detail reveal" style={{ animationDelay: "0.1s" }}>
            {/* LEFT — pets */}
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  marginBottom: 16,
                  flexWrap: "wrap",
                }}
              >
                <h2 className="section-title" style={{ minWidth: 0 }}>
                  {t("profile:myPets")} ({pets.length})
                </h2>
                {!showAddPet && (
                  <button className="btn btn-primary btn-sm" onClick={() => setShowAddPet(true)} style={{ flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                    {t("profile:addPet", { defaultValue: "Add a pet" })}
                  </button>
                )}
              </div>

              <div className="pf-pets-wrap reveal-stagger" style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
                {showAddPet && (
                  <AddPetCard
                    hideTrigger
                    onCreated={handlePetCreated}
                    onClose={() => setShowAddPet(false)}
                  />
                )}
                {pets.map((pet: any) => (
                  <PetCard
                    key={pet.id}
                    pet={pet}
                    onDeleted={handlePetDeleted}
                    onUpdated={handlePetUpdated}
                  />
                ))}
              </div>

            </div>

            {/* RIGHT — account: personal info (always editable) + password */}
            <div ref={accountRef} style={{ scrollMarginTop: "calc(var(--header-height) + 16px)", minWidth: 0 }}>
              <div
                className="glass pf-lift"
                style={{
                  borderRadius: "var(--radius-lg)",
                  padding: 24,
                  marginBottom: 28,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 16,
                      color: "var(--text-primary)",
                    }}
                  >
                    👤 {t("profile:edit")}
                  </div>
                  {autoSaveStatus && (
                  <div
                    style={{
                      fontSize: 12,
                      color:
                        autoSaveStatus === "saved"
                          ? "var(--accent)"
                          : "var(--text-muted)",
                    }}
                  >
                    {autoSaveStatus === "saving"
                      ? t("common:status.autoSaving")
                      : t("common:status.autoSaved")}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 16,
                }}
              >
                <div>
                  <label style={labelStyle}>{t("profile:fields.nameRequired")}</label>
                  <input
                    className="input-field"
                    value={userForm.name}
                    onChange={(e: any) =>
                      handleUserFormChange("name", e.target.value)
                    }
                    placeholder={t("profile:placeholders.name")}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>{t("profile:fields.phone")}</label>
                  <input
                    className="input-field"
                    value={profile?.phone || ""}
                    readOnly
                    style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", cursor: "not-allowed" }}
                  />
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    {t("profile:phoneReadOnly")}
                  </p>
                </div>
                <div>
                  <label style={labelStyle}>{t("profile:fields.email")}</label>
                  <input
                    type="email"
                    className="input-field"
                    value={userForm.email}
                    onChange={(e: any) =>
                      handleUserFormChange("email", e.target.value)
                    }
                    placeholder={t("profile:placeholders.email")}
                  />
                </div>
                <div>
                  <label style={labelStyle}>{t("profile:fields.dob")}</label>
                  <input
                    type="date"
                    className="input-field"
                    value={userForm.dob}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={(e: any) =>
                      handleUserFormChange("dob", e.target.value)
                    }
                  />
                </div>
                <div>
                  <label style={labelStyle}>{t("profile:fields.occupation")}</label>
                  <input
                    className="input-field"
                    value={userForm.occupation}
                    onChange={(e: any) =>
                      handleUserFormChange("occupation", e.target.value)
                    }
                    placeholder={t("profile:placeholders.occupation")}
                  />
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={labelStyle}>{t("profile:fields.address")}</label>
                  <textarea
                    className="input-field"
                    rows={2}
                    value={userForm.address}
                    onChange={(e: any) =>
                      handleUserFormChange("address", e.target.value)
                    }
                    placeholder={t("profile:placeholders.address")}
                    style={{ resize: "vertical" }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: 20,
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={() => setShowPasswordForm((v: any) => !v)}
                  style={{
                    ...cancelBtnStyle,
                    borderColor: "var(--border-accent)",
                    color: "var(--accent)",
                  }}
                >
                  {t("profile:changePassword")}
                </button>
                <button
                  onClick={handleSaveUser}
                  disabled={savingUser}
                  style={saveBtnStyle(savingUser)}
                >
                  {savingUser ? t("common:buttons.saving") : t("common:buttons.saveChanges")}
                </button>
              </div>

              {/* Password sub-form */}
              {showPasswordForm && (
                <form
                  onSubmit={handleSavePassword}
                  style={{
                    marginTop: 20,
                    paddingTop: 20,
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: "var(--text-primary)",
                      marginBottom: 14,
                    }}
                  >
                    {t("profile:password.title")}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(220px, 1fr))",
                      gap: 14,
                    }}
                  >
                    <div>
                      <label style={labelStyle}>{t("profile:password.current")}</label>
                      <div style={{ position: "relative" }}>
                        <input
                          type={showPasswords.current ? "text" : "password"}
                          className="input-field"
                          value={pwForm.current_password}
                          onChange={(e: any) =>
                            setPwForm((f: any) => ({
                              ...f,
                              current_password: e.target.value,
                            }))
                          }
                          placeholder="••••••••"
                          required
                        />
                        {pwForm.current_password && (
                          <button
                            type="button"
                            onClick={() => setShowPasswords((s: any) => ({ ...s, current: !s.current }))}
                            style={{
                              position: "absolute",
                              right: 12,
                              top: "50%",
                              transform: "translateY(-50%)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: 18,
                              padding: 0,
                              color: "var(--text-secondary)",
                            }}
                          >
                            {showPasswords.current ? "👁️" : "👁️‍🗨️"}
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ gridColumn: "1/-1" }}>
                      <label style={labelStyle}>{t("profile:password.new")}</label>
                      <div style={{ position: "relative" }}>
                        <input
                          type={showPasswords.new ? "text" : "password"}
                          className="input-field"
                          value={pwForm.new_password}
                          onChange={(e: any) =>
                            setPwForm((f: any) => ({
                              ...f,
                              new_password: e.target.value,
                            }))
                          }
                          placeholder={t("profile:placeholders.passwordMin")}
                          required
                        />
                        {pwForm.new_password && (
                          <button
                            type="button"
                            onClick={() => setShowPasswords((s: any) => ({ ...s, new: !s.new }))}
                            style={{
                              position: "absolute",
                              right: 12,
                              top: "50%",
                              transform: "translateY(-50%)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: 18,
                              padding: 0,
                              color: "var(--text-secondary)",
                            }}
                          >
                            {showPasswords.new ? "👁️" : "👁️‍🗨️"}
                          </button>
                        )}
                      </div>
                      <PasswordStrengthChecker password={pwForm.new_password} t={t} namespace="profile" />
                    </div>
                    <div style={{ gridColumn: "1/-1" }}>
                      <label style={labelStyle}>{t("profile:password.confirm")}</label>
                      <div style={{ position: "relative" }}>
                        <input
                          type={showPasswords.confirm ? "text" : "password"}
                          className="input-field"
                          value={pwForm.confirm_password}
                          onChange={(e: any) =>
                            setPwForm((f: any) => ({
                              ...f,
                              confirm_password: e.target.value,
                            }))
                          }
                          placeholder={t("profile:placeholders.passwordRepeat")}
                          required
                        />
                        {pwForm.confirm_password && (
                          <button
                            type="button"
                            onClick={() => setShowPasswords((s: any) => ({ ...s, confirm: !s.confirm }))}
                            style={{
                              position: "absolute",
                              right: 12,
                              top: "50%",
                              transform: "translateY(-50%)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: 18,
                              padding: 0,
                              color: "var(--text-secondary)",
                            }}
                          >
                            {showPasswords.confirm ? "👁️" : "👁️‍🗨️"}
                          </button>
                        )}
                      </div>
                      {pwForm.confirm_password && pwForm.new_password && (
                        <div
                          style={{
                            marginTop: 8,
                            padding: "6px 8px",
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 500,
                            textAlign: "center",
                            color: pwForm.new_password === pwForm.confirm_password ? "var(--accent)" : "#ef4444",
                            background: pwForm.new_password === pwForm.confirm_password ? "rgba(0, 229, 160, 0.1)" : "rgba(239, 68, 68, 0.1)",
                          }}
                        >
                          {pwForm.new_password === pwForm.confirm_password ? (
                            <span>✓ {t("register:passwordMatch") || "Passwords matched!"}</span>
                          ) : (
                            <span>✗ {t("register:passwordMismatch") || "Passwords do not match"}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                    <button
                      type="button"
                      onClick={() => setShowPasswordForm(false)}
                      style={cancelBtnStyle}
                    >
                      {t("common:buttons.cancel")}
                    </button>
                    <button
                      type="submit"
                      disabled={savingPw}
                      style={saveBtnStyle(savingPw)}
                    >
                      {savingPw ? t("profile:password.updating") : t("common:buttons.updatePassword")}
                    </button>
                  </div>
                </form>
              )}
              </div>
            </div>
            {/* end RIGHT column */}
          </div>
          {/* end .detail */}

          {/* Community posts — full page width, multiple per row */}
          {user?.id && (
            <div className="reveal" style={{ marginTop: 8, animationDelay: "0.18s" }}>
              <ProfileCommunityPosts userId={user.id} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const labelStyle = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.4px",
};

const saveBtnStyle = (saving: any) => ({
  flex: 2,
  padding: "10px 24px",
  borderRadius: 8,
  border: "none",
  background: "var(--accent)",
  color: "#0a0d12",
  cursor: saving ? "not-allowed" : "pointer",
  fontWeight: 700,
  fontSize: 14,
  opacity: saving ? 0.7 : 1,
  minWidth: 120,
});

const cancelBtnStyle = {
  padding: "10px 20px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text-secondary)",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 14,
};
