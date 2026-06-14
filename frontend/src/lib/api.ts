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

/** Loose request payloads/responses — endpoint shapes typed at call sites as needed. */
type Params = Record<string, any>;

export function getImageUrl(imagePath: string | null | undefined): string | null {
  if (!imagePath) return null;
  if (imagePath.startsWith("http")) return imagePath; // already absolute (Unsplash etc)
  const file = imagePath.split(/[\\/]/).pop() as string; // leaf filename
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

let _refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (_refreshing) return _refreshing;
  _refreshing = fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  }).then((r: any) => {
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

async function request(
  path: string,
  method: string = "GET",
  body: any = null,
  isFormData: boolean = false,
  signal: AbortSignal | null = null,
): Promise<any> {
  const headers: Record<string, string> = {};
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
      let retryData: any;
      try { retryData = await retryRes.json(); } catch { retryData = {}; }
      if (!retryRes.ok) {
        const msg = retryData.errors?.[0]?.msg || retryData.error || "Request failed";
        throw new Error(msg);
      }
      return retryData;
    }
  }

  let data: any;
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
  } catch (err: any) {
    if ((err as Error).name === "AbortError") {
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
  login: (phone: string, password: string, rememberMe = false) =>
    request("/auth/login", "POST", { phone, password, rememberMe }),
  register: (data: Params) => request("/auth/register", "POST", data),
  me: () => request("/auth/me"),
  logout: () => request("/auth/logout", "POST"),
  logoutAll: () => request("/auth/logout-all", "POST"),
  refresh: () => request("/auth/refresh", "POST"),
  sendOtp: (phone: string) => request("/otp/send", "POST", { phone }),
  verifyOtp: (phone: string, otp: string) => request("/otp/verify", "POST", { phone, otp }),
  forgotPasswordSendOtp: (phone: string) =>
    request("/auth/forgot-password/send-otp", "POST", { phone }),
  forgotPasswordReset: (phone: string, otp: string, new_password: string) =>
    request("/auth/forgot-password/reset", "POST", { phone, otp, new_password }),
};

// ─── VETS ──────────────────────────────────────────────────────────────────
export const vetsAPI = {
  getAll: (params: Params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/vets${q ? "?" + q : ""}`);
  },
  getMap: () => request("/vets/map"),
  getLocations: () => request("/vets/locations"),
  getById: (id: number | string) => request(`/vets/${id}`),
  create: (data: Params) => request("/vets", "POST", data),
  update: (id: number | string, data: Params) => request(`/vets/${id}`, "PUT", data),
  delete: (id: number | string) => request(`/vets/${id}`, "DELETE"),
  uploadImage: (id: number | string, file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    return request(`/vets/${id}/image`, "POST", fd, true);
  },
};

// ─── REVIEWS ───────────────────────────────────────────────────────────────
export const reviewsAPI = {
  add: (vet_id: number | string, rating: number, comment: string) =>
    request("/reviews", "POST", { vet_id, rating, comment }),
  getAll: (params: Params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/reviews${q ? "?" + q : ""}`);
  },
  delete: (id: number | string) => request(`/reviews/${id}`, "DELETE"),
};

