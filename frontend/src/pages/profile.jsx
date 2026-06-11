import { useState, useEffect, useCallback, useRef } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useNavbar } from "../context/NavbarContext";
import { profileAPI, getImageUrl } from "../lib/api";
import PetCard, { AddPetCard } from "../components/Profile/PetCard";
import ProfileCompletion from "../components/Profile/ProfileCompletion";
import PasswordStrengthChecker from "../components/Auth/PasswordStrengthChecker";
import { useTranslation } from "react-i18next";


export default function ProfilePage() {
  const { user, loading: authLoading, updateUser, logout } = useAuth();
  const { toast } = useToast();
  const { theme } = useNavbar();
  const router = useRouter();
  const { t } = useTranslation(["profile", "common"]);

  const [isDesktop, setIsDesktop] = useState(false);
  const [profile, setProfile] = useState(null);
  const [pets, setPets] = useState([]);
  const [completion, setCompletion] = useState({
    percentage: 0,
    badge: "bronze",
  });
  const [loadingProfile, setLoadingProfile] = useState(true);

  // User form
  const [editingUser, setEditingUser] = useState(false);
  const [userForm, setUserForm] = useState({});
  const [savingUser, setSavingUser] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState(null); // null | 'saving' | 'saved'
  const autoSaveTimer = useRef(null);

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
  const profilePictureInputRef = useRef(null);

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
      setProfile(profileRes.user);
      setPets(profileRes.pets || []);
      setCompletion(completionRes);
    } catch (err) {
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

  // Start editing user
  const startEditUser = () => {
    setUserForm({
      name: profile?.name || "",
      email: profile?.email || "",
      dob: profile?.dob ? profile.dob.split("T")[0] : "",
      address: profile?.address || "",
      occupation: profile?.occupation || "",
    });
    setEditingUser(true);
    setAutoSaveStatus(null);
  };

  // Auto-save user profile (debounced)
  const handleUserFormChange = (k, v) => {
    setUserForm((f) => ({ ...f, [k]: v }));
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
      setEditingUser(false);
      setAutoSaveStatus(null);
      toast("Profile updated successfully!", "success");
      refreshCompletion();
    } catch (err) {
      toast(err.message || "Failed to update profile", "error");
    } finally {
      setSavingUser(false);
    }
  };

  // Save password
  const handleSavePassword = async (e) => {
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
    } catch (err) {
      toast(err.message || "Failed to update password", "error");
    } finally {
      setSavingPw(false);
    }
  };

  const handlePetCreated = (pet) => {
    setPets((prev) => [...prev, pet]);
    refreshCompletion();
  };

  const handlePetDeleted = (petId) => {
    setPets((prev) => prev.filter((p) => p.id !== petId));
    refreshCompletion();
  };

  const handlePetUpdated = (updatedPet) => {
    setPets((prev) =>
      prev.map((p) => (p.id === updatedPet.id ? updatedPet : p)),
    );
    refreshCompletion();
  };

  const handleUploadProfilePicture = async (file) => {
    if (!file) return;
    setUploadingPicture(true);
    try {
      const res = await profileAPI.uploadPicture(file);
      setProfile((p) => ({ ...p, profile_picture: res.user.profile_picture }));
      updateUser(res.user);
      toast("Profile picture updated!", "success");
      refreshCompletion();
    } catch (err) {
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
          background: "var(--bg-primary)",
          paddingTop: "calc(var(--header-height) + 32px)",
          paddingBottom: 60,
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

  const updateProfileButton = (
    <button
      onClick={startEditUser}
      style={{
        padding: isDesktop ? "10px 20px" : "9px 16px",
        borderRadius: 10,
        background: "var(--accent)",
        border: "none",
        color: "#0a0d12",
        fontWeight: 700,
        fontSize: isDesktop ? 15 : 13,
        cursor: "pointer",
        flex: isDesktop ? "none" : 1,
      }}
    >
      {t("profile:updateProfile")}
    </button>
  );

  return (
    <>
      <Head>
        <title>My Profile — Pawliz</title>
      </Head>

      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg-primary)",
          paddingTop: "calc(var(--header-height) + 32px)",
          paddingBottom: 60,
        }}
      >
        <div
          style={{
            maxWidth: isDesktop ? 1200 : 860,
            margin: "0 auto",
            padding: isDesktop ? "0 32px" : "0 16px",
          }}
        >
          {/* Profile Header */}
          <div
            style={{
              display: "flex",
              alignItems: isDesktop ? "center" : "flex-start",
              flexDirection: isDesktop ? "row" : "column",
              gap: 18,
              marginBottom: 28,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 18, width: "100%" }}>
              <div
                onClick={() => profilePictureInputRef.current?.click()}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  backgroundImage: profile?.profile_picture
                    ? `url('${getImageUrl(profile.profile_picture)}')`
                    : "linear-gradient(135deg, var(--accent), #00b87a)",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                  fontWeight: 700,
                  color: "#0a0d12",
                  flexShrink: 0,
                  border: "3px solid var(--border-accent)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "0.8";
                }}
                onMouseLeave={(e) => {
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
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleUploadProfilePicture(e.target.files[0]);
                  }
                }}
                disabled={uploadingPicture}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1
                  style={{
                    margin: 0,
                    fontSize: isDesktop ? 32 : 22,
                    fontWeight: 800,
                    color: "var(--text-primary)",
                    wordBreak: "break-word",
                  }}
                >
                  {profile?.name}
                </h1>
                <div
                  style={{
                    fontSize: isDesktop ? 15 : 12,
                    color: "var(--text-muted)",
                    marginTop: 3,
                    wordBreak: "break-all",
                  }}
                >
                  {profile?.phone} {profile?.email ? `· ${profile.email}` : ""}
                </div>
              </div>
            </div>
            {isDesktop && (
              <div style={{ display: "flex", gap: 10, flexShrink: 0, width: "auto" }}>
                {updateProfileButton}
              </div>
            )}
          </div>

          {/* Completion Bar */}
          <div style={{ marginBottom: 28 }}>
            <ProfileCompletion
              percentage={completion.percentage}
              badge={completion.badge}
              motivate
            />
          </div>

          {/* Update button — mobile only, below completion */}
          {!isDesktop && (
            <div style={{ display: "flex", width: "100%", marginBottom: 28 }}>
              {updateProfileButton}
            </div>
          )}

          {/* User Profile Form */}
          {editingUser && (
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-accent)",
                borderRadius: "var(--radius)",
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
                    onChange={(e) =>
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
                    onChange={(e) =>
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
                    onChange={(e) =>
                      handleUserFormChange("dob", e.target.value)
                    }
                  />
                </div>
                <div>
                  <label style={labelStyle}>{t("profile:fields.occupation")}</label>
                  <input
                    className="input-field"
                    value={userForm.occupation}
                    onChange={(e) =>
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
                    onChange={(e) =>
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
                  onClick={() => setEditingUser(false)}
                  style={cancelBtnStyle}
                >
                  {t("common:buttons.cancel")}
                </button>
                <button
                  onClick={() => setShowPasswordForm((v) => !v)}
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
                          onChange={(e) =>
                            setPwForm((f) => ({
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
                            onClick={() => setShowPasswords((s) => ({ ...s, current: !s.current }))}
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
                          onChange={(e) =>
                            setPwForm((f) => ({
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
                            onClick={() => setShowPasswords((s) => ({ ...s, new: !s.new }))}
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
                          onChange={(e) =>
                            setPwForm((f) => ({
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
                            onClick={() => setShowPasswords((s) => ({ ...s, confirm: !s.confirm }))}
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
          )}

          {/* Profile info display (when not editing) */}
          {!editingUser && profile && (
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: 24,
                marginBottom: 28,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 15,
                  color: "var(--text-primary)",
                  marginBottom: 16,
                }}
              >
                {t("profile:personalInfo")}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                  gap: 16,
                }}
              >
                {[
                  { icon: "📛", label: t("profile:fieldLabels.name"), value: profile.name },
                  { icon: "📱", label: t("profile:fieldLabels.phone"), value: profile.phone },
                  { icon: "📧", label: t("profile:fieldLabels.email"), value: profile.email },
                  {
                    icon: "🎂",
                    label: t("profile:fieldLabels.dob"),
                    value: profile.dob
                      ? new Date(profile.dob).toLocaleDateString()
                      : null,
                  },
                  {
                    icon: "💼",
                    label: t("profile:fieldLabels.occupation"),
                    value: profile.occupation,
                  },
                  {
                    icon: "📍",
                    label: t("profile:fieldLabels.address"),
                    value: profile.address,
                    full: true,
                  },
                ].map(({ icon, label, value, full }) =>
                  value ? (
                    <div key={icon} style={full ? { gridColumn: "1/-1" } : {}}>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.4px",
                          marginBottom: 4,
                        }}
                      >
                        {icon} {label}
                      </div>
                      <div
                        style={{ fontSize: 14, color: "var(--text-primary)" }}
                      >
                        {value}
                      </div>
                    </div>
                  ) : null,
                )}
              </div>
            </div>
          )}

          {/* Pets Section */}
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 18,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 800,
                  color: "var(--text-primary)",
                }}
              >
                {t("profile:myPets")} ({pets.length})
              </h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {pets.map((pet) => (
                <PetCard
                  key={pet.id}
                  pet={pet}
                  onDeleted={handlePetDeleted}
                  onUpdated={handlePetUpdated}
                />
              ))}
              <AddPetCard onCreated={handlePetCreated} />
            </div>
          </div>
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

const saveBtnStyle = (saving) => ({
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
