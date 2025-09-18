"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Globe from "globe.gl";
import * as THREE from "three";
import countriesJsonData from "../data/ne_110m_admin_0_countries.json";
import countries from "world-countries";

export const DEFAULT_CAMERA = { lat: 0, lng: 0, altitude: 2.5 };
const PULSE_DURATION = 1400;
const MAX_ARCS = 30;
const MAX_POINTS = 30;
const RELEASE_WINDOW = 15000;

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

export default function useGlobe({ containerRef, connectSocket }) {
  const globeRef = useRef(null);
  const globeInstance = useRef(null);
  const arcsBuffer = useRef([]);
  const pointsBuffer = useRef([]);
  const animationRef = useRef(null);
  const attackQueue = useRef([]);
  const [recentAttacks, setRecentAttacks] = useState([]);

  const getPulseColor = (v) =>
    v > 0.8 ? "#ff4d4d" : v > 0.6 ? "#ffb84d" : v > 0.4 ? "#ffff4d" : "#4dffb8";

  const getArcColor = (v) =>
    v.value > 0.8
      ? ["#ff4d4d", "#ff9999"]
      : v.value > 0.6
      ? ["#ffb84d", "#ffd699"]
      : v.value > 0.4
      ? ["#ffff4d", "#e6ff99"]
      : ["#4dffb8", "#99fff0"];

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

  const spawnAttack = (origin, target, event) => {
    const duration = calculateArcDuration(origin, target);
    const arcData = {
      startLat: origin.lat,
      startLng: origin.lng,
      endLat: target.lat,
      endLng: target.lng,
      value: Math.min(1, Math.max(0, event.value ?? 0)),
      startTime: Date.now(),
      pulseTriggered: false,
      dashAnimateTime: duration,
      arcDashInitialGap: 0,
      arcDashLength: 0,
      opacity: 1,
    };
    arcsBuffer.current.push(arcData);

    pointsBuffer.current.push({
      id: Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      lat: origin.lat,
      lng: origin.lng,
      color: getPulseColor(arcData.value),
      timestamp: Date.now(),
      maxRadius: 1.2 + (arcData.value ?? 0) * 1.0,
      currentRadius: 0.2,
      opacity: 1.0,
    });

    setRecentAttacks((prev) => [
      {
        id: Date.now() + "-" + Math.random().toString(36).slice(2, 6),
        origin: origin.name,
        target: target.name,
        value: arcData.value,
        time: new Date().toLocaleTimeString(),
      },
      ...prev.slice(0, 14),
    ]);
  };

  // Focus camera smoothly
  const setPointOfView = useCallback((pov = DEFAULT_CAMERA, ms = 1200) => {
    if (!globeInstance.current) return;
    try {
      globeInstance.current.pointOfView(
        { lat: pov.lat, lng: pov.lng, altitude: pov.altitude ?? pov.alt },
        ms
      );
    } catch (err) {
      const controls = globeInstance.current.controls();
      controls.target.set(pov.lat, pov.lng, pov.altitude ?? 2.5);
    }
  }, []);

  const focusOnCity = useCallback(
    ({ lat, lng, altitude = 0.5, pulseRadius = 6 }) => {
      setPointOfView({ lat, lng, altitude }, 1400);

      pointsBuffer.current.push({
        id: `pulse-${Date.now()}`,
        lat,
        lng,
        color: "#ff4d4d",
        timestamp: Date.now(),
        maxRadius: pulseRadius,
        currentRadius: 0.35,
        opacity: 1,
      });
    },
    [setPointOfView]
  );

  const initialize = useCallback(() => {
    if (!containerRef.current || globeRef.current) return;

    globeInstance.current = Globe()(containerRef.current)
      .width(containerRef.current.clientWidth)
      .height(containerRef.current.clientHeight)
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
      .hexPolygonsData(countriesJsonData.features)
      .hexPolygonResolution(3)
      .hexPolygonMargin(0.5)
      .hexPolygonUseDots(true)
      .hexPolygonColor(() => "#8882ff");

    globeInstance.current.scene().background = new THREE.Color(0x000000);

    const controls = globeInstance.current.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.2;
    controls.enableZoom = true;
    controls.enablePan = true;

    let lastFrame = 0;
    const animate = () => {
      const now = Date.now();
      if (now - lastFrame > 33) {
        lastFrame = now;

        // release queued attacks
        attackQueue.current = attackQueue.current.filter((item) => {
          if (now >= item.releaseTime) {
            spawnAttack(item.origin, item.target, item.event);
            return false;
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

            const MAX_LEN = 0.28;
            const GROW_END = 0.2;
            const SHRINK_START = 0.8;
            let len;
            if (p <= GROW_END) len = (p / GROW_END) * MAX_LEN;
            else if (p >= SHRINK_START)
              len = Math.max(
                0,
                (1 - (p - SHRINK_START) / (1 - SHRINK_START)) * MAX_LEN
              );
            else len = MAX_LEN;

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

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    // WebSocket
    if (connectSocket) {
      connectSocket((rawEvent) => {
        if (!rawEvent.origin?.code || !rawEvent.target?.code) return;
        const origin = countryCoords[rawEvent.origin.code.toUpperCase()];
        const target = countryCoords[rawEvent.target.code.toUpperCase()];
        if (!origin || !target) return;
        attackQueue.current.push({
          origin,
          target,
          event: rawEvent,
          releaseTime: Date.now() + Math.random() * RELEASE_WINDOW,
        });
      });
    }

    // resize handler
    const handleResize = () => {
      globeInstance.current
        .width(containerRef.current.clientWidth)
        .height(containerRef.current.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", handleResize);
    };
  }, [containerRef, connectSocket]);

  return { initialize, recentAttacks, globeRef, setPointOfView, focusOnCity };
}