// ─── ADMIN ─────────────────────────────────────────────────────────────────
export const adminAPI = {
  stats: () => request("/admin/stats"),
  getUsers: (params: Params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/admin/users${q ? "?" + q : ""}`);
  },
  updateUser: (id: number | string, data: Params) => request(`/admin/users/${id}`, "PUT", data),
  resetUserPassword: (id: number | string, new_password: string) => request(`/admin/users/${id}`, "PUT", { new_password }),
  deleteUser: (id: number | string) => request(`/admin/users/${id}`, "DELETE"),
  getVets: (params: Params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/admin/vets${q ? "?" + q : ""}`);
  },
  createVet: (data: Params) => request("/admin/vets", "POST", data),
  getVet: (id: number | string) => request(`/admin/vets/${id}`),
  updateVetStatus: (id: number | string, is_active: boolean) =>
    request(`/admin/vets/${id}`, "PUT", { is_active }),
  updateVet: (id: number | string, data: Params) => request(`/admin/vets/${id}`, "PUT", data),
  approveVet: (id: number | string) => request(`/admin/vets/${id}/approve`, "PUT"),
  rejectVet: (id: number | string, reason: string) => request(`/admin/vets/${id}/reject`, "PUT", { reason }),
  deleteVet: (id: number | string) => request(`/admin/vets/${id}`, "DELETE"),
  deleteVetQualification: (id: number | string) => request(`/admin/vet-qualifications/${id}`, "DELETE"),
  deleteClinicContact: (id: number | string) => request(`/admin/clinic-contacts/${id}`, "DELETE"),
  deleteClinicVet: (id: number | string) => request(`/admin/clinic-vets/${id}`, "DELETE"),
  getSettings: () => request("/admin/settings"),
  updateSettings: (settings: Params) => request("/admin/settings", "PUT", { settings }),
  getPets: (params: Params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/admin/pets${q ? "?" + q : ""}`);
  },
  updatePet: (id: number | string, data: Params) => request(`/admin/pets/${id}`, "PUT", data),
  deletePet: (id: number | string) => request(`/admin/pets/${id}`, "DELETE"),
  getFoundPets: (params: Params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/admin/found-pets${q ? "?" + q : ""}`);
  },
  updateFoundPet: (id: number | string, data: Params) => request(`/admin/found-pets/${id}`, "PUT", data),
  deleteFoundPet: (id: number | string) => request(`/admin/found-pets/${id}`, "DELETE"),
  getRescuePets: (params: Params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/admin/rescue-pets${q ? "?" + q : ""}`);
  },
  updateRescuePet: (id: number | string, data: Params) => request(`/admin/rescue-pets/${id}`, "PUT", data),
  deleteRescuePet: (id: number | string) => request(`/admin/rescue-pets/${id}`, "DELETE"),
  getReportedComments: () => request("/admin/comments/reported"),
  deleteComment: (id: number | string) => request(`/admin/comments/${id}`, "DELETE"),
  dismissComment: (id: number | string) => request(`/admin/comments/${id}/dismiss`, "POST"),
  getActivityLogs: (params: Params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/admin/activity-logs${q ? "?" + q : ""}`);
  },
  getClaimRequests: () => request("/admin/vets/claim-requests"),
  approveClaimRequest: (vetId: number | string) => request(`/admin/vets/claim-requests/${vetId}/approve`, "PATCH"),
  rejectClaimRequest: (vetId: number | string) => request(`/admin/vets/claim-requests/${vetId}/reject`, "PATCH"),
  getSmsSettings: () => request("/admin/sms/settings"),
  updateSmsSettings: (data: Params) => request("/admin/sms/settings", "PATCH", data),
  getSmsBalance: () => request("/admin/sms/balance"),
  // ── Role Manager (RBAC) ──
  getRoles: () => request("/admin/roles"),
  getPermissionRegistry: () => request("/admin/roles/registry"),
  createRole: (data: Params) => request("/admin/roles", "POST", data),
  updateRole: (name: string, data: Params) => request(`/admin/roles/${encodeURIComponent(name)}`, "PUT", data),
  deleteRole: (name: string) => request(`/admin/roles/${encodeURIComponent(name)}`, "DELETE"),
  assignUserRole: (id: number | string, role: string) => request(`/admin/users/${id}`, "PUT", { role }),
};

