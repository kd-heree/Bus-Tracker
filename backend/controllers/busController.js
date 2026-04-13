const fs = require('fs');
const path = require('path');

const busesPath = path.join(__dirname, '../data/buses.json');

const getBuses = () => JSON.parse(fs.readFileSync(busesPath, 'utf8'));

const saveBuses = (data) => fs.writeFileSync(busesPath, JSON.stringify(data, null, 4));

exports.getAllBuses = (req, res) => {
    const buses = getBuses();
    res.json({ success: true, buses });
};

exports.getBusById = (req, res) => {
    const buses = getBuses();
    const bus = buses.find(b => b.id === req.params.busId);
    if(bus) {
        res.json({ success: true, bus });
    } else {
        res.status(404).json({ success: false, message: 'Bus not found' });
    }
};

exports.searchRoutes = (req, res) => {
    const { from, to } = req.query;
    if(!from || !to) {
        return res.status(400).json({ success: false, message: "Missing from or to parameters" });
    }
    
    // Check if there are any exact matches in existing buses
    const startQ = from.trim().toLowerCase();
    const endQ = to.trim().toLowerCase();
    
    // To allow partial match, we can just use includes or a regex, but here let's assume they search by city name mostly
    // Start by checking if existing route is sufficient
    let buses = getBuses();
    
    // We will extract just the city name from long nominatim addresses like "Kolkata, West Bengal, India" -> "Kolkata"
    const extractCity = (str) => str.split(',')[0].trim();
    const fromCity = extractCity(from);
    const toCity = extractCity(to);

    const matches = buses.filter(b => 
        b.start.toLowerCase().includes(fromCity.toLowerCase()) && 
        b.end.toLowerCase().includes(toCity.toLowerCase())
    );
    
    if (matches.length > 0) {
        return res.json({ success: true, routes: matches });
    }
    
    // If no match found, let's dynamically generate two buses for this new route
    const busTypes = ["Volvo A/C Sleeper", "Scania Multi-Axle", "BharatBenz Seater", "Electric Seater A/C"];
    const basePrice = Math.floor(Math.random() * 800) + 400; // 400 to 1200
    
    const newBuses = [
        {
            id: "BUS-" + Math.floor(10000 + Math.random() * 90000),
            routeStr: `${fromCity} ↔ ${toCity}`,
            start: fromCity,
            end: toCity,
            time: "09:30:00",
            status: "Scheduled",
            type: busTypes[Math.floor(Math.random() * busTypes.length)],
            price: basePrice,
            capacity: 40
        },
        {
            id: "BUS-" + Math.floor(10000 + Math.random() * 90000),
            routeStr: `${fromCity} ↔ ${toCity}`,
            start: fromCity,
            end: toCity,
            time: "21:00:00",
            status: "Scheduled",
            type: busTypes[Math.floor(Math.random() * busTypes.length)],
            price: basePrice - 100 > 300 ? basePrice - 100 : basePrice + 150,
            capacity: 35
        }
    ];
    
    // Append to buses.json
    buses = buses.concat(newBuses);
    saveBuses(buses);
    
    res.json({ success: true, routes: newBuses });
};

exports.createBus = (req, res) => {
    const buses = getBuses();
    const newBus = { ...req.body };
    if(!newBus.id) {
        newBus.id = "BUS-" + Math.floor(10000 + Math.random() * 90000);
    }
    buses.push(newBus);
    saveBuses(buses);
    res.json({ success: true, bus: newBus });
};

exports.updateBus = (req, res) => {
    const buses = getBuses();
    const index = buses.findIndex(b => b.id === req.params.busId);
    if(index === -1) return res.status(404).json({ success: false, message: 'Bus not found' });
    
    buses[index] = { ...buses[index], ...req.body };
    saveBuses(buses);
    res.json({ success: true, bus: buses[index] });
};

exports.deleteBus = (req, res) => {
    let buses = getBuses();
    const initLen = buses.length;
    buses = buses.filter(b => b.id !== req.params.busId);
    if(buses.length === initLen) return res.status(404).json({ success: false, message: 'Bus not found' });
    
    saveBuses(buses);
    res.json({ success: true });
};
