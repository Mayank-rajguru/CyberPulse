let socket = null;
const listeners = new Set()
let shouldReconnect = true; // Add this flag
let reconnectAttempts = 0;   // Add this counter

const handlers = {
 attack: (data) => {
  console.log("Attack event:", data);

  listeners.forEach((cb) => cb(data));
},
  top_targets: (data) => {
    console.log("Top targets:", data);
    // Add actual handling here
  },
  layer7_summary: (data) => {
    console.log("Layer7 summary:", data);
    // Add actual handling here
  },
  heartbeat: (data) => {
    console.log("💓 Heartbeat:", data.time);
    reconnectAttempts = 0; // Reset on successful heartbeat
  },
};

export const subscribeToAttacks = (callback) => {
  listeners.add(callback);

  return () => {
    listeners.delete(callback);
  };
};

export const connectWebSocket = () => {
  // Prevent multiple connections
  if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
    console.log("WebSocket already connected/connecting");
    return;
  }

  try {
    shouldReconnect = true; // Enable reconnection
    socket = new WebSocket("ws://localhost:8000/ws/attacks");

    socket.onopen = () => {
      console.log("✅ Connected to WebSocket server");
      reconnectAttempts = 0;
    };

    socket.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (err) {
        console.warn("⚠️ Failed to parse:", event.data);
        return;
      }
      const type = data.type;
      handlers[type]?.(data);
    };

    socket.onclose = (event) => {
      console.log("❌ WebSocket connection closed.", event.code, event.reason);
      
      // Only reconnect if it should reconnect AND it wasn't a normal closure
      if (shouldReconnect && event.code !== 1000 && reconnectAttempts < 5) {
        reconnectAttempts++;
        console.log(`Retrying in 3s... (attempt ${reconnectAttempts})`);
        setTimeout(connectWebSocket, 3000);
      }
    };

    socket.onerror = (err) => console.error("⚠️ WebSocket error:", err);
  } catch (e) {
    console.error("⚠️ WebSocket failed:", e);
  }
};

export const disconnectWebSocket = () => {
  shouldReconnect = false; // Disable reconnection
  if (socket) {
    socket.close(1000, "Manual disconnect"); // Normal closure
  }
};