// ─── DONATIONS ─────────────────────────────────────────────────────────────
export const donationsAPI = {
  get: () => request("/donations"),
  create: (data: Params) => {
    const fd = new FormData();
    if (data.title) fd.append("title", data.title);
    if (data.message) fd.append("message", data.message);
    if (data.qr_code_image) fd.append("qr_code_image", data.qr_code_image);
    return request("/donations", "POST", fd, true);
  },
  update: (id: number | string, data: Params) => {
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
  update: (data: Params) => request("/profile", "PUT", data),
  updatePassword: (data: Params) => request("/profile/password", "PUT", data),
  completion: () => request("/profile/completion"),
  uploadPicture: (file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    return request("/profile/picture", "POST", fd, true);
  },
};

// ─── PETS ──────────────────────────────────────────────────────────────────
export const petsAPI = {
  getAll: () => request("/pets"),
  getPublic: (petId: string) => request(`/pets/public/${petId}`),
  create: (data: Params) => request("/pets", "POST", data),
  update: (id: number | string, data: Params) => request(`/pets/${id}`, "PUT", data),
  delete: (id: number | string) => request(`/pets/${id}`, "DELETE"),
  markLost: (id: number | string, data: Params) => request(`/pets/${id}/lost`, "POST", data),
  markFound: (id: number | string) => request(`/pets/${id}/found`, "PUT"),
  markForAdoption: (id: number | string, data: Params) => request(`/pets/${id}/adoption`, "POST", data),
  markAdopted: (id: number | string) => request(`/pets/${id}/adopted`, "PUT"),
  uploadImages: (id: number | string, files: File[]) => {
    const fd = new FormData();
    files.forEach((file: any) => fd.append("images", file));
    return request(`/pets/${id}/images`, "POST", fd, true);
  },
  deleteImage: (id: number | string, imageIndex: number) =>
    request(`/pets/${id}/images/${imageIndex}`, "DELETE"),
  // Vaccination records
  listVaccinations: (id: number | string) => request(`/pets/${id}/vaccinations`),
  addVaccination: (id: number | string, data: Params) => request(`/pets/${id}/vaccinations`, "POST", data),
  updateVaccination: (id: number | string, recordId: number | string, data: Params) =>
    request(`/pets/${id}/vaccinations/${recordId}`, "PUT", data),
  deleteVaccination: (id: number | string, recordId: number | string) =>
    request(`/pets/${id}/vaccinations/${recordId}`, "DELETE"),
  // Weight logs (read-only; entries are auto-created on pet weight change)
  listWeightLogs: (id: number | string) => request(`/pets/${id}/weight-logs`),
};

// ─── GEOLOCATION ───────────────────────────────────────────────────────────
export function getNearbyVets<T extends { latitude: any; longitude: any }>(
  vets: T[],
  userLat: number,
  userLng: number,
  radiusKm = 10,
): (T & { distance: number })[] {
  return vets
    .map((vet: any) => ({
      ...vet,
      distance: haversine(userLat, userLng, vet.latitude, vet.longitude),
    }))
    .filter((v: any) => v.distance <= radiusKm)
    .sort((a: any, b: any) => a.distance - b.distance);
}

export function fetchNearbyVets(lat: number, lng: number, radius = 10, limit = 20): Promise<any> {
  const params = new URLSearchParams({ lat, lng, radius, limit } as any);
  return request(`/vets/nearby?${params}`);
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
  getLostPets: (params: Params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/lost-found/lost${q ? "?" + q : ""}`);
  },
  getLostPetDetails: (id: number | string) => request(`/lost-found/lost/${id}`),
  getFoundPets: (params: Params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/lost-found/found${q ? "?" + q : ""}`);
  },
  getFoundPetDetails: (id: number | string) => request(`/lost-found/found/${id}`),
  createFoundPet: (data: Params) => {
    const fd = new FormData();
    Object.keys(data).forEach((key: any) => {
      if (key === "images" && Array.isArray(data[key])) {
        data[key].forEach((file: File) => fd.append("images", file));
      } else if (data[key] !== null && data[key] !== undefined && data[key] !== "") {
        fd.append(key, data[key]);
      }
    });
    return request("/lost-found/found", "POST", fd, true);
  },
  updateFoundPet: (id: number | string, data: Params) => {
    const fd = new FormData();
    Object.keys(data).forEach((key: any) => {
      if (key === "images" && Array.isArray(data[key])) {
        data[key].forEach((file: File) => fd.append("images", file));
      } else if (data[key] !== null && data[key] !== undefined && data[key] !== "") {
        fd.append(key, data[key]);
      }
    });
    return request(`/lost-found/found/${id}`, "PUT", fd, true);
  },
  deleteFoundPet: (id: number | string) => request(`/lost-found/found/${id}`, "DELETE"),
  addComment: (postId: number | string, postType: string, commentText: string) =>
    request("/lost-found/comments", "POST", {
      post_id: postId,
      post_type: postType,
      comment_text: commentText,
    }),
  getComments: (postType: string, postId: number | string, offset = 0) =>
    request(`/lost-found/comments/${postType}/${postId}?limit=20&offset=${offset}`),
  deleteComment: (id: number | string) => request(`/lost-found/comments/${id}`, "DELETE"),
  reportComment: (id: number | string, reason: string) =>
    request(`/comments/${id}/report`, "POST", { reason }),
};

