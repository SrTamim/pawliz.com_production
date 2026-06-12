// Frontend domain types — mirror backend API response shapes.
// pg reality flows through the API: NUMERIC columns arrive as strings
// (e.g. latitude/longitude/avg_rating), timestamps as ISO strings.

export interface User {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  is_active: boolean;
  dob?: string | null;
  address?: string | null;
  occupation?: string | null;
  avatar?: string | null;
  profile_picture?: string | null;
  permissions?: { pages: string[]; ui: string[] } | null;
  meta?: Record<string, unknown> | null;
}

export interface Vet {
  id: number;
  name: string;
  location_name: string | null;
  latitude: string | null;
  longitude: string | null;
  address: string | null;
  contact: string | null;
  email?: string | null;
  website?: string | null;
  image: string | null;
  cover_image?: string | null;
  description?: string | null;
  services?: string[] | null;
  vet_type: string | null;
  checkup_start?: string | null;
  checkup_end?: string | null;
  weekly_holidays?: string[] | null;
  avg_rating: string | null;
  review_count: number | null;
  status: string | null;
  approval_status: string | null;
  user_id: number | null;
  distance?: number;
  [key: string]: unknown;
}

export interface Pet {
  id: number;
  pet_id: string;
  user_id?: number;
  name: string;
  type: string;
  breed: string | null;
  gender: string | null;
  age: string | null;
  color: string | null;
  weight: string | null;
  images: string[] | null;
  is_lost?: boolean;
  vaccination_status?: string | null;
  [key: string]: unknown;
}

export interface LostFoundPost {
  id: number;
  pet_id?: number;
  user_id?: number;
  owner_id?: number;
  owner_name?: string;
  profile_picture?: string | null;
  images: string[] | string | null;
  comment_count?: number | string;
  status?: string;
  [key: string]: unknown;
}

export interface Comment {
  id: number;
  post_id: number;
  post_type: string;
  user_id: number;
  comment_text: string;
  name?: string;
  profile_picture?: string | null;
  created_at: string;
  [key: string]: unknown;
}

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  related_post_id: number | null;
  related_post_type: string | null;
  actor_user_id: number | null;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
}

// ─── Socket event maps (manual mirror of backend/types/socket.ts) ───────────
export interface ServerToClientEvents {
  notification: (notification: Notification) => void;
}

export interface ClientToServerEvents {
  message: (...args: unknown[]) => void;
}
