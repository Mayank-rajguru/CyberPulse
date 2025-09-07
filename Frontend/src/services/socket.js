let socket;

export const connectWebSocket = (onMessage) => {
  socket = new WebSocket("ws://localhost:8000/ws/attacks");

  socket.onopen = () => {
    console.log("✅ Connected to WebSocket server");
  };

  socket.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    onMessage(data);
    console.log("Data Fetched");
  } catch (err) {
    console.error("⚠️ Failed to parse WebSocket message:", event.data, err);
  }
};


  socket.onclose = () => {
    console.log("❌ WebSocket connection closed");
  };

  socket.onerror = (err) => {
    console.error("⚠️ WebSocket error:", err);
  };
};

export const disconnectWebSocket = () => {
  if (socket) {
    socket.close();
  }
};
