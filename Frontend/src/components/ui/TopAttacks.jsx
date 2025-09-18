"use client";
import React from "react";

export default function TopAttacks({ attacks }) {
  return (
    <div className="absolute top-4 right-4 bg-black bg-opacity-70 border border-gray-800 rounded-lg p-4 w-80 max-h-[60vh] overflow-y-auto text-sm text-white">
      <h2 className="text-purple-400 font-semibold mb-2">⚡ Recent Attacks</h2>
      <ul className="space-y-2">
        {attacks.map((attack) => (
          <li
            key={attack.id}
            className="flex justify-between items-center border-b border-gray-700 pb-1"
          >
            <div>
              <span className="font-medium">{attack.origin}</span> →{" "}
              <span className="font-medium">{attack.target}</span>
              <div className="text-xs text-gray-400">{attack.time}</div>
            </div>
            <span className={`${attack.severityColor} text-xs font-bold`}>
              {attack.severity}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
