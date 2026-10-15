import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Anton } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AboutModal } from "@/modules/engagement/credits/AboutModal";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const anton = Anton({
  weight: "400",
  variable: "--font-display",
  subsets: ["latin"],
});

const SITE_URL = "https://gta6mapx.com";

const GTA6_KEYWORDS = [
  // Core
  "gta 6", "gta vi", "grand theft auto 6", "grand theft auto vi",
  // Map
  "gta 6 map", "gta 6 interactive map", "gta 6 map leak", "gta 6 world map",
  "leonida map", "vice city map gta 6", "gta 6 map size", "gta 6 map locations",
  // Vehicles
  "gta 6 cars", "gta 6 vehicles", "gta 6 car list", "all gta 6 cars",
  // Locations & regions
  "gta 6 locations", "gta 6 vice city", "gta 6 leonida keys", "gta 6 grassrivers",
  "gta 6 port gellhorn", "gta 6 ambrosia", "gta 6 mount kalaga",
  // Characters & story
  "gta 6 characters", "gta 6 lucia", "gta 6 jason", "gta 6 story", "gta 6 missions",
  // Gameplay
  "gta 6 gameplay", "gta 6 trailer", "gta 6 trailer 2", "gta 6 release date",
  "gta 6 cheats", "gta 6 weapons", "gta 6 collectibles", "gta 6 secrets",
  "gta 6 easter eggs", "gta 6 stores", "gta 6 stunt jumps",
];

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "GTA6mapx — The GTA 6 Map You Can Trust",
    template: "%s | GTA6mapx",
  },
  description:
    "Interactive GTA 6 (Leonida) map with proof-labeled locations, free progress tracking, and hundreds of car, store & mission pages.",
  keywords: GTA6_KEYWORDS,
  authors: [{ name: "GTA6mapx" }],
  creator: "GTA6mapx",
  publisher: "GTA6mapx",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "GTA6mapx",
    title: "GTA6mapx — The GTA 6 Map You Can Trust",
    description:
      "Interactive GTA 6 (Leonida) map with proof-labeled locations, free progress tracking, and hundreds of car, store & mission pages.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "GTA6mapx — Interactive GTA 6 Map",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GTA6mapx — The GTA 6 Map You Can Trust",
    description:
      "Interactive GTA 6 (Leonida) map with proof-labeled locations, free progress tracking, and hundreds of car, store & mission pages.",
    images: ["/og-image.png"],
    creator: "@GTA6mapx",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} h-full antialiased`}
    >
      {/* Pre-paint settings: applies persisted theme/accent/panel before
          first paint so there is no flash-of-wrong-theme. Self-contained;
          whitelists every value (corrupt storage → defaults). */}
      <Script
        id="gta6mapx-settings-init"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var d=document.documentElement;var raw=null;try{raw=localStorage.getItem("gta6mapx:settings:v1")}catch(e){}var s=null;try{s=raw?JSON.parse(raw):null}catch(e){}var themes=["neon-mirage","midnight-outrun","sunset-boulevard"];var accents=["neon-pink","sunset-orange","electric-cyan","vice-purple","lime"];var panels=["hud","docked"];var pick=function(list,val,fb){return list.indexOf(val)>=0?val:fb};if(s&&s.version===1){d.setAttribute("data-theme",pick(themes,s.theme,"neon-mirage"));d.setAttribute("data-accent",pick(accents,s.accent,"neon-pink"));d.setAttribute("data-panel",pick(panels,s.panelStyle,"hud"))}else{d.setAttribute("data-theme","neon-mirage");d.setAttribute("data-accent","neon-pink");d.setAttribute("data-panel","hud")}}catch(e){}})();`,
        }}
      />
      <body className="min-h-full flex flex-col">
        {children}
        {/* About/credits modal lives once, at the root — opened from the
            header "About" and footer "About / Credits" entries. */}
        <AboutModal />
      </body>
    </html>
  );
}