// ─── RESCUE & ADOPTION ────────────────────────────────────────────────────
export const rescueAdoptionAPI = {
  getRescuePosts: (params: Params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/rescue-adoption/rescue${q ? "?" + q : ""}`);
  },
  getRescuePostDetails: (id: number | string) => request(`/rescue-adoption/rescue/${id}`),
  createRescuePost: (data: Params) => {
    const fd = new FormData();
    Object.keys(data).forEach((key: any) => {
      if (key === "images" && Array.isArray(data[key])) {
        data[key].forEach((file: File) => fd.append("images", file));
      } else if (data[key] !== null && data[key] !== undefined && data[key] !== "") {
        fd.append(key, data[key]);
      }
    });
    return request("/rescue-adoption/rescue", "POST", fd, true);
  },
  updateRescuePost: (id: number | string, data: Params) => {
    const fd = new FormData();
    Object.keys(data).forEach((key: any) => {
      if (key === "images" && Array.isArray(data[key])) {
        data[key].forEach((file: File) => fd.append("images", file));
      } else if (data[key] !== null && data[key] !== undefined && data[key] !== "") {
        fd.append(key, data[key]);
      }
    });
    return request(`/rescue-adoption/rescue/${id}`, "PUT", fd, true);
  },
  deleteRescuePost: (id: number | string) => request(`/rescue-adoption/rescue/${id}`, "DELETE"),
  getAdoptionPosts: (params: Params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/rescue-adoption/adoption${q ? "?" + q : ""}`);
  },
  getAdoptionPostDetails: (id: number | string) => request(`/rescue-adoption/adoption/${id}`),
  addComment: (postId: number | string, postType: string, commentText: string) =>
    request("/rescue-adoption/comments", "POST", {
      post_id: postId,
      post_type: postType,
      comment_text: commentText,
    }),
  getComments: (postType: string, postId: number | string, offset = 0) =>
    request(`/rescue-adoption/comments/${postType}/${postId}?limit=20&offset=${offset}`),
  deleteComment: (id: number | string) => request(`/rescue-adoption/comments/${id}`, "DELETE"),
  reportComment: (id: number | string, reason: string) =>
    request(`/comments/${id}/report`, "POST", { reason }),
};

// ─── VET AUTH ─────────────────────────────────────────────────────────────
export const vetAuthAPI = {
  register: (data: Params) => request("/vet-auth/register", "POST", data),
  claimVet: (vetId: number | string, data: Params) => request(`/vet-auth/${vetId}/claim`, "POST", data),
};

