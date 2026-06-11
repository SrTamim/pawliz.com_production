// Self-hosted fonts (woff2) — replaces the Google Fonts CDN <link>s that were in
// _document.jsx. @fontsource declares @font-face under the canonical family names
// ("Roboto", "DM Sans", "Hind Siliguri"), so every existing literal font-family
// string (inline styles, Leaflet popups) + Tailwind aliases keep working unchanged.
// Only the weights actually used in the UI are imported (audited: 400-800).
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/600.css";
import "@fontsource/roboto/700.css";
import "@fontsource/roboto/800.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/dm-sans/800.css";
import "@fontsource/hind-siliguri/400.css"; // Bangla (data-lang="bn")
import "@fontsource/hind-siliguri/500.css";
import "@fontsource/hind-siliguri/600.css";
import "@fontsource/hind-siliguri/700.css";
import "../styles/globals.css";
import "leaflet/dist/leaflet.css";
import { I18nextProvider } from "react-i18next";
import i18n from "../lib/i18n";
import { AuthProvider } from "../context/AuthContext";
import { ToastProvider } from "../context/ToastContext";
import { NavbarProvider } from "../context/NavbarContext";
import { LanguageProvider } from "../context/LanguageContext";
import Navbar from "../components/Navbar";
import BottomNavBar from "../components/BottomNavBar";
import { useNavbar } from "../context/NavbarContext";
import AuthModal from "../components/Auth/AuthModal";
import DonateModal from "../components/DonateModal";
import VetRegisterModal from "../components/Auth/VetRegisterModal";
import OfflineIndicator from "../components/OfflineIndicator";
import CustomChatLauncher from "../components/CustomChatLauncher";
import InstallPrompt from "../components/InstallPrompt";
import ErrorBoundary from "../components/ErrorBoundary";
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";
import { useEffect } from "react";

function AppContent({ Component, pageProps }) {
  const {
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
    closeVetReg,
  } = useNavbar();

  return (
    <ErrorBoundary>
      <Navbar
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenAuth={openAuth}
        onOpenDonate={openDonate}
      />
      <Component {...pageProps} />
      <BottomNavBar />
      <AuthModal open={authOpen} defaultTab={authTab} onClose={closeAuth} />
      <DonateModal open={donateOpen} onClose={closeDonate} />
      <VetRegisterModal open={vetRegOpen} onClose={closeVetReg} />
    </ErrorBoundary>
  );
}

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('SW registration failed:', err);
      });
    }
    const handleOffline = () => {
      document.documentElement.style.setProperty('--offline-mode', '1');
    };
    const handleOnline = () => {
      document.documentElement.style.setProperty('--offline-mode', '0');
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <ToastProvider>
          <LanguageProvider>
            <NavbarProvider>
              <OfflineIndicator />
              <AppContent Component={Component} pageProps={pageProps} />
              <Analytics />
              {/* Configure Tawk before the embed loads. The default bubble is
                  hidden (onLoad -> hideWidget + CSS) and replaced by the compact
                  CustomChatLauncher below, which is smaller on mobile. */}
              <Script
                id="tawk-config"
                strategy="beforeInteractive"
                dangerouslySetInnerHTML={{
                  __html: `window.Tawk_API=window.Tawk_API||{};window.Tawk_API.customStyle={visibility:{desktop:{position:'br',xOffset:20,yOffset:90},mobile:{position:'br',xOffset:10,yOffset:90}}};`,
                }}
              />
              <Script
                id="tawk-to"
                strategy="afterInteractive"
                src="https://embed.tawk.to/6a1eff9f23ea7d1c2c9542a4/1jq4hd2ga"
              />
              <CustomChatLauncher />
              <InstallPrompt />
            </NavbarProvider>
          </LanguageProvider>
        </ToastProvider>
      </AuthProvider>
    </I18nextProvider>
  );
}
