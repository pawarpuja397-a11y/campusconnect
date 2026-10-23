// CampusConnect - Student Module
// Merged with Python Flask Backend & SQLite Database (with LocalStorage fallback)

const API_BASE = window.location.origin.includes('5000') 
    ? '/api' 
    : 'http://127.0.0.1:5000/api';

// ---------------- SHARED STORAGE KEYS ----------------
const EVENTS_KEY = "campusConnectEvents";
const STUDENTS_KEY = "campusConnectStudents";
const CURRENT_USER_KEY = "campusConnectCurrentUser";
const REGISTRATIONS_KEY = "registeredEvents";

const defaultEvents = [
    {
        id: "event1",
        title: "Campus Code Fest",
        name: "Campus Code Fest",
        category: "Technical",
        description: "Take part in coding challenges and show your programming skills.",
        date: "2026-11-15",
        time: "10:00 AM",
        venue: "Computer Lab",
        organizer: "Computer Science Department",
        seats: 50
    },
    {
        id: "event2",
        title: "Cultural Night",
        name: "Cultural Night",
        category: "Cultural",
        description: "Enjoy music, dance, performances and other cultural activities.",
        date: "2026-11-20",
        time: "5:00 PM",
        venue: "College Auditorium",
        organizer: "Cultural Committee",
        seats: 100
    },
    {
        id: "event3",
        title: "Inter-College Sports Meet",
        name: "Inter-College Sports Meet",
        category: "Sports",
        description: "Participate in exciting sports competitions with other students.",
        date: "2026-11-25",
        time: "9:00 AM",
        venue: "College Sports Ground",
        organizer: "Sports Department",
        seats: 80
    },
    {
        id: "event4",
        title: "AI & Machine Learning Workshop",
        name: "AI & Machine Learning Workshop",
        category: "Technical",
        description: "Hands-on workshop on AI fundamentals, neural networks, and Python tools.",
        date: "2026-12-05",
        time: "10:00 AM",
        venue: "Auditorium Hall A",
        organizer: "Tech Club",
        seats: 60
    }
];

if (localStorage.getItem(EVENTS_KEY) === null) {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(defaultEvents));
}

// ---------------- LOCAL STORAGE HELPERS ----------------
function getEvents() {
    try {
        const savedEvents = JSON.parse(localStorage.getItem(EVENTS_KEY));
        if (!Array.isArray(savedEvents)) return defaultEvents;
        return savedEvents.map(function (item) {
            return {
                ...item,
                id: String(item.id || item.eventId || ""),
                name: item.name || item.title || "Untitled Event",
                title: item.title || item.name || "Untitled Event",
                category: item.category || "Other",
                description: item.description || "",
                date: item.date || item.event_date || "",
                time: item.time || item.event_time || "",
                venue: item.venue || "",
                organizer: item.organizer || "",
                seats: Number(item.seats ?? item.total_seats) || 0
            };
        });
    } catch (error) {
        console.error("Events load error:", error);
        return defaultEvents;
    }
}

function getStudents() {
    try {
        const students = JSON.parse(localStorage.getItem(STUDENTS_KEY));
        return Array.isArray(students) ? students : [];
    } catch (error) {
        return [];
    }
}

function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem(CURRENT_USER_KEY));
    } catch (error) {
        return null;
    }
}

function getRegistrations() {
    try {
        const registrations = JSON.parse(localStorage.getItem(REGISTRATIONS_KEY));
        return Array.isArray(registrations) ? registrations : [];
    } catch (error) {
        return [];
    }
}

function saveRegistrations(registrations) {
    localStorage.setItem(REGISTRATIONS_KEY, JSON.stringify(registrations));
}

function showMessage(elementId, message, isError = false) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.style.color = isError ? "#b52b36" : "#207245";
    }
}

