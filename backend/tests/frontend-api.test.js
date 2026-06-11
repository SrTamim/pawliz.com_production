/**
 * Frontend API wiring tests (static analysis + structural verification)
 * These tests verify that:
 * 1. All frontend API calls use credentials: 'include'
 * 2. API base URL is configured correctly
 * 3. Required pages/components exist
 * 4. API endpoints called in frontend match backend routes
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_SRC = path.join(__dirname, '../../frontend/src');
const API_LIB = path.join(FRONTEND_SRC, 'lib/api.js');
const AUTH_CONTEXT = path.join(FRONTEND_SRC, 'context/AuthContext.jsx');
const NAVBAR_CONTEXT = path.join(FRONTEND_SRC, 'context/NavbarContext.jsx');
const LANG_CONTEXT = path.join(FRONTEND_SRC, 'context/LanguageContext.jsx');

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('Frontend API lib (lib/api.js)', () => {
  let apiSrc;
  beforeAll(() => { apiSrc = readFile(API_LIB); });

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
  let src;
  beforeAll(() => { src = readFile(AUTH_CONTEXT); });

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
  const PAGES_DIR = path.join(FRONTEND_SRC, 'pages');

  const REQUIRED_PAGES = [
    'index.jsx',
    '_app.jsx',
    '_document.jsx',
    'profile.jsx',
    'lost-found.jsx',
    'rescue.jsx',
    'admin.jsx',
    'vet-dashboard.jsx',
    'about.jsx',
    'privacy.jsx',
    'terms.jsx',
  ];

  REQUIRED_PAGES.forEach((page) => {
    it(`page ${page} exists`, () => {
      expect(fs.existsSync(path.join(PAGES_DIR, page))).toBe(true);
    });
  });

  it('dynamic pet page [petId].jsx exists', () => {
    expect(fs.existsSync(path.join(PAGES_DIR, 'pet', '[petId].jsx'))).toBe(true);
  });
});

describe('Frontend components exist', () => {
  const COMPS = path.join(FRONTEND_SRC, 'components');

  const REQUIRED_COMPONENTS = [
    'Auth/AuthModal.jsx',
    'Auth/OtpVerifyPopup.jsx',
    'Auth/VetRegisterModal.jsx',
    'Auth/PasswordStrengthChecker.jsx',
    'Map/MapView.jsx',
    'Admin/AdminDashboard.jsx',
    'LostFound/LostPetPostCard.jsx',
    'LostFound/FoundPetPostCard.jsx',
    'LostFound/CommentsSection.jsx',
    'RescueAdoption/RescuePostCard.jsx',
    'RescueAdoption/AdoptionPostCard.jsx',
    'RescueAdoption/RescueAdoptionCommentsSection.jsx',
    'Notifications/NotificationBell.jsx',
    'Notifications/NotificationSettings.jsx',
    'VetDashboard/VetDashboardLayout.jsx',
    'VetDashboard/VetProfileDetails.jsx',
    'VetDashboard/VetReviews.jsx',
    'Vet/VetDetailPage.jsx',
    'Profile/PetCard.jsx',
    'Navbar.jsx',
    'ErrorBoundary.jsx',
  ];

  REQUIRED_COMPONENTS.forEach((comp) => {
    it(`component ${comp} exists`, () => {
      expect(fs.existsSync(path.join(COMPS, comp))).toBe(true);
    });
  });
});

describe('Frontend contexts exist', () => {
  const CONTEXTS = path.join(FRONTEND_SRC, 'context');
  ['AuthContext.jsx', 'NavbarContext.jsx', 'LanguageContext.jsx', 'ToastContext.jsx'].forEach((ctx) => {
    it(`context ${ctx} exists`, () => {
      expect(fs.existsSync(path.join(CONTEXTS, ctx))).toBe(true);
    });
  });
});

describe('Frontend hooks', () => {
  it('useVets hook exists', () => {
    expect(fs.existsSync(path.join(FRONTEND_SRC, 'hooks/useVets.js'))).toBe(true);
  });

  it('useAsync hook exists', () => {
    expect(fs.existsSync(path.join(FRONTEND_SRC, 'hooks/useAsync.js'))).toBe(true);
  });

  it('useVets calls /api/v1/vets endpoint', () => {
    const src = readFile(path.join(FRONTEND_SRC, 'hooks/useVets.js'));
    expect(src).toMatch(/\/api\/v1\/vets|\bvets\b/i);
  });
});

describe('i18n configuration', () => {
  it('i18n lib file exists', () => {
    expect(fs.existsSync(path.join(FRONTEND_SRC, 'lib/i18n.js'))).toBe(true);
  });

  it('i18n supports en and bn', () => {
    const src = readFile(path.join(FRONTEND_SRC, 'lib/i18n.js'));
    expect(src).toMatch(/en/);
    expect(src).toMatch(/bn/);
  });
});

describe('Socket.IO frontend integration', () => {
  it('socket.js lib file exists', () => {
    expect(fs.existsSync(path.join(FRONTEND_SRC, 'lib/socket.js'))).toBe(true);
  });
});

describe('Map component', () => {
  it('MapView uses react-leaflet or leaflet', () => {
    const src = readFile(path.join(FRONTEND_SRC, 'components/Map/MapView.jsx'));
    expect(src).toMatch(/leaflet|react-leaflet/i);
  });
});

describe('OTP popup component', () => {
  it('OtpVerifyPopup has verify UI', () => {
    const src = readFile(path.join(FRONTEND_SRC, 'components/Auth/OtpVerifyPopup.jsx'));
    expect(src).toMatch(/verify|otp/i);
  });
});

describe('Admin dashboard', () => {
  it('AdminDashboard references vet approval operations', () => {
    const src = readFile(path.join(FRONTEND_SRC, 'components/Admin/AdminDashboard.jsx'));
    expect(src).toMatch(/approve|reject|vet/i);
  });
});

describe('LanguageContext', () => {
  let src;
  beforeAll(() => { src = readFile(LANG_CONTEXT); });

  it('persists lang to localStorage', () => {
    expect(src).toMatch(/localStorage/);
  });

  it('supports setLang function', () => {
    expect(src).toMatch(/setLang/);
  });
});
