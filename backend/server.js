// ================= IMPORTS =================
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET, protect, adminOnly } = require("./middleware/authMiddleware");

// Routes
const userRoutes = require("./routes/userRoutes");
const busRoutes = require("./routes/busRoutes");
const bookingRoutes = require("./routes/bookingRoutes");

// ================= APP SETUP =================
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// ================= REST APIS =================
app.use("/api/users", userRoutes);
app.use("/api/buses", busRoutes);
app.use("/api/bookings", bookingRoutes);

// OSRM Map Search
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
app.get("/api/search", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.trim().length < 2) return res.json([]);

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=5`,
      { headers: { "User-Agent": "SmartBusTrackingApp" } }
    );
    res.json(await response.json());
  } catch (error) {
    res.status(500).json({ error: "Search failed" });
  }
});

// ================= WEB SOCKETS (REAL-TIME SYS) =================
const activeBuses = {};

app.get("/api/activeBuses", protect, adminOnly, (req, res) => {
    res.json({ success: true, activeBuses: Object.values(activeBuses) });
});

app.put("/api/activeBuses/:id", protect, adminOnly, (req, res) => {
    const bus = activeBuses[req.params.id];
    if(!bus) return res.status(404).json({ success: false, message: "Bus not actively tracked" });
    
    if(req.body.speed !== undefined) {
        bus.speed = req.body.speed;
        bus._speedOverride = req.body.speed; 
    }
    if(req.body.capacity !== undefined) bus.capacity = req.body.capacity;
    if(req.body.type !== undefined) {
        bus.driver = bus.driver || {};
        bus.driver.type = req.body.type;
        bus.type = req.body.type; 
    }
    if(req.body.driverName !== undefined) {
        bus.driver = bus.driver || {};
        bus.driver.name = req.body.driverName;
    }
    if(req.body.driverContact !== undefined) {
        bus.driver = bus.driver || {};
        bus.driver.contact = req.body.driverContact;
    }

    res.json({ success: true, bus });
});

let nextBusId = 100;

// Multi-User Tracking State
const connectedUsers = {};
const activityLogs = [];

function broadcastAdminData() {
    io.emit("adminDataUpdate", {
        activeUsers: Object.values(connectedUsers),
        activityLogs: activityLogs
    });
}

// Haversine formula calculation for real map distances
function calcDist(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error: Token missing'));
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error('Authentication error: Invalid token'));
        
        const usersPath = path.join(__dirname, './data/users.json');
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const user = users.find(u => u.id === decoded.id);
        
        if (!user) return next(new Error('Authentication error: User not found'));

        const { password, ...safeUser } = user;
        socket.user = safeUser;
        next();
    });
});

io.on("connection", (socket) => {
  console.log("Client connecting to sync server:", socket.id);

  // Distribute state of moving buses
  socket.emit("busLocations", Object.values(activeBuses).map(b => ({
      id: b.id, lat: b.lat, lng: b.lng, driver: b.driver, passengers: b.passengers
  })));

  // Creates an anonymous active bus based on frontend custom route selection
  // In a completely real app, this would be bound to buses.json, but we will allow dynamic ones
  socket.on("newRoute", (data, callback) => {
    let busId = data.presetId || ("EXP-" + (nextBusId++));
    
    const driverNames = ["Rajesh Kumar", "Amit Singh", "Suresh Sharma", "Vikram Patel", "Manoj Tiwari"];
    const driver = {
        name: driverNames[Math.floor(Math.random() * driverNames.length)],
        contact: "+91 " + Math.floor(1000000000 + Math.random() * 9000000000),
        rating: (4.0 + Math.random()).toFixed(1) + " / 5.0",
        type: data.type || "Volvo A/C Sleeper"
    };

    activeBuses[busId] = {
      id: busId,
      lat: data.route[0]?.lat || 28.6139,
      lng: data.route[0]?.lng || 77.2090,
      route: data.route || [],
      routeIndex: 0,
      departureTime: data.departureTime || null,
      driver: driver,
      speed: 0,
      // Create stop indices for logic
      stopIndices: [0, Math.floor((data.route || []).length / 2), (data.route || []).length - 1],
      stopNames: ["Origin", "Intermediate Transit", "Destination"]
    };

    console.log(`[SYNC] Tracking started for Bus: ${busId}`);
    if (callback) callback({ busId });
  });

  // --- MULTI-USER TRACKING ---
  socket.on("userConnected", () => {
    const userData = socket.user;
    connectedUsers[socket.id] = { ...userData, socketId: socket.id, status: 'Online', connectedAt: new Date().toISOString() };
    console.log(`[USER SYNC] User connected: ${userData.name} (${userData.email})`);
    
    activityLogs.unshift({ timestamp: new Date().toISOString(), user: userData.name, action: "Logged in to the system", type: "info" });
    if(activityLogs.length > 100) activityLogs.pop();

    broadcastAdminData();
  });

  socket.on("userAction", (actionDescription) => {
    const user = socket.user || { name: "Unknown User" };
    activityLogs.unshift({ timestamp: new Date().toISOString(), user: user.name, action: actionDescription, type: "action" });
    if(activityLogs.length > 100) activityLogs.pop();
    broadcastAdminData();
  });

  socket.on("disconnect", () => {
    const user = connectedUsers[socket.id];
    if (user) {
        console.log(`[USER SYNC] User disconnected: ${user.name}`);
        activityLogs.unshift({ timestamp: new Date().toISOString(), user: user.name, action: "Logged out/Disconnected", type: "warning" });
        if(activityLogs.length > 100) activityLogs.pop();
        delete connectedUsers[socket.id];
        broadcastAdminData();
    }
  });

});

// Physical simulation heartbeat
setInterval(() => {
  const now = Date.now();
  const busesToEmit = [];

  for (let busId in activeBuses) {
      const bus = activeBuses[busId];
      if (!bus.route.length || !bus.departureTime) continue;

      if (now >= bus.departureTime) {
          const point = bus.route[bus.routeIndex];
          if (point) {
              bus.lat = point.lat;
              bus.lng = point.lng;
          }

          bus.routeIndex++;

          // Restart route logic seamlessly
          if (bus.routeIndex >= bus.route.length) bus.routeIndex = 0;

          // Calculate realistic speed (km/h) with some variance
          if (bus._speedOverride) {
              bus.speed = bus._speedOverride;
          } else if (bus.routeIndex > 0) {
              const prevSpeed = bus.speed || 45;
              bus.speed = Math.max(30, Math.min(80, prevSpeed + (Math.floor(Math.random() * 7) - 3)));
          } else {
              bus.speed = 45;
          }
      }
      
      // Calculate actual passenger count from database
      let actualPassengers = 0;
      try {
          const bookings = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/bookings.json'), 'utf8'));
          actualPassengers = bookings
              .filter(b => b.busId === bus.id && b.status === "Confirmed")
              .reduce((sum, b) => sum + (parseInt(b.seats) || 1), 0);
      } catch (e) {
          console.error("Error reading bookings for passenger count", e);
      }
      bus.passengers = actualPassengers;
      
      // ==== NEW: DISTANCE & ETA LOGIC ====
      let remainingDistanceToTarget = 0;
      let isFinalDestination = (bus.routeIndex >= bus.route.length - 2);
      
      // Compute total remaining route distance
      for(let i = bus.routeIndex; i < bus.route.length - 1; i++) {
          remainingDistanceToTarget += calcDist(bus.route[i].lat, bus.route[i].lng, bus.route[i+1].lat, bus.route[i+1].lng);
      }
      
      // Dynamic ETA Formula
      const etaMins = (bus.speed > 0) ? Math.round((remainingDistanceToTarget / bus.speed) * 60) : 0;
      
      // Baseline Expected Check (simulated as avg 40km/h expected)
      const expectedEta = Math.round((remainingDistanceToTarget / 40) * 60);
      let statusLevel = "🔴 Delayed";
      if(etaMins <= expectedEta) statusLevel = "🟢 On Time";
      else if(etaMins <= expectedEta + 5) statusLevel = "🟡 Slight Delay";
      
      // Determine Next Logical Stop
      let nextStopName = "Destination";
      let nextStopDist = 0;
      
      if(bus.routeIndex < bus.stopIndices[1]) {
          nextStopName = bus.stopNames[1];
          for(let i = bus.routeIndex; i < bus.stopIndices[1] && i < bus.route.length - 1; i++) {
              nextStopDist += calcDist(bus.route[i].lat, bus.route[i].lng, bus.route[i+1].lat, bus.route[i+1].lng);
          }
      } else {
          nextStopName = bus.stopNames[2];
          nextStopDist = remainingDistanceToTarget;
      }
      
      if(isFinalDestination) {
          nextStopDist = 0;
      }
      
      busesToEmit.push({ 
          id: bus.id, lat: bus.lat, lng: bus.lng, 
          driver: bus.driver, passengers: bus.passengers, speed: bus.speed,
          distanceLeft: remainingDistanceToTarget,
          etaMins: isFinalDestination ? 0 : Math.max(1, etaMins),
          nextStopName: nextStopName,
          nextStopDist: isFinalDestination ? 0 : Math.max(0.1, nextStopDist),
          statusLevel: statusLevel,
          stopsForMap: bus.stopIndices.map(s => bus.route[s])
      });
      
      // Random push notifications to sockets mimicking delay checks
      if(bus.routeIndex % 200 === 0 && Math.random() > 0.8) {
          io.emit('broadcastAlert', { busId: bus.id, message: "Driver reported slight delay up ahead.", type: "warning" });
      } else if (bus.routeIndex % 300 === 0 && Math.random() > 0.6) {
          io.emit('broadcastAlert', { busId: bus.id, message: "Approaching major terminal.", type: "info" });
      }
  }

  if (busesToEmit.length > 0) {
      io.emit("busLocations", busesToEmit);
  }
}, 800);

// ================= SERVER START =================
server.listen(3000, () => {
  console.log("==========================================");
  console.log("✅ REAL-TIME INTEGRATED SYSTEM ALIVE");
  console.log("▶  PORT: 3000");
  console.log("==========================================");
});