// ---------------- STUDENT REGISTRATION ----------------
const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim().toLowerCase();
        const studentId = document.getElementById("studentId").value.trim();
        const department = document.getElementById("department").value;
        const year = document.getElementById("year").value;
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        if (!name || !email || !studentId || !department || !year) {
            showMessage("registerMessage", "Please fill in all fields.", true);
            return;
        }

        if (password.length < 6) {
            showMessage("registerMessage", "Password must contain at least 6 characters.", true);
            return;
        }

        if (password !== confirmPassword) {
            showMessage("registerMessage", "Passwords do not match.", true);
            return;
        }

        // Try Backend API First
        try {
            const response = await fetch(`${API_BASE}/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    student_id: studentId,
                    full_name: name,
                    name: name,
                    email: email,
                    department: department,
                    year: year,
                    password: password
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Also update local copy
                const students = getStudents();
                students.push({ name, email, studentId, department, year, password });
                localStorage.setItem(STUDENTS_KEY, JSON.stringify(students));

                showMessage("registerMessage", data.message || "Registration successful! Redirecting to login...");
                registerForm.reset();
                setTimeout(() => { window.location.href = "login.html"; }, 1200);
                return;
            } else {
                showMessage("registerMessage", data.message || "Registration failed.", true);
                return;
            }
        } catch (apiError) {
            console.log("Backend offline, falling back to LocalStorage:", apiError);
        }

        // Fallback LocalStorage Registration
        const students = getStudents();
        if (students.some(s => s.email === email)) {
            showMessage("registerMessage", "This email is already registered. Please login.", true);
            return;
        }
        if (students.some(s => s.studentId && s.studentId.toLowerCase() === studentId.toLowerCase())) {
            showMessage("registerMessage", "This enrollment number is already registered.", true);
            return;
        }

        students.push({ name, email, studentId, department, year, password });
        localStorage.setItem(STUDENTS_KEY, JSON.stringify(students));

        showMessage("registerMessage", "Registration successful! Redirecting to login...");
        registerForm.reset();
        setTimeout(() => { window.location.href = "login.html"; }, 1200);
    });
}

// ---------------- STUDENT LOGIN ----------------
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("loginEmail").value.trim().toLowerCase();
        const password = document.getElementById("loginPassword").value;

        // Try Backend API First
        try {
            const response = await fetch(`${API_BASE}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok && data.success && data.student) {
                localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({
                    email: data.student.email,
                    name: data.student.name || data.student.full_name,
                    studentId: data.student.studentId || data.student.student_id
                }));
                window.location.href = "student-dashboard.html";
                return;
            } else {
                showMessage("loginMessage", data.message || "Invalid email or password. Please try again.", true);
                return;
            }
        } catch (apiError) {
            console.log("Backend offline, checking LocalStorage:", apiError);
        }

        // Fallback LocalStorage Login
        const students = getStudents();
        const student = students.find(s => s.email === email && s.password === password);

        if (!student) {
            showMessage("loginMessage", "Invalid email or password. Please try again.", true);
            return;
        }

        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({
            email: student.email,
            name: student.name,
            studentId: student.studentId
        }));

        window.location.href = "student-dashboard.html";
    });
}

// ---------------- STUDENT LOGOUT ----------------
const logoutButton = document.getElementById("logoutBtn");

if (logoutButton) {
    logoutButton.addEventListener("click", function (event) {
        event.preventDefault();
        localStorage.removeItem(CURRENT_USER_KEY);
        window.location.href = "login.html";
    });
}

// ---------------- DASHBOARD EVENTS ----------------
let cachedEventsList = getEvents();

function displayEvents(eventList) {
    const eventContainer = document.getElementById("eventContainer");
    if (!eventContainer) return;

    eventContainer.innerHTML = "";

    if (!eventList || eventList.length === 0) {
        eventContainer.innerHTML = "<p>No events found.</p>";
        return;
    }

    eventList.forEach(function (item) {
        const card = document.createElement("div");
        card.className = "event-card";

        const category = document.createElement("span");
        category.className = "event-category";
        category.textContent = item.category || "Event";

        const heading = document.createElement("h3");
        heading.textContent = item.name || item.title;

        const description = document.createElement("p");
        description.textContent = item.description || "";

        const date = document.createElement("p");
        date.innerHTML = "<strong>Date:</strong> ";
        date.appendChild(document.createTextNode(item.date || "TBA"));

        const time = document.createElement("p");
        time.innerHTML = "<strong>Time:</strong> ";
        time.appendChild(document.createTextNode(item.time || "TBA"));

        const venue = document.createElement("p");
        venue.innerHTML = "<strong>Venue:</strong> ";
        venue.appendChild(document.createTextNode(item.venue || "Campus"));

        const detailsLink = document.createElement("a");
        detailsLink.href = "event-details.html?event=" + encodeURIComponent(item.id || item.name);
        detailsLink.className = "details-btn";
        detailsLink.textContent = "View Details";

        card.appendChild(category);
        card.appendChild(heading);
        card.appendChild(description);
        card.appendChild(date);
        card.appendChild(time);
        card.appendChild(venue);
        card.appendChild(detailsLink);

        eventContainer.appendChild(card);
    });
}

