"use client";
import React, { useEffect, useRef, useState } from "react";
import Globe from "globe.gl";
import * as THREE from "three";
import countries from "world-countries";
import countriesJsonData from "../data/ne_110m_admin_0_countries.json";
import { connectWebSocket, disconnectWebSocket } from "../services/socket.js";

// Map ISO2 → coordinates
const countryCoords = {};
countries.forEach((c) => {
  if (c.cca2 && c.latlng?.length === 2) {
    countryCoords[c.cca2.toUpperCase()] = {
      lat: c.latlng[0],
      lng: c.latlng[1],
      code: c.cca2.toUpperCase(),
      name: c.name.common,
    };
  }
});

export default function GlobeVisualization() {
  const globeRef = useRef(null);
  const globeInstance = useRef(null);
  const arcsBuffer = useRef([]);
  const pointsBuffer = useRef([]);
  const animationFrameRef = useRef(null);
  const lastArcTimeMap = useRef({});
  const [recentAttacks, setRecentAttacks] = useState([]);

  // New: queue for delayed release
  const attackQueue = useRef([]);

  const PULSE_DURATION = 1400;
  const MAX_RECENT_ATTACKS = 15;
  const ARC_MIN_GAP = 800;
  const MAX_ARCS = 30;
  const MAX_POINTS = 30;
  const RELEASE_WINDOW = 15000; // release queued attacks over 15s

  const getArcColor = (v) =>
    v > 0.8
      ? ["#ff4d4d", "#ff9999"]
      : v > 0.6
      ? ["#ffb84d", "#ffd699"]
      : v > 0.4
      ? ["#ffff4d", "#e6ff99"]
      : ["#4dffb8", "#99fff0"];

  const getPulseColor = (v) =>
    v > 0.8 ? "#ff4d4d" : v > 0.6 ? "#ffb84d" : v > 0.4 ? "#ffff4d" : "#4dffb8";

  const getSeverityColor = (sev) =>
    sev === "Critical"
      ? "text-red-500"
      : sev === "High"
      ? "text-orange-400"
      : sev === "Medium"
      ? "text-yellow-400"
      : "text-green-400";

  const calculateArcDuration = (start, end) => {
    const R = 6371;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(end.lat - start.lat);
    const dLng = toRad(end.lng - start.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(start.lat)) *
        Math.cos(toRad(end.lat)) *
        Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.min(10000, 3000 + R * c * 5);
  };

  // Add an attack into arcs & pulses
  const spawnAttack = (origin, target, event) => {
    const duration = calculateArcDuration(origin, target);
    const attackData = {
      startLat: origin.lat,
      startLng: origin.lng,
      endLat: target.lat,
      endLng: target.lng,
      value: Math.min(1, Math.max(0, event.value ?? 0)),
      rank: event.rank ?? 0,
      startTime: Date.now(),
      pulseTriggered: false,
      dashAnimateTime: duration,
      opacity: 1.0,
      arcDashInitialGap: 0,
      arcDashLength: 0,
    };

    arcsBuffer.current.push(attackData);

    // origin launch pulse
    pointsBuffer.current.push({
      id: Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      lat: origin.lat,
      lng: origin.lng,
      color: getPulseColor(attackData.value),
      timestamp: Date.now(),
      maxRadius: 1.2 + (attackData.value ?? 0) * 1.0,
      currentRadius: 0.2,
      opacity: 1.0,
    });

    setRecentAttacks((prev) => [
      {
        id: Date.now() + "-" + Math.random().toString(36).slice(2, 6),
        origin: origin.name,
        origin_code: origin.code,
        target: target.name,
        target_code: target.code,
        value: attackData.value,
        rank: attackData.rank,
        time: new Date(Date.now()).toLocaleTimeString(),
        severity:
          attackData.value > 0.7
            ? "Critical"
            : attackData.value > 0.4
            ? "High"
            : "Medium",
      },
      ...prev.slice(0, MAX_RECENT_ATTACKS - 1),
    ]);
  };

  useEffect(() => {
    if (!globeRef.current) return;

    globeInstance.current = Globe()(globeRef.current)
      .width(globeRef.current.clientWidth)
      .height(globeRef.current.clientHeight)
      .showGlobe(true)
      .showGraticules(false)
      .showAtmosphere(true)
      .atmosphereColor("#460194")
      .atmosphereAltitude(0.5)
      .globeMaterial(
        new THREE.MeshPhongMaterial({
          color: 0x4927ba,
          shininess: 0.7,
          emissive: 0x220038,
          emissiveIntensity: 0.1,
        })
      )
      .arcColor(getArcColor)
      .arcStroke(0.5)
      .arcAltitude((d) => 0.12 + (d.value ?? 0) * 0.15)
      .arcCurveResolution(32)
      .arcDashInitialGap((d) => d.arcDashInitialGap ?? 0)
      .arcDashLength((d) => d.arcDashLength ?? 0.25)
      .arcDashGap(3)
      .pointsData(pointsBuffer.current)
      .pointAltitude(0.01)
      .pointRadius((p) => p.currentRadius || 0.1)
      .pointColor(
        (p) =>
          `rgba(${parseInt(p.color.slice(1, 3), 16)},${parseInt(
            p.color.slice(3, 5),
            16
          )},${parseInt(p.color.slice(5, 7), 16)},${p.opacity})`
      )
      .pointResolution(8)
      .hexPolygonsData(countriesJsonData.features)
      .hexPolygonResolution(3)
      .hexPolygonMargin(0.5)
      .hexPolygonUseDots(true)
      .hexPolygonColor(() => "#8882ff")
      .hexPolygonLabel(() => "");

    const controls = globeInstance.current.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.2;
    controls.enableZoom = true;
    controls.enablePan = true;

    // animation params
    const MAX_LEN = 0.28;
    const GROW_END = 0.2;
    const SHRINK_START = 0.8;

    let lastFrame = 0;
    const animate = () => {
      const now = Date.now();
      if (now - lastFrame > 33) {
        lastFrame = now;

        // release queued attacks gradually
        attackQueue.current = attackQueue.current.filter((item) => {
          if (now >= item.releaseTime) {
            spawnAttack(item.origin, item.target, item.event);
            return false; // remove
          }
          return true;
        });

        // update arcs
        arcsBuffer.current = arcsBuffer.current
          .filter((arc) => {
            const age = now - arc.startTime;
            const t = age / arc.dashAnimateTime;
            const p = Math.max(0, Math.min(1, t));

            if (p >= 1 && !arc.pulseTriggered) {
              arc.pulseTriggered = true;
              pointsBuffer.current.push({
                id: now + "-" + Math.random().toString(36).slice(2, 6),
                lat: arc.endLat,
                lng: arc.endLng,
                color: getPulseColor(arc.value),
                timestamp: now,
                maxRadius: 20 + (arc.value ?? 0) * 6,
                currentRadius: 1,
                opacity: 1.0,
              });
            }

            if (t > 1.15) return false;

            let len;
            if (p <= GROW_END) {
              len = (p / GROW_END) * MAX_LEN;
            } else if (p >= SHRINK_START) {
              const rem = (p - SHRINK_START) / (1 - SHRINK_START);
              len = Math.max(0, (1 - rem) * MAX_LEN);
            } else {
              len = MAX_LEN;
            }
            if (len > p) len = p;

            const start = 1 - p;
            const end = Math.min(1, start + len);

            arc.arcDashInitialGap = start;
            arc.arcDashLength = end - start;

            return true;
          })
          .slice(-MAX_ARCS);

        // update pulses
        pointsBuffer.current = pointsBuffer.current
          .filter((pt) => {
            const age = now - pt.timestamp;
            if (age > PULSE_DURATION) return false;
            const progress = age / PULSE_DURATION;
            pt.currentRadius = pt.maxRadius * progress;
            pt.opacity = 1 - progress;
            return true;
          })
          .slice(-MAX_POINTS);

        globeInstance.current?.arcsData(arcsBuffer.current);
        globeInstance.current?.pointsData(pointsBuffer.current);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    // WebSocket handler
    const handleEvent = (rawEvent) => {
      let event;
      try {
        event = typeof rawEvent === "string" ? JSON.parse(rawEvent) : rawEvent;
      } catch {
        return;
      }
      if (!event.origin?.code || !event.target?.code) return;

      const origin = countryCoords[event.origin.code.toUpperCase()];
      const target = countryCoords[event.target.code.toUpperCase()];
      if (!origin || !target) return;

      // schedule attack with random release time in next RELEASE_WINDOW
      const now = Date.now();
      const randomDelay = Math.random() * RELEASE_WINDOW;
      attackQueue.current.push({
        origin,
        target,
        event,
        releaseTime: now + randomDelay,
      });
    };

    connectWebSocket(handleEvent);

    const handleResize = () => {
      globeInstance.current
        .width(globeRef.current.clientWidth)
        .height(globeRef.current.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      disconnectWebSocket();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div className="flex gap-6 p-4 bg-gradient-to-b from-gray-900 via-black to-gray-900 min-h-screen">
      <div className="w-3/4 h-[700px] rounded-2xl shadow-2xl overflow-hidden border border-gray-800 relative bg-black">
        <div ref={globeRef} style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  );
}
