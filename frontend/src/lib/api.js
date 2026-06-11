const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/v1`
  : "http://localhost:5000/api/v1";

export const API_SERVER = process.env.NEXT_PUBLIC_API_URL
  ? new URL(process.env.NEXT_PUBLIC_API_URL).origin
  : "http://localhost:5000";

const REQUEST_TIMEOUT_MS = 30000;

// Public R2 bucket origin (e.g. https://pub-xxx.r2.dev). When set, public uploads
// resolve straight to R2 instead of the onrender backend 302 redirect — removing a
// hop + free-tier cold-start delay from image LCP.
const R2_PUBLIC = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

export function getImageUrl(imagePath) {
  if (!imagePath) return null;
  if (imagePath.startsWith("http")) return imagePath; // already absolute (Unsplash etc)
  const file = imagePath.split(/[\\/]/).pop(); // leaf filename
  // Public uploads → direct R2. Mirrors backend resolveLocation():
  //   "/uploads/public/<f>" and bare "/uploads/<f>" → R2 key "public/<f>".
  // Private vet docs ("/api/v1/files/<f>") are never "/uploads/" → stay on the authed backend route.
  if (R2_PUBLIC && (imagePath.includes("/uploads/public/") || imagePath.startsWith("/uploads/"))) {
    return `${R2_PUBLIC}/public/${encodeURIComponent(file)}`;
  }
  // Fallback (no R2 env, or unrecognized shape): go through the backend.
  if (imagePath.startsWith("/uploads/")) return `${API_SERVER}${imagePath}`;
  return `${API_SERVER}/uploads/${imagePath}`;
}

let _refreshing = null;

async function tryRefresh() {
  if (_refreshing) return _refreshing;
  _refreshing = fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  }).then((r) => {
    _refreshing = null;
    if (!r.ok) {
      // 401/403: refresh failed, logout only once
      if (typeof window !== "undefined" && !sessionStorage.getItem("_logout_in_progress")) {
        sessionStorage.setItem("_logout_in_progress", "true");
        window.location.href = "/";
      }
      return false;
    }
    sessionStorage.removeItem("_logout_in_progress");
    return true;
  }).catch(() => {
    _refreshing = null;
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("_logout_in_progress");
    }
    return false;
  });
  return _refreshing;
}

async function request(path, method = "GET", body = null, isFormData = false, signal = null) {
  const headers = {};
  if (!isFormData) headers["Content-Type"] = "application/json";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const finalSignal = signal || controller.signal;

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      credentials: "include",
      body: isFormData ? body : body ? JSON.stringify(body) : null,
      signal: finalSignal,
    });

  if (res.status === 401 && path !== "/auth/refresh" && path !== "/auth/login" && path !== "/auth/me") {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const retryRes = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        credentials: "include",
        body: isFormData ? body : body ? JSON.stringify(body) : null,
        signal: finalSignal,
      });
      let retryData;
      try { retryData = await retryRes.json(); } catch { retryData = {}; }
      if (!retryRes.ok) {
        const msg = retryData.errors?.[0]?.msg || retryData.error || "Request failed";
        throw new Error(msg);
      }
      return retryData;
    }
  }

  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const msg = data.errors?.[0]?.msg || data.error || "Request failed";
    throw new Error(msg);
  }
  return data;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`Request timeout (${REQUEST_TIMEOUT_MS / 1000}s)`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    if (!signal) controller.abort();
  }
}

// ─── AUTH ──────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (phone, password, rememberMe = false) =>
    request("/auth/login", "POST", { phone, password, rememberMe }),
  register: (data) => request("/auth/register", "POST", data),
  me: () => request("/auth/me"),
  logout: () => request("/auth/logout", "POST"),
  logoutAll: () => request("/auth/logout-all", "POST"),
  refresh: () => request("/auth/refresh", "POST"),
  sendOtp: (phone) => request("/otp/send", "POST", { phone }),
  verifyOtp: (phone, otp) => request("/otp/verify", "POST", { phone, otp }),
  forgotPasswordSendOtp: (phone) =>
    request("/auth/forgot-password/send-otp", "POST", { phone }),
  forgotPasswordReset: (phone, otp, new_password) =>
    request("/auth/forgot-password/reset", "POST", { phone, otp, new_password }),
};

// ─── VETS ──────────────────────────────────────────────────────────────────
export const vetsAPI = {
  getAll: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/vets${q ? "?" + q : ""}`);
  },
  getMap: () => request("/vets/map"),
  getLocations: () => request("/vets/locations"),
  getById: (id) => request(`/vets/${id}`),
  create: (data) => request("/vets", "POST", data),
  update: (id, data) => request(`/vets/${id}`, "PUT", data),
  delete: (id) => request(`/vets/${id}`, "DELETE"),
  uploadImage: (id, file) => {
    const fd = new FormData();
    fd.append("image", file);
    return request(`/vets/${id}/image`, "POST", fd, true);
  },
};