function filterEvents() {
    const searchInput = document.getElementById("searchInput");
    const categoryFilter = document.getElementById("categoryFilter");

    const searchText = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const selectedCategory = categoryFilter ? categoryFilter.value : "All";

    const filtered = cachedEventsList.filter(function (item) {
        const eventName = (item.name || item.title || "").toLowerCase();
        const description = (item.description || "").toLowerCase();
        const venue = (item.venue || "").toLowerCase();
        const organizer = (item.organizer || "").toLowerCase();
        const category = (item.category || "").toLowerCase();

        const matchesSearch =
            eventName.includes(searchText) ||
            description.includes(searchText) ||
            venue.includes(searchText) ||
            organizer.includes(searchText);

        const matchesCategory =
            selectedCategory === "All" ||
            category === selectedCategory.toLowerCase();

        return matchesSearch && matchesCategory;
    });

    displayEvents(filtered);
}

async function loadDashboardEvents() {
    if (!document.getElementById("eventContainer")) return;

    displayEvents(cachedEventsList);

    try {
        const res = await fetch(`${API_BASE}/events`);
        if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.events)) {
                cachedEventsList = data.events.map(e => ({
                    ...e,
                    id: String(e.id || e.eventId),
                    name: e.name || e.title,
                    title: e.title || e.name
                }));
                localStorage.setItem(EVENTS_KEY, JSON.stringify(cachedEventsList));
                filterEvents();
            }
        }
    } catch (e) {
        console.log("Using cached events:", e);
    }
}

if (document.getElementById("eventContainer")) {
    loadDashboardEvents();

    const searchInput = document.getElementById("searchInput");
    const categoryFilter = document.getElementById("categoryFilter");

    if (searchInput) searchInput.addEventListener("input", filterEvents);
    if (categoryFilter) categoryFilter.addEventListener("change", filterEvents);

    window.addEventListener("storage", function (event) {
        if (event.key === EVENTS_KEY) {
            cachedEventsList = getEvents();
            filterEvents();
        }
    });
}

// ---------------- EVENT DETAILS ----------------
async function showEventDetails() {
    const eventNameElement = document.getElementById("eventName");
    if (!eventNameElement) return;

    const params = new URLSearchParams(window.location.search);
    const eventId = params.get("event");

    let selectedEvent = null;

    // Try fetching live from Backend
    try {
        const res = await fetch(`${API_BASE}/events/${encodeURIComponent(eventId)}`);
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.event) {
                selectedEvent = data.event;
            }
        }
    } catch (e) {}

    // Fallback to local
    if (!selectedEvent) {
        const localEvents = getEvents();
        selectedEvent = localEvents.find(item => item.id === eventId || item.name === eventId);
    }

    if (!selectedEvent) {
        eventNameElement.textContent = "Event Not Found";
        showMessage("eventMessage", "This event is no longer available. Please return to the dashboard.", true);
        const button = document.getElementById("registerEventBtn");
        if (button) button.disabled = true;
        return;
    }

    document.getElementById("eventName").textContent = selectedEvent.name || selectedEvent.title;
    document.getElementById("eventCategory").textContent = selectedEvent.category;
    document.getElementById("eventDescription").textContent = selectedEvent.description || "";
    document.getElementById("eventDate").textContent = selectedEvent.date;
    document.getElementById("eventTime").textContent = selectedEvent.time;
    document.getElementById("eventVenue").textContent = selectedEvent.venue;
    document.getElementById("eventOrganizer").textContent = selectedEvent.organizer || "Campus Committee";

    const availableSeats = selectedEvent.availableSeats !== undefined 
        ? selectedEvent.availableSeats 
        : Number(selectedEvent.seats || 0);

    const seatsElement = document.getElementById("eventSeats");
    if (seatsElement) seatsElement.textContent = availableSeats;

    const registerButton = document.getElementById("registerEventBtn");
    if (!registerButton) return;

    const currentUser = getCurrentUser();
    const registrations = getRegistrations();

    const alreadyRegistered = currentUser && registrations.some(r => 
        (r.eventId === String(selectedEvent.id) || r.eventId === selectedEvent.name) && r.email === currentUser.email
    );

    if (alreadyRegistered) {
        registerButton.textContent = "Already Registered";
        registerButton.disabled = true;
        showMessage("eventMessage", "You have already registered for this event.");
    } else if (availableSeats === 0) {
        registerButton.textContent = "Event Full";
        registerButton.disabled = true;
    } else {
        registerButton.disabled = false;
        registerButton.textContent = "Register for Event";
    }

    registerButton.onclick = async function () {
        const loggedInStudent = getCurrentUser();
        if (!loggedInStudent) {
            showMessage("eventMessage", "Please login before registering for an event.", true);
            setTimeout(() => { window.location.href = "login.html"; }, 1000);
            return;
        }

        registerButton.disabled = true;
        registerButton.textContent = "Registering...";

        // Try Backend API Registration
        try {
            const res = await fetch(`${API_BASE}/register-event`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: loggedInStudent.email,
                    student_id: loggedInStudent.studentId,
                    event_id: String(selectedEvent.id)
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                // Update local storage too
                const localRegs = getRegistrations();
                localRegs.push({
                    eventId: String(selectedEvent.id),
                    email: loggedInStudent.email,
                    registeredAt: new Date().toISOString()
                });
                saveRegistrations(localRegs);

                registerButton.textContent = "Already Registered";
                registerButton.disabled = true;

                if (seatsElement) {
                    seatsElement.textContent = Math.max(0, availableSeats - 1);
                }

                showMessage("eventMessage", data.message || "Registration successful! You can view it in My Events.");
                return;
            } else {
                showMessage("eventMessage", data.message || "Registration failed.", true);
                registerButton.disabled = false;
                registerButton.textContent = "Register for Event";
                return;
            }
        } catch (apiErr) {
            console.log("Backend offline, saving locally:", apiErr);
        }

        // Local Fallback Registration
        const currentRegistrations = getRegistrations();
        currentRegistrations.push({
            eventId: String(selectedEvent.id),
            email: loggedInStudent.email,
            registeredAt: new Date().toISOString()
        });
        saveRegistrations(currentRegistrations);

        registerButton.textContent = "Already Registered";
        registerButton.disabled = true;

        if (seatsElement) {
            seatsElement.textContent = Math.max(0, availableSeats - 1);
        }

        showMessage("eventMessage", "Registration successful! You can view it in My Events.");
    };
}

