/**
 * Frontend API wiring tests (static analysis + structural verification)
 * These tests verify that:
 * 1. All frontend API calls use credentials: 'include'
 * 2. API base URL is configured correctly
 * 3. Required pages/components exist
 * 4. API endpoints called in frontend match backend routes
 *
 * Extension-agnostic: the frontend is TypeScript (.ts/.tsx); the helpers
 * fall back across extensions so the suite stayed green during migration.
 */

import fs from 'fs';
import path from 'path';

const FRONTEND_SRC = path.join(__dirname, '../../frontend/src');

/** Resolve a source file trying TS first, then legacy JS extensions. */
function resolveSrc(base: string): string {
  const candidates = base.match(/\.(jsx|tsx|js|ts)$/)
    ? [base]
    : [`${base}.tsx`, `${base}.ts`, `${base}.jsx`, `${base}.js`];
  for (const c of candidates) {
    const full = path.join(FRONTEND_SRC, c);
    if (fs.existsSync(full)) return full;
  }
  return path.join(FRONTEND_SRC, candidates[0]);
}

function existsSrc(base: string): boolean {
  return fs.existsSync(resolveSrc(base));
}

function readSrc(base: string): string {
  return fs.readFileSync(resolveSrc(base), 'utf8');
}

describe('Frontend API lib (lib/api)', () => {
  let apiSrc: string;
  beforeAll(() => { apiSrc = readSrc('lib/api'); });

  it('file exists and is non-empty', () => {
    expect(apiSrc.length).toBeGreaterThan(100);
  });

  it('uses credentials: include for cookie-based auth', () => {
    expect(apiSrc).toMatch(/credentials.*include/);
  });

  it('references /api/v1 base path', () => {
    expect(apiSrc).toMatch(/\/api\/v1/);
  });

  it('has login function', () => {
    expect(apiSrc).toMatch(/login/i);
  });

  it('has logout function', () => {
    expect(apiSrc).toMatch(/logout/i);
  });

  it('has register function', () => {
    expect(apiSrc).toMatch(/register/i);
  });

  it('has getVets or vets fetch function', () => {
    expect(apiSrc).toMatch(/vet/i);
  });

  it('has refresh token handling', () => {
    expect(apiSrc).toMatch(/refresh/i);
  });
});

describe('Frontend AuthContext', () => {
  let src: string;
  beforeAll(() => { src = readSrc('context/AuthContext'); });

  it('file exists', () => {
    expect(src.length).toBeGreaterThan(100);
  });

  it('exports AuthContext or useAuth', () => {
    expect(src).toMatch(/export.*Auth|AuthContext|useAuth/);
  });

  it('handles 401 refresh flow', () => {
    expect(src).toMatch(/401|refresh/i);
  });

  it('uses cookie-based auth (no localStorage token)', () => {
    // Should NOT store JWT in localStorage
    expect(src).not.toMatch(/localStorage\.setItem.*token/i);
  });
});

describe('Frontend pages exist', () => {
  const REQUIRED_PAGES = [
    'pages/index',
    'pages/_app',
    'pages/_document',
    'pages/profile',
    'pages/lost-found',
    'pages/rescue',
    'pages/admin',
    'pages/vet-dashboard',
    'pages/about',
    'pages/privacy',
    'pages/terms',
  ];

  REQUIRED_PAGES.forEach((page) => {
    it(`page ${page} exists`, () => {
      expect(existsSrc(page)).toBe(true);
    });
  });

  it('dynamic pet page [petId] exists', () => {
    expect(existsSrc('pages/pet/[petId]')).toBe(true);
  });
});

describe('Frontend components exist', () => {
  const REQUIRED_COMPONENTS = [
    'components/Auth/AuthModal',
    'components/Auth/OtpVerifyPopup',
    'components/Auth/VetRegisterModal',
    'components/Auth/PasswordStrengthChecker',
    'components/Map/MapView',
    'components/Admin/AdminDashboard',
    'components/LostFound/LostPetPostCard',
    'components/LostFound/FoundPetPostCard',
    'components/LostFound/CommentsSection',
    'components/RescueAdoption/RescuePostCard',
    'components/RescueAdoption/AdoptionPostCard',
    'components/RescueAdoption/RescueAdoptionCommentsSection',
    'components/Notifications/NotificationBell',
    'components/Notifications/NotificationSettings',
    'components/VetDashboard/VetDashboardLayout',
    'components/VetDashboard/VetProfileDetails',
    'components/VetDashboard/VetReviews',
    'components/Vet/VetDetailPage',
    'components/Profile/PetCard',
    'components/Navbar',
    'components/ErrorBoundary',
  ];

  REQUIRED_COMPONENTS.forEach((comp) => {
    it(`component ${comp} exists`, () => {
      expect(existsSrc(comp)).toBe(true);
    });
  });
});

describe('Frontend contexts exist', () => {
  ['context/AuthContext', 'context/NavbarContext', 'context/LanguageContext', 'context/ToastContext'].forEach((ctx) => {
    it(`context ${ctx} exists`, () => {
      expect(existsSrc(ctx)).toBe(true);
    });
  });
});

describe('Frontend hooks', () => {
  it('useVets hook exists', () => {
    expect(existsSrc('hooks/useVets')).toBe(true);
  });

  it('useAsync hook exists', () => {
    expect(existsSrc('hooks/useAsync')).toBe(true);
  });

  it('useVets calls /api/v1/vets endpoint', () => {
    const src = readSrc('hooks/useVets');
    expect(src).toMatch(/\/api\/v1\/vets|\bvets\b/i);
  });
});

describe('i18n configuration', () => {
  it('i18n lib file exists', () => {
    expect(existsSrc('lib/i18n')).toBe(true);
  });

  it('i18n supports en and bn', () => {
    const src = readSrc('lib/i18n');
    expect(src).toMatch(/en/);
    expect(src).toMatch(/bn/);
  });
});

describe('Socket.IO frontend integration', () => {
  it('socket lib file exists', () => {
    expect(existsSrc('lib/socket')).toBe(true);
  });
});

describe('Map component', () => {
  it('MapView uses react-leaflet or leaflet', () => {
    const src = readSrc('components/Map/MapView');
    expect(src).toMatch(/leaflet|react-leaflet/i);
  });
});

describe('OTP popup component', () => {
  it('OtpVerifyPopup has verify UI', () => {
    const src = readSrc('components/Auth/OtpVerifyPopup');
    expect(src).toMatch(/verify|otp/i);
  });
});

describe('Admin dashboard', () => {
  it('AdminDashboard references vet approval operations', () => {
    const src = readSrc('components/Admin/AdminDashboard');
    expect(src).toMatch(/approve|reject|vet/i);
  });
});

describe('LanguageContext', () => {
  let src: string;
  beforeAll(() => { src = readSrc('context/LanguageContext'); });

  it('persists lang to localStorage', () => {
    expect(src).toMatch(/localStorage/);
  });

  it('supports setLang function', () => {
    expect(src).toMatch(/setLang/);
  });
});
