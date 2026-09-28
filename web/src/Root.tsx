import { useEffect, useState } from "react";
import App from "./App";
import Guide from "./Guide";
import { GUIDE_PLATFORMS } from "./guideContent";

const GUIDE_HASHES = new Set(["guide", "getting-started", ...GUIDE_PLATFORMS.map((p) => p.id)]);

function isGuideHash(hash: string): boolean {
  const id = hash.replace(/^#/, "");
  return id === "guide" || GUIDE_HASHES.has(id);
}

export default function Root() {
  const [showGuide, setShowGuide] = useState(() =>
    typeof window !== "undefined" ? isGuideHash(window.location.hash) : false
  );

  useEffect(() => {
    function sync() {
      setShowGuide(isGuideHash(window.location.hash));
    }
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return showGuide ? <Guide /> : <App />;
}
