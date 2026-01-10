"use client";

import { useEffect } from "react";

export default function TrackView({ candidate }: { candidate: any }) {
  useEffect(() => {
    if (!candidate) return;
    
    try {
      const stored = localStorage.getItem("careATS.recentlyViewed");
      const recent: any[] = stored ? JSON.parse(stored) : [];
      
      // Remove if already exists
      const filtered = recent.filter((c: any) => c.id !== candidate.id);
      
      // Add to front
      filtered.unshift({
        id: candidate.id,
        name: candidate.name,
        phone_e164: candidate.phone_e164,
        timestamp: Date.now(),
      });
      
      // Keep only 10
      const trimmed = filtered.slice(0, 10);
      
      localStorage.setItem("careATS.recentlyViewed", JSON.stringify(trimmed));
    } catch {}
  }, [candidate]);

  return null;
}