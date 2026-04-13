const fs = require('fs');
const path = require('path');

const bookingsPath = path.join(__dirname, '../data/bookings.json');
const busesPath = path.join(__dirname, '../data/buses.json');

const getBookings = () => JSON.parse(fs.readFileSync(bookingsPath, 'utf8'));
const saveBookings = (data) => fs.writeFileSync(bookingsPath, JSON.stringify(data, null, 4));

const getBuses = () => JSON.parse(fs.readFileSync(busesPath, 'utf8'));

exports.createBooking = (req, res) => {
    const { userId, busId, seats, passengerName, travelDate, travelTime } = req.body;
    
    // Strict Input presence guard
    if (!travelDate || !travelTime || !passengerName) {
        return res.status(400).json({ success: false, message: 'Missing critical booking details (Date/Time/Name)'});
    }

    const buses = getBuses();
    const bus = buses.find(b => b.id === busId);
    
    if(!bus) return res.status(404).json({ success: false, message: 'Bus not found' });

    const bookings = getBookings();
    
    const newBooking = {
        id: "TKT-" + Math.floor(100000 + Math.random() * 900000),
        userId,
        busId,
        passengerName,
        seats: parseInt(seats) || 1,
        routeStr: bus.routeStr,
        time: travelTime, // Explicit Time input mapping
        date: travelDate, // Explicit Date input mapping 
        status: "Confirmed",
        amount: bus.price * (parseInt(seats) || 1)
    };
    
    bookings.push(newBooking);
    saveBookings(bookings);
    
    res.json({ success: true, booking: newBooking });
};

exports.getUserBookings = (req, res) => {
    const { userId } = req.params;
    const bookings = getBookings();
    
    const userBookings = bookings.filter(b => b.userId === userId);
    res.json({ success: true, bookings: userBookings });
};

exports.getAllBookings = (req, res) => {
    // Admin role access point
    const bookings = getBookings();
    res.json({ success: true, bookings });
};

exports.getBusBookings = (req, res) => {
    const { busId } = req.params;
    const bookings = getBookings();
    
    const busBookings = bookings.filter(b => b.busId === busId && b.status === "Confirmed");
    const totalBookedSeats = busBookings.reduce((sum, b) => sum + (parseInt(b.seats) || 1), 0);
    
    res.json({ success: true, totalBookedSeats });
};

exports.cancelBooking = (req, res) => {
    const { bookingId } = req.params;
    const bookings = getBookings();
    
    const index = bookings.findIndex(b => b.id === bookingId);
    if(index === -1) return res.status(404).json({ success: false, message: 'Booking not found' });
    
    bookings[index].status = "Cancelled";
    saveBookings(bookings);
    
    res.json({ success: true, message: 'Booking cancelled' });
};
