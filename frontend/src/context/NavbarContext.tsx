import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

/**
 * Navbar context provider + hook
 * Manages theme (dark/light), auth/donate/vet-reg modal visibility
 * Persists theme to localStorage
 */

interface NavbarContextValue {
  theme: string;
  toggleTheme: () => void;
  authOpen: boolean;
  openAuth: (tab?: string) => void;
  closeAuth: () => void;
  authTab: string;
  donateOpen: boolean;
  openDonate: () => void;
  closeDonate: () => void;
  vetRegOpen: boolean;
  openVetReg: () => void;
  closeVetReg: () => void;
}

const NavbarContext = createContext<NavbarContextValue | undefined>(undefined);

/**
 * Navbar provider: manage theme + modals
 */
export function NavbarProvider({ children }: { children: ReactNode }) {
  // Init deterministically to "dark" so the server and the client's first render
  // agree (no hydration mismatch). The blocking <script> in _document.jsx already
  // sets the `light` class pre-paint from localStorage to prevent FOUC, and the
  // effect below restores the saved theme into state right after hydration.
  const [theme, setTheme] = useState("dark");
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState("login");
  const [donateOpen, setDonateOpen] = useState(false);
  const [vetRegOpen, setVetRegOpen] = useState(false);

  // Theme persistence
  useEffect(() => {
    const saved = localStorage.getItem("pawliz_theme") || "dark";
    setTheme(saved);
    document.documentElement.classList.toggle("light", saved === "light");
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prevTheme: any) => {
      const next = prevTheme === "dark" ? "light" : "dark";
      localStorage.setItem("pawliz_theme", next);
      document.documentElement.classList.toggle("light", next === "light");
      return next;
    });
  }, []);

  const openAuth = (tab = "login") => {
    setAuthTab(tab);
    setAuthOpen(true);
  };

  const closeAuth = () => {
    setAuthOpen(false);
  };

  const openDonate = () => {
    setDonateOpen(true);
  };

  const closeDonate = () => {
    setDonateOpen(false);
  };

  const openVetReg = () => setVetRegOpen(true);
  const closeVetReg = () => setVetRegOpen(false);

  return (
    <NavbarContext.Provider
      value={{
        theme,
        toggleTheme,
        authOpen,
        openAuth,
        closeAuth,
        authTab,
        donateOpen,
        openDonate,
        closeDonate,
        vetRegOpen,
        openVetReg,
        closeVetReg,
      }}
    >
      {children}
    </NavbarContext.Provider>
  );
}

/**
 * Use navbar context
 */
export function useNavbar(): NavbarContextValue {
  const context = useContext(NavbarContext);
  if (!context) {
    throw new Error("useNavbar must be used within NavbarProvider");
  }
  return context;
}
