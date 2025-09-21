"use client";
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useGlobe, { DEFAULT_CAMERA } from "../hooks/useGlobe";
import { connectWebSocket, disconnectWebSocket } from "../services/socket.js";
import cities from "../data/cities.json";
import RadarSummaryCharts from "./ui/RadarSummaryCharts";

export default function GlobeVisualization() {
  const globeRef = useRef(null);
  const [uiOpened, setUiOpened] = useState(false);
  const [search, setSearch] = useState("");
  const [filteredCities, setFilteredCities] = useState([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const {
    initialize,
    recentAttacks,
    setPointOfView,
    focusOnCity,
    stopRotation,
    resumeRotation,
  } = useGlobe({
    containerRef: globeRef,
    connectSocket: connectWebSocket,
  });

  const stats = {
    totalAttacks: recentAttacks.length,
    activeConnections: recentAttacks.length,
  };

  // Initialize globe
  useEffect(() => {
    initialize();
    setTimeout(() => setPointOfView(DEFAULT_CAMERA, 0), 100);
    return () => disconnectWebSocket();
  }, [initialize, setPointOfView]);

  // Search filtering
  useEffect(() => {
    if (!search || search.length < 2) return setFilteredCities([]);
    const term = search.toLowerCase();
    setFilteredCities(
      cities
        .filter(
          (c) =>
            c.city.toLowerCase().includes(term) ||
            c.country.toLowerCase().includes(term)
        )
        .sort((a, b) => {
          const aExact = a.city.toLowerCase().startsWith(term);
          const bExact = b.city.toLowerCase().startsWith(term);
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;
          return a.city.localeCompare(b.city);
        })
        .slice(0, 8)
    );
  }, [search]);

  const handleFocusCity = (cityObj) => {
    setSearch(cityObj.city);
    stopRotation();
    setFilteredCities([]);
    setUiOpened(true);
    setIsSearchFocused(false);
    focusOnCity({
      lat: cityObj.lat,
      lng: cityObj.lng,
      altitude: cityObj.alt || 0.5,
      cityId: `${cityObj.city}-${cityObj.country}`,
    });
  };

  const handleOpenRealtime = () => {
    setUiOpened(true);
    setPointOfView(DEFAULT_CAMERA, 1000);
    resumeRotation();
  };

  const handleCloseUI = () => {
    setUiOpened(false);
    setSearch("");
    setPointOfView(DEFAULT_CAMERA, 900);
    resumeRotation();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && filteredCities.length > 0) {
      handleFocusCity(filteredCities[0]);
    } else if (e.key === "Escape") {
      setSearch("");
      setIsSearchFocused(false);
    }
  };

  const getSeverityColor = (value) =>
    value > 0.8
      ? "text-red-400 bg-red-900/30"
      : value > 0.6
      ? "text-orange-400 bg-orange-900/30"
      : value > 0.4
      ? "text-yellow-400 bg-yellow-900/30"
      : "text-green-400 bg-green-900/30";

  const getSeverityLabel = (value) =>
    value > 0.8
      ? "CRITICAL"
      : value > 0.6
      ? "HIGH"
      : value > 0.4
      ? "MEDIUM"
      : "LOW";

  return (
    <div className="relative min-h-screen bg-black overflow-hidden flex flex-col">
      {/* Background grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
      linear-gradient(rgba(147, 51, 234, 0.12) 1px, transparent 1px),
      linear-gradient(90deg, rgba(147, 51, 234, 0.12) 1px, transparent 1px)
    `,
          backgroundSize: "60px 60px",
          animation: "grid-move 40s linear infinite",
          maskImage:
            "radial-gradient(circle at center, rgba(0,0,0,1), transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(circle at center, rgba(0,0,0,1), transparent 80%)",
        }}
      />

      {/* CyberPulse text behind globe */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <motion.h1
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{
            opacity: [0.75, 0.9, 0.75], // smooth breathing effect
            scale: [1, 1.015, 1], // very subtle scale
          }}
          transition={{
            duration: 6, // slower, elegant pulse
            ease: "easeInOut",
            repeat: Infinity,
          }}
          className="text-[6rem] md:text-[10rem] lg:text-[14rem] font-black tracking-wider 
               bg-gradient-to-r from-violet-500 via-fuchsia-400 to-cyan-400 
               bg-clip-text text-transparent select-none -translate-y-10"
        >
          CyberPulse
        </motion.h1>
      </div>

      {/* Globe Container */}
      <motion.div
        initial={{ translateY: "50vh", scale: 1.5, opacity: 0 }}
        animate={{
          translateY: uiOpened ? "0vh" : "50vh",
          scale: uiOpened ? 1 : 1.5,
          opacity: 1,
        }}
        transition={{ duration: 1.2 }}
        className="absolute top-0 left-0 right-0 bottom-0 z-20"
      >
        <div className="relative w-full h-full">
          {/* Animated Blur Layer */}
          <AnimatePresence>
            {uiOpened && (
              <motion.div
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
                className="absolute inset-0 bg-black/50 backdrop-blur-lg z-0"
              />
            )}
          </AnimatePresence>

          {/* Globe stays crisp */}
          <div ref={globeRef} className="relative w-full h-full z-10" />
        </div>
      </motion.div>

      {/* Top Search HUD */}
      <div className="absolute top-6 left-6 z-50">
        <div className="relative">
          <input
            type="text"
            value={search}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            onKeyDown={handleKeyDown}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cities worldwide..."
            className="px-4 py-2 w-72 rounded-lg bg-gray-900/80 text-white outline-none border border-purple-500/30 focus:border-purple-400"
          />
          {filteredCities.length > 0 && (
            <ul className="absolute top-full left-0 w-full mt-2 bg-gray-800/95 backdrop-blur-sm border border-purple-500/30 rounded-lg shadow-2xl z-50 overflow-hidden">
              {filteredCities.map((c) => (
                <li
                  key={`${c.city}-${c.lat}`}
                  onClick={() => handleFocusCity(c)}
                  className="px-4 py-2 text-white hover:bg-purple-700/50 cursor-pointer"
                >
                  {c.city}, {c.country}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {/* bg-gradient-to-t from-black via-black/60 to-transparent */}
      {/* Bottom Realtime Button */}
      <div className="absolute bottom-0 left-0 w-full z-30 flex justify-center mb-8 pointer-events-none">
        <div className="relative pointer-events-auto">
          <div className="absolute bottom-0 w-full h-32 pointer-events-none" />
          <button
            onClick={uiOpened ? handleCloseUI : handleOpenRealtime}
            className="relative px-8 py-4 bg-purple-700 text-white rounded-xl font-semibold shadow-2xl hover:bg-purple-800 transition"
          >
            {uiOpened ? "Close Realtime Monitor" : "Launch Realtime Monitor"}
          </button>
        </div>
      </div>

      {/* Realtime Panel */}
        <RadarSummaryCharts />
      <AnimatePresence>
        {uiOpened && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-30 pointer-events-none"
              onClick={handleCloseUI}
            />
            <motion.aside
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: "0%", opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 h-full w-96 
             bg-gray-900/95 backdrop-blur-md 
             border-l border-purple-500/30 z-40 
             flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-gray-700/50 flex justify-between items-center">
                <h3 className="text-white text-xl font-bold">
                  Realtime Analytics
                </h3>
                <button
                  onClick={handleCloseUI}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {recentAttacks.length === 0 ? (
                  <p className="text-gray-400 text-center mt-10">
                    Monitoring for cyber threats...
                  </p>
                ) : (
                  recentAttacks.map((attack) => (
                    <div
                      key={attack.id}
                      className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/50"
                    >
                      <div className="flex justify-between items-center text-white font-medium">
                        {attack.origin} → {attack.target}
                        <span
                          className={`px-2 py-0.5 text-xs rounded ${getSeverityColor(
                            attack.value
                          )}`}
                        >
                          {getSeverityLabel(attack.value)}
                        </span>
                      </div>
                      <div className="text-gray-400 text-xs mt-1">
                        Value: {attack.value.toFixed(3)}
                      </div>
                      <div className="w-full h-1 bg-gray-700 rounded mt-1">
                        <div
                          className={`h-1 rounded-full ${
                            attack.value > 0.8
                              ? "bg-red-500"
                              : attack.value > 0.6
                              ? "bg-orange-500"
                              : attack.value > 0.4
                              ? "bg-yellow-500"
                              : "bg-green-500"
                          }`}
                          style={{ width: `${attack.value * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <style jsx>{`
        @keyframes grid-move {
          0% {
            transform: translate(0, 0);
          }
          100% {
            transform: translate(50px, 50px);
          }
        }
      `}</style>
    </div>
  );
}
