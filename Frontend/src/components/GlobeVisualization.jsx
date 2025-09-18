"use client";
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useGlobe, { DEFAULT_CAMERA } from "../hooks/useGlobe";
import { connectWebSocket, disconnectWebSocket } from "../services/socket.js";

const CITY_MAP = {
  mumbai: { lat: 19.076, lng: 72.8777, alt: 0.6 },
  london: { lat: 51.5074, lng: -0.1278, alt: 0.8 },
  nyc: { lat: 40.7128, lng: -74.006, alt: 0.8 },
};

export default function GlobeVisualization() {
  const globeRef = useRef(null); // ✅ Declare the ref first
  const [uiOpened, setUiOpened] = useState(false);

  const { initialize, recentAttacks, setPointOfView, focusOnCity } = useGlobe({
    containerRef: globeRef,
    connectSocket: connectWebSocket,
  });

  useEffect(() => {
    initialize();
    setTimeout(() => setPointOfView(DEFAULT_CAMERA, 0), 100);

    return () => disconnectWebSocket();
  }, [initialize, setPointOfView]);

  const handleOpenRealtime = () => {
    setUiOpened(true);
    setPointOfView({ lat: 0, lng: 0, altitude: 1.8 }, 1000);
  };

  const handleFocusCity = (key) => {
    const city = CITY_MAP[key];
    if (!city) return;
    if (!uiOpened) setUiOpened(true);
    focusOnCity({ lat: city.lat, lng: city.lng, altitude: city.alt });
  };

  return (
    <div className="relative min-h-screen bg-black overflow-hidden flex flex-col">
      {/* Control buttons */}
      <div className="absolute top-6 left-6 z-50 flex flex-col gap-2">
        <button
          onClick={handleOpenRealtime}
          className="px-4 py-2 rounded bg-purple-700 text-white"
        >
          Open Realtime
        </button>
        {Object.keys(CITY_MAP).map((c) => (
          <button
            key={c}
            onClick={() => handleFocusCity(c)}
            className="px-4 py-2 rounded bg-gray-800 text-white"
          >
            {c.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Globe container with framer-motion for Y-offset */}
      <motion.div
        initial={{ translateY: "40vh", scale: 1.5 }}
        animate={{ translateY: uiOpened ? "0vh" : "40vh", scale: uiOpened ? 1 : 1.5 }}
        transition={{ duration: 0.9, ease: "easeInOut" }}
        className="absolute top-0 left-0 right-0 bottom-0"
      >
        <div ref={globeRef} style={{ width: "100%", height: "100%" }} />
      </motion.div>

      {/* Realtime panel */}
      <AnimatePresence>
        {uiOpened && (
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: "0%" }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.6 }}
            className="fixed right-0 top-0 h-full w-96 bg-black/70 backdrop-blur z-40 p-6 overflow-y-auto"
          >
            <h3 className="text-white text-xl mb-3">Realtime Analytics</h3>
            <div className="space-y-2">
              {recentAttacks.map((a) => (
                <div
                  key={a.id}
                  className="p-2 border-b border-gray-700 text-white text-sm"
                >
                  <div>
                    {a.origin} → {a.target}
                  </div>
                  <div>Value: {a.value.toFixed(2)}</div>
                  <div className="text-gray-400 text-xs">{a.time}</div>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setUiOpened(false);
                setPointOfView(DEFAULT_CAMERA, 900);
              }}
              className="mt-4 px-4 py-2 bg-gray-800 text-white rounded"
            >
              Close
            </button>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