// ─── VET DASHBOARD ────────────────────────────────────────────────────────
export const vetDashboardAPI = {
  getProfile: () => request("/vet-dashboard/profile"),
  updateProfile: (data: Params) => request("/vet-dashboard/profile", "PUT", data),
  updatePassword: (data: Params) => request("/vet-dashboard/profile/password", "PUT", data),
  uploadCoverImage: (file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    return request("/vet-dashboard/cover-image", "POST", fd, true);
  },
  uploadVetImage: (file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    return request("/vet-dashboard/vet-image", "POST", fd, true);
  },
  addQualification: (qualification: string, institute: string) =>
    request("/vet-dashboard/qualifications", "POST", { qualification, institute }),
  deleteQualification: (id: number | string) => request(`/vet-dashboard/qualifications/${id}`, "DELETE"),
  uploadDocument: (file: File, doc_type: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("doc_type", doc_type);
    return request("/vet-dashboard/documents", "POST", fd, true);
  },
  deleteDocument: (id: number | string) => request(`/vet-dashboard/documents/${id}`, "DELETE"),
  addClinicContact: (contact_type: string, contact_value: string) =>
    request("/vet-dashboard/clinic-contacts", "POST", { contact_type, contact_value }),
  deleteClinicContact: (id: number | string) => request(`/vet-dashboard/clinic-contacts/${id}`, "DELETE"),
  addClinicVet: (data: Params, imageFile?: File | null) => {
    const fd = new FormData();
    Object.keys(data).forEach((key: any) => {
      if ((key === "weekly_holidays" || key === "weekly_schedule") && data[key] && typeof data[key] === "object") {
        fd.append(key, JSON.stringify(data[key]));
      } else if (data[key] !== null && data[key] !== undefined) {
        fd.append(key, data[key]);
      }
    });
    if (imageFile) fd.append("vet_image", imageFile);
    return request("/vet-dashboard/clinic-vets", "POST", fd, true);
  },
  updateClinicVet: (id: number | string, data: Params, imageFile?: File | null) => {
    const fd = new FormData();
    Object.keys(data).forEach((key: any) => {
      if ((key === "weekly_holidays" || key === "weekly_schedule") && data[key] && typeof data[key] === "object") {
        fd.append(key, JSON.stringify(data[key]));
      } else if (data[key] !== null && data[key] !== undefined) {
        fd.append(key, data[key]);
      }
    });
    if (imageFile) fd.append("vet_image", imageFile);
    return request(`/vet-dashboard/clinic-vets/${id}`, "PUT", fd, true);
  },
  deleteClinicVet: (id: number | string) => request(`/vet-dashboard/clinic-vets/${id}`, "DELETE"),
  addClinicVetQualification: (clinicVetId: number | string, qualification: string, institute: string) =>
    request(`/vet-dashboard/clinic-vets/${clinicVetId}/qualifications`, "POST", { qualification, institute }),
  deleteClinicVetQualification: (clinicVetId: number | string, qualId: number | string) =>
    request(`/vet-dashboard/clinic-vets/${clinicVetId}/qualifications/${qualId}`, "DELETE"),
};

// ─── CONTACT POST ─────────────────────────────────────────────────────────
export const contactPostAPI = {
  send: (post_id: number | string, post_type: string, sender_phone: string, message: string) =>
    request("/contact-post", "POST", { post_id, post_type, sender_phone, message }),
};

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────
export const notificationsAPI = {
  getAll: (params: Params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/notifications${q ? "?" + q : ""}`);
  },
  getUnreadCount: () => request("/notifications/unread-count"),
  markAsRead: (id: number | string) => request(`/notifications/${id}/read`, "PUT"),
  markAllAsRead: () => request("/notifications/read-all/all", "PUT"),
  delete: (id: number | string) => request(`/notifications/${id}`, "DELETE"),
  deleteAll: () => request("/notifications", "DELETE"),
  getPreferences: () => request("/notifications/preferences/settings"),
  updatePreferences: (prefs: Params) => request("/notifications/preferences/settings", "PUT", prefs),
};
