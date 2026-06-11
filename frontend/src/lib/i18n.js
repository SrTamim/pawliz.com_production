import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// ─── English (bundled — zero HTTP, zero flash on load) ───────────────────────
import enCommon from "../../public/locales/en/common.json";
import enAuth from "../../public/locales/en/auth.json";
import enHome from "../../public/locales/en/home.json";
import enPets from "../../public/locales/en/pets.json";
import enLostFound from "../../public/locales/en/lostfound.json";
import enVet from "../../public/locales/en/vet.json";
import enProfile from "../../public/locales/en/profile.json";

// ─── Bengali (bundled — instant switch, no HTTP request) ─────────────────────
import bnCommon from "../../public/locales/bn/common.json";
import bnAuth from "../../public/locales/bn/auth.json";
import bnHome from "../../public/locales/bn/home.json";
import bnPets from "../../public/locales/bn/pets.json";
import bnLostFound from "../../public/locales/bn/lostfound.json";
import bnVet from "../../public/locales/bn/vet.json";
import bnProfile from "../../public/locales/bn/profile.json";

i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: enCommon,
      auth: enAuth,
      home: enHome,
      pets: enPets,
      lostfound: enLostFound,
      vet: enVet,
      profile: enProfile,
    },
    bn: {
      common: bnCommon,
      auth: bnAuth,
      home: bnHome,
      pets: bnPets,
      lostfound: bnLostFound,
      vet: bnVet,
      profile: bnProfile,
    },
  },
  lng: "en",
  fallbackLng: "en",
  defaultNS: "common",
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;
