import React from "react";

export default function GlobeControls({ onOpenRealtime, onFocusCity }) {
  return (
    <div className="absolute top-6 left-6 z-50 flex flex-col gap-2">
      <button
        onClick={onOpenRealtime}
        className="px-4 py-2 bg-purple-600 text-white rounded shadow hover:bg-purple-700 transition"
      >
        Realtime Analytics
      </button>

      <div className="mt-2 bg-black/50 backdrop-blur rounded p-2">
        <div className="text-xs text-gray-300 mb-1">Jump to city</div>
        <div className="flex gap-2">
          <button onClick={() => onFocusCity("mumbai")} className="px-3 py-1 rounded bg-gray-800 text-white">Mumbai</button>
          <button onClick={() => onFocusCity("london")} className="px-3 py-1 rounded bg-gray-800 text-white">London</button>
          <button onClick={() => onFocusCity("nyc")} className="px-3 py-1 rounded bg-gray-800 text-white">NYC</button>
        </div>
      </div>
    </div>
  );
}