if (document.getElementById("eventName")) {
    showEventDetails();
}

// ---------------- MY EVENTS ----------------
async function displayMyEvents() {
    const container = document.getElementById("myEventsContainer");
    if (!container) return;

    container.innerHTML = "";
    const currentUser = getCurrentUser();

    if (!currentUser) {
        showMessage("myEventsMessage", "Please login to view your registered events.", true);
        setTimeout(() => { window.location.href = "login.html"; }, 1000);
        return;
    }

    let myEventsList = [];

    // Try fetching from Backend API
    try {
        const res = await fetch(`${API_BASE}/my-events?email=${encodeURIComponent(currentUser.email)}`);
        if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.events)) {
                myEventsList = data.events;
            }
        }
    } catch (e) {
        console.log("Backend offline, reading local registrations:", e);
    }

    // Fallback to local registrations if backend list is empty or offline
    if (myEventsList.length === 0) {
        const localRegs = getRegistrations().filter(r => r.email === currentUser.email);
        const localEvents = getEvents();

        localRegs.forEach(reg => {
            const ev = localEvents.find(e => String(e.id) === String(reg.eventId) || e.name === reg.eventId);
            if (ev) myEventsList.push(ev);
        });
    }

    if (myEventsList.length === 0) {
        container.innerHTML = "<p>You have not registered for any events yet.</p>";
        return;
    }

    myEventsList.forEach(function (eventItem) {
        const card = document.createElement("div");
        card.className = "event-card";

        const heading = document.createElement("h3");
        heading.textContent = eventItem.name || eventItem.title;

        const category = document.createElement("p");
        category.textContent = "Category: " + (eventItem.category || "General");

        const date = document.createElement("p");
        date.textContent = "Date: " + (eventItem.date || "TBA");

        const venue = document.createElement("p");
        venue.textContent = "Venue: " + (eventItem.venue || "Campus");

        const detailsLink = document.createElement("a");
        detailsLink.href = "event-details.html?event=" + encodeURIComponent(eventItem.id || eventItem.eventId);
        detailsLink.className = "details-btn";
        detailsLink.textContent = "View Details";

        const cancelButton = document.createElement("button");
        cancelButton.className = "cancel-btn";
        cancelButton.textContent = "Cancel Registration";

        cancelButton.addEventListener("click", async function () {
            // Cancel via API
            try {
                await fetch(`${API_BASE}/cancel-registration`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: currentUser.email,
                        student_id: currentUser.studentId,
                        event_id: String(eventItem.id || eventItem.eventId)
                    })
                });
            } catch (e) {}

            // Also remove from local registrations
            const updated = getRegistrations().filter(function (item) {
                return !(
                    String(item.eventId) === String(eventItem.id || eventItem.eventId) &&
                    item.email === currentUser.email
                );
            });

            saveRegistrations(updated);
            displayMyEvents();
        });

        card.appendChild(heading);
        card.appendChild(category);
        card.appendChild(date);
        card.appendChild(venue);
        card.appendChild(detailsLink);
        card.appendChild(document.createElement("br"));
        card.appendChild(cancelButton);

        container.appendChild(card);
    });
}

if (document.getElementById("myEventsContainer")) {
    displayMyEvents();
}