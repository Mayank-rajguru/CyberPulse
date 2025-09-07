"use client";
import { useEffect, useState } from "react";
import { World } from "./ui/globe";
import countries from "world-countries"; // npm install world-countries
import { connectWebSocket, disconnectWebSocket } from "../services/socket.js";

// Build lookup: ISO2 -> { lat, lng }
const countryCoords = {};
countries.forEach((c) => {
  if (c.cca2 && c.latlng) {
    countryCoords[c.cca2.toUpperCase()] = {
      lat: c.latlng[0],
      lng: c.latlng[1],
    };
  }
});

const MAX_ARCS = 50;
const RING_LIFETIME = 3000; // ms

function AttackGlobe() {
  const [arcs, setArcs] = useState([]);
  const [rings, setRings] = useState([]);

  const addAttack = (event) => {
    const origin = countryCoords[event.origin.code.toUpperCase()];
    const target = countryCoords[event.target.code.toUpperCase()];
    if (!origin || !target) return;

    const value = Math.min(1, Math.max(0, event.value ?? 0));
    const color = value > 0.7 ? "#ff0000" : value > 0.4 ? "#ff9900" : "#ffff00";

    const newArc = {
      startLat: origin.lat,
      startLng: origin.lng,
      endLat: target.lat,
      endLng: target.lng,
      color,
      arcAlt: 0.3 + value * 0.3,
      order: 1,
    };

    const newRing = {
      id: Date.now() + Math.random(),
      lat: target.lat,
      lng: target.lng,
      color,
    };

    setArcs((prev) => [...prev.slice(-MAX_ARCS), newArc]);
    setRings((prev) => [...prev.slice(-MAX_ARCS), newRing]);

    setTimeout(() => {
      setRings((prev) => prev.filter((r) => r.id !== newRing.id));
    }, RING_LIFETIME);
  };

  useEffect(() => {
    const wsHandler = (raw) => {
      let event;
      try {
        event = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch {
        return;
      }
      if (!event?.origin?.code || !event?.target?.code) return;
      addAttack(event);
    };

    connectWebSocket(wsHandler);
    return () => disconnectWebSocket();
  }, []);

  const globeConfig = {
    globeColor: "#1d072e",
    polygonsData: countries,
    polygonStrokeColor: "#111",
    polygonSideColor: "#222",
    polygonStrokeWidth: 0.3,
    polygonAltitude: 0.01,
    emissive: "#000000",
    emissiveIntensity: 0.1,
    shininess: 0.9,
    atmosphereColor: "#ffffff",
    showAtmosphere: true,
    atmosphereAltitude: 0.1,
    ambientLight: "#ffffff",
    directionalLeftLight: "#ffffff",
    directionalTopLight: "#ffffff",
    pointLight: "#ffffff",
    maxRings: 3,
    rings: 1,
    arcLength: 0.9,
    arcTime: 2000,
  };

  // Combine arcs + rings for globe
  const globeData = arcs.map((arc, i) => ({
    ...arc,
    ring: rings[i] || null,
  }));

  return (
    <div style={{ width: "100%", height: "700px" }}>
      <World globeConfig={globeConfig} data={globeData} />
    </div>
  );
}

export default AttackGlobe;