// ─── REVIEWS ───────────────────────────────────────────────────────────────
export const reviewsAPI = {
  add: (vet_id, rating, comment) =>
    request("/reviews", "POST", { vet_id, rating, comment }),
  getAll: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/reviews${q ? "?" + q : ""}`);
  },
  delete: (id) => request(`/reviews/${id}`, "DELETE"),
};

// ─── ADMIN ─────────────────────────────────────────────────────────────────
export const adminAPI = {
  stats: () => request("/admin/stats"),
  getUsers: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/admin/users${q ? "?" + q : ""}`);
  },
  updateUser: (id, data) => request(`/admin/users/${id}`, "PUT", data),
  resetUserPassword: (id, new_password) => request(`/admin/users/${id}`, "PUT", { new_password }),
  deleteUser: (id) => request(`/admin/users/${id}`, "DELETE"),
  getVets: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/admin/vets${q ? "?" + q : ""}`);
  },
  createVet: (data) => request("/admin/vets", "POST", data),
  getVet: (id) => request(`/admin/vets/${id}`),
  updateVetStatus: (id, is_active) =>
    request(`/admin/vets/${id}`, "PUT", { is_active }),
  updateVet: (id, data) => request(`/admin/vets/${id}`, "PUT", data),
  approveVet: (id) => request(`/admin/vets/${id}/approve`, "PUT"),
  rejectVet: (id, reason) => request(`/admin/vets/${id}/reject`, "PUT", { reason }),
  deleteVet: (id) => request(`/admin/vets/${id}`, "DELETE"),
  deleteVetQualification: (id) => request(`/admin/vet-qualifications/${id}`, "DELETE"),
  deleteClinicContact: (id) => request(`/admin/clinic-contacts/${id}`, "DELETE"),
  deleteClinicVet: (id) => request(`/admin/clinic-vets/${id}`, "DELETE"),
  getSettings: () => request("/admin/settings"),
  updateSettings: (settings) => request("/admin/settings", "PUT", { settings }),
  getPets: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/admin/pets${q ? "?" + q : ""}`);
  },
  updatePet: (id, data) => request(`/admin/pets/${id}`, "PUT", data),
  deletePet: (id) => request(`/admin/pets/${id}`, "DELETE"),
  getFoundPets: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/admin/found-pets${q ? "?" + q : ""}`);
  },
  updateFoundPet: (id, data) => request(`/admin/found-pets/${id}`, "PUT", data),
  deleteFoundPet: (id) => request(`/admin/found-pets/${id}`, "DELETE"),
  getRescuePets: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/admin/rescue-pets${q ? "?" + q : ""}`);
  },
  updateRescuePet: (id, data) => request(`/admin/rescue-pets/${id}`, "PUT", data),
  deleteRescuePet: (id) => request(`/admin/rescue-pets/${id}`, "DELETE"),
  getReportedComments: () => request("/admin/comments/reported"),
  deleteComment: (id) => request(`/admin/comments/${id}`, "DELETE"),
  dismissComment: (id) => request(`/admin/comments/${id}/dismiss`, "POST"),
  getActivityLogs: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/admin/activity-logs${q ? "?" + q : ""}`);
  },
  getClaimRequests: () => request("/admin/vets/claim-requests"),
  approveClaimRequest: (vetId) => request(`/admin/vets/claim-requests/${vetId}/approve`, "PATCH"),
  rejectClaimRequest: (vetId) => request(`/admin/vets/claim-requests/${vetId}/reject`, "PATCH"),
  getSmsSettings: () => request("/admin/sms/settings"),
  updateSmsSettings: (data) => request("/admin/sms/settings", "PATCH", data),
  getSmsBalance: () => request("/admin/sms/balance"),
  // ── Role Manager (RBAC) ──
  getRoles: () => request("/admin/roles"),
  getPermissionRegistry: () => request("/admin/roles/registry"),
  createRole: (data) => request("/admin/roles", "POST", data),
  updateRole: (name, data) => request(`/admin/roles/${encodeURIComponent(name)}`, "PUT", data),
  deleteRole: (name) => request(`/admin/roles/${encodeURIComponent(name)}`, "DELETE"),
  assignUserRole: (id, role) => request(`/admin/users/${id}`, "PUT", { role }),
};

// ─── DONATIONS ─────────────────────────────────────────────────────────────
export const donationsAPI = {
  get: () => request("/donations"),
  create: (data) => {
    const fd = new FormData();
    if (data.title) fd.append("title", data.title);
    if (data.message) fd.append("message", data.message);
    if (data.qr_code_image) fd.append("qr_code_image", data.qr_code_image);
    return request("/donations", "POST", fd, true);
  },
  update: (id, data) => {
    const fd = new FormData();
    if (data.title) fd.append("title", data.title);
    if (data.message) fd.append("message", data.message);
    if (data.qr_code_image) fd.append("qr_code_image", data.qr_code_image);
    return request(`/donations/${id}`, "PUT", fd, true);
  },
};

// ─── PROFILE ───────────────────────────────────────────────────────────────
export const profileAPI = {
  get: () => request("/profile"),
  update: (data) => request("/profile", "PUT", data),
  updatePassword: (data) => request("/profile/password", "PUT", data),
  completion: () => request("/profile/completion"),
  uploadPicture: (file) => {
    const fd = new FormData();
    fd.append("image", file);
    return request("/profile/picture", "POST", fd, true);
  },
};

// ─── PETS ──────────────────────────────────────────────────────────────────
export const petsAPI = {
  getAll: () => request("/pets"),
  getPublic: (petId) => request(`/pets/public/${petId}`),
  create: (data) => request("/pets", "POST", data),
  update: (id, data) => request(`/pets/${id}`, "PUT", data),
  delete: (id) => request(`/pets/${id}`, "DELETE"),
  markLost: (id, data) => request(`/pets/${id}/lost`, "POST", data),
  markFound: (id) => request(`/pets/${id}/found`, "PUT"),
  markForAdoption: (id, data) => request(`/pets/${id}/adoption`, "POST", data),
  markAdopted: (id) => request(`/pets/${id}/adopted`, "PUT"),
  uploadImages: (id, files) => {
    const fd = new FormData();
    files.forEach((file) => fd.append("images", file));
    return request(`/pets/${id}/images`, "POST", fd, true);
  },
  deleteImage: (id, imageIndex) =>
    request(`/pets/${id}/images/${imageIndex}`, "DELETE"),
};

// ─── GEOLOCATION ───────────────────────────────────────────────────────────
export function getNearbyVets(vets, userLat, userLng, radiusKm = 10) {
  return vets
    .map((vet) => ({
      ...vet,
      distance: haversine(userLat, userLng, vet.latitude, vet.longitude),
    }))
    .filter((v) => v.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);
}

export function fetchNearbyVets(lat, lng, radius = 10, limit = 20) {
  const params = new URLSearchParams({ lat, lng, radius, limit });
  return request(`/vets/nearby?${params}`);
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── LOST & FOUND ──────────────────────────────────────────────────────────
export const lostFoundAPI = {
  getLostPets: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/lost-found/lost${q ? "?" + q : ""}`);
  },
  getLostPetDetails: (id) => request(`/lost-found/lost/${id}`),
  getFoundPets: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/lost-found/found${q ? "?" + q : ""}`);
  },
  getFoundPetDetails: (id) => request(`/lost-found/found/${id}`),
  createFoundPet: (data) => {
    const fd = new FormData();
    Object.keys(data).forEach((key) => {
      if (key === "images" && Array.isArray(data[key])) {
        data[key].forEach((file) => fd.append("images", file));
      } else if (data[key] !== null && data[key] !== undefined && data[key] !== "") {
        fd.append(key, data[key]);
      }
    });
    return request("/lost-found/found", "POST", fd, true);
  },
  updateFoundPet: (id, data) => {
    const fd = new FormData();
    Object.keys(data).forEach((key) => {
      if (key === "images" && Array.isArray(data[key])) {
        data[key].forEach((file) => fd.append("images", file));
      } else if (data[key] !== null && data[key] !== undefined && data[key] !== "") {
        fd.append(key, data[key]);
      }
    });
    return request(`/lost-found/found/${id}`, "PUT", fd, true);
  },
  deleteFoundPet: (id) => request(`/lost-found/found/${id}`, "DELETE"),
  addComment: (postId, postType, commentText) =>
    request("/lost-found/comments", "POST", {
      post_id: postId,
      post_type: postType,
      comment_text: commentText,
    }),
  getComments: (postType, postId, offset = 0) =>
    request(`/lost-found/comments/${postType}/${postId}?limit=20&offset=${offset}`),
  deleteComment: (id) => request(`/lost-found/comments/${id}`, "DELETE"),
  reportComment: (id, reason) =>
    request(`/comments/${id}/report`, "POST", { reason }),
};

// ─── RESCUE & ADOPTION ────────────────────────────────────────────────────
export const rescueAdoptionAPI = {
  getRescuePosts: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/rescue-adoption/rescue${q ? "?" + q : ""}`);
  },
  getRescuePostDetails: (id) => request(`/rescue-adoption/rescue/${id}`),
  createRescuePost: (data) => {
    const fd = new FormData();
    Object.keys(data).forEach((key) => {
      if (key === "images" && Array.isArray(data[key])) {
        data[key].forEach((file) => fd.append("images", file));
      } else if (data[key] !== null && data[key] !== undefined && data[key] !== "") {
        fd.append(key, data[key]);
      }
    });
    return request("/rescue-adoption/rescue", "POST", fd, true);
  },
  updateRescuePost: (id, data) => {
    const fd = new FormData();
    Object.keys(data).forEach((key) => {
      if (key === "images" && Array.isArray(data[key])) {
        data[key].forEach((file) => fd.append("images", file));
      } else if (data[key] !== null && data[key] !== undefined && data[key] !== "") {
        fd.append(key, data[key]);
      }
    });
    return request(`/rescue-adoption/rescue/${id}`, "PUT", fd, true);
  },
  deleteRescuePost: (id) => request(`/rescue-adoption/rescue/${id}`, "DELETE"),
  getAdoptionPosts: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/rescue-adoption/adoption${q ? "?" + q : ""}`);
  },
  getAdoptionPostDetails: (id) => request(`/rescue-adoption/adoption/${id}`),
  addComment: (postId, postType, commentText) =>
    request("/rescue-adoption/comments", "POST", {
      post_id: postId,
      post_type: postType,
      comment_text: commentText,
    }),
  getComments: (postType, postId, offset = 0) =>
    request(`/rescue-adoption/comments/${postType}/${postId}?limit=20&offset=${offset}`),
  deleteComment: (id) => request(`/rescue-adoption/comments/${id}`, "DELETE"),
  reportComment: (id, reason) =>
    request(`/comments/${id}/report`, "POST", { reason }),
};

// ─── VET AUTH ─────────────────────────────────────────────────────────────
export const vetAuthAPI = {
  register: (data) => request("/vet-auth/register", "POST", data),
  claimVet: (vetId, data) => request(`/vet-auth/${vetId}/claim`, "POST", data),
};

// ─── VET DASHBOARD ────────────────────────────────────────────────────────
export const vetDashboardAPI = {
  getProfile: () => request("/vet-dashboard/profile"),
  updateProfile: (data) => request("/vet-dashboard/profile", "PUT", data),
  updatePassword: (data) => request("/vet-dashboard/profile/password", "PUT", data),
  uploadCoverImage: (file) => {
    const fd = new FormData();
    fd.append("image", file);
    return request("/vet-dashboard/cover-image", "POST", fd, true);
  },
  uploadVetImage: (file) => {
    const fd = new FormData();
    fd.append("image", file);
    return request("/vet-dashboard/vet-image", "POST", fd, true);
  },
  addQualification: (qualification, institute) =>
    request("/vet-dashboard/qualifications", "POST", { qualification, institute }),
  deleteQualification: (id) => request(`/vet-dashboard/qualifications/${id}`, "DELETE"),
  uploadDocument: (file, doc_type) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("doc_type", doc_type);
    return request("/vet-dashboard/documents", "POST", fd, true);
  },
  deleteDocument: (id) => request(`/vet-dashboard/documents/${id}`, "DELETE"),
  addClinicContact: (contact_type, contact_value) =>
    request("/vet-dashboard/clinic-contacts", "POST", { contact_type, contact_value }),
  deleteClinicContact: (id) => request(`/vet-dashboard/clinic-contacts/${id}`, "DELETE"),
  addClinicVet: (data, imageFile) => {
    const fd = new FormData();
    Object.keys(data).forEach((key) => {
      if (key === "weekly_holidays" && Array.isArray(data[key])) {
        fd.append(key, JSON.stringify(data[key]));
      } else if (data[key] !== null && data[key] !== undefined) {
        fd.append(key, data[key]);
      }
    });
    if (imageFile) fd.append("vet_image", imageFile);
    return request("/vet-dashboard/clinic-vets", "POST", fd, true);
  },
  updateClinicVet: (id, data, imageFile) => {
    const fd = new FormData();
    Object.keys(data).forEach((key) => {
      if (key === "weekly_holidays" && Array.isArray(data[key])) {
        fd.append(key, JSON.stringify(data[key]));
      } else if (data[key] !== null && data[key] !== undefined) {
        fd.append(key, data[key]);
      }
    });
    if (imageFile) fd.append("vet_image", imageFile);
    return request(`/vet-dashboard/clinic-vets/${id}`, "PUT", fd, true);
  },
  deleteClinicVet: (id) => request(`/vet-dashboard/clinic-vets/${id}`, "DELETE"),
  addClinicVetQualification: (clinicVetId, qualification, institute) =>
    request(`/vet-dashboard/clinic-vets/${clinicVetId}/qualifications`, "POST", { qualification, institute }),
  deleteClinicVetQualification: (clinicVetId, qualId) =>
    request(`/vet-dashboard/clinic-vets/${clinicVetId}/qualifications/${qualId}`, "DELETE"),
};

// ─── CONTACT POST ─────────────────────────────────────────────────────────
export const contactPostAPI = {
  send: (post_id, post_type, sender_phone, message) =>
    request("/contact-post", "POST", { post_id, post_type, sender_phone, message }),
};

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────
export const notificationsAPI = {
  getAll: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/notifications${q ? "?" + q : ""}`);
  },
  getUnreadCount: () => request("/notifications/unread-count"),
  markAsRead: (id) => request(`/notifications/${id}/read`, "PUT"),
  markAllAsRead: () => request("/notifications/read-all/all", "PUT"),
  delete: (id) => request(`/notifications/${id}`, "DELETE"),
  deleteAll: () => request("/notifications", "DELETE"),
  getPreferences: () => request("/notifications/preferences/settings"),
  updatePreferences: (prefs) => request("/notifications/preferences/settings", "PUT", prefs),
};
