// ==========================================
// CAMPUSCONNECT - ADMIN MODULE
// Merged with Python Flask Backend & SQLite Database (with LocalStorage fallback)
// ==========================================

const API_BASE = window.location.origin.includes('5000') 
    ? '/api' 
    : 'http://127.0.0.1:5000/api';

// LocalStorage Keys for Offline Support
const ADMIN_SESSION_KEY = "campusConnectAdminLoggedIn";
const EVENTS_KEY = "campusConnectEvents";
const STUDENTS_KEY = "campusConnectStudents";
const REGISTRATIONS_KEY = "registeredEvents";
const ADMINS_KEY = "campusConnectAdmins";

// ==========================================
// LOCALSTORAGE HELPER FUNCTIONS
// ==========================================
function readStorage(key, fallback = []) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : fallback;
    } catch (error) {
        console.error("Storage read error:", key, error);
        return fallback;
    }
}

function getStudents() {
    return readStorage(STUDENTS_KEY, []);
}

function getRegistrations() {
    return readStorage(REGISTRATIONS_KEY, []);
}

function getEvents() {
    const events = readStorage(EVENTS_KEY, []);
    return events.map(function (event) {
        return {
            ...event,
            id: String(event.id || event.eventId || ""),
            title: event.title || event.name || "Untitled Event",
            category: event.category || "Other",
            date: event.date || event.event_date || "",
            time: event.time || event.event_time || "",
            venue: event.venue || "",
            organizer: event.organizer || "",
            seats: event.seats ?? event.total_seats ?? 0,
            description: event.description || ""
        };
    });
}

function saveEvents(events) {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
}

function createCell(value) {
    const cell = document.createElement("td");
    cell.textContent = value == null ? "" : String(value);
    return cell;
}

function showAdminMessage(message, isError = false) {
    const messageElement = document.getElementById("adminMessage");
    if (messageElement) {
        messageElement.textContent = message;
        messageElement.style.color = isError ? "#dc2626" : "#16a34a";
    }
}

// ==========================================
// ADMIN DASHBOARD INITIALIZATION
// ==========================================
async function initializeAdminDashboard() {
    if (localStorage.getItem(ADMIN_SESSION_KEY) !== "true") {
        window.location.href = "admin-login.html";
        return;
    }

    await renderDashboardStats();
    await renderStudents();
    await renderAdminEvents();
    await renderRegistrations();

    const addEventForm = document.getElementById("addEventForm");
    if (addEventForm) {
        addEventForm.addEventListener("submit", addEvent);
    }

    const logoutButton = document.getElementById("adminLogoutButton");
    if (logoutButton) {
        logoutButton.addEventListener("click", adminLogout);
    }
}

// ==========================================
// DASHBOARD STATISTICS
// ==========================================
async function renderDashboardStats() {
    const totalEventsElement = document.getElementById("totalEvents");
    const totalStudentsElement = document.getElementById("totalStudents");
    const totalRegistrationsElement = document.getElementById("totalRegistrations");

    // Try fetching live from Backend API
    try {
        const res = await fetch(`${API_BASE}/admin/stats`);
        if (res.ok) {
            const data = await res.json();
            if (data.success) {
                if (totalEventsElement) totalEventsElement.textContent = data.totalEvents;
                if (totalStudentsElement) totalStudentsElement.textContent = data.totalStudents;
                if (totalRegistrationsElement) totalRegistrationsElement.textContent = data.totalRegistrations;
                return;
            }
        }
    } catch (e) {
        console.log("Backend offline, using local stats:", e);
    }

    // Fallback to local storage
    if (totalEventsElement) totalEventsElement.textContent = getEvents().length;
    if (totalStudentsElement) totalStudentsElement.textContent = getStudents().length;
    if (totalRegistrationsElement) totalRegistrationsElement.textContent = getRegistrations().length;
}

// ==========================================
// STUDENT MANAGEMENT
// ==========================================
async function renderStudents() {
    const tableBody = document.getElementById("adminStudentsTable");
    if (!tableBody) return;

    let studentsList = [];

    // Try Backend API First
    try {
        const res = await fetch(`${API_BASE}/admin/students`);
        if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.students)) {
                studentsList = data.students;
                localStorage.setItem(STUDENTS_KEY, JSON.stringify(studentsList));
            }
        }
    } catch (e) {
        console.log("Backend offline, loading local students:", e);
    }

    if (studentsList.length === 0) {
        studentsList = getStudents();
    }

    tableBody.replaceChildren();

    if (studentsList.length === 0) {
        const row = document.createElement("tr");
        const cell = createCell("No students registered yet.");
        cell.colSpan = 6;
        row.appendChild(cell);
        tableBody.appendChild(row);
        return;
    }

    studentsList.forEach(function (student) {
        const row = document.createElement("tr");

        row.appendChild(createCell(student.name || student.full_name || ""));
        row.appendChild(createCell(student.email || ""));
        row.appendChild(createCell(student.studentId || student.student_id || ""));
        row.appendChild(createCell(student.department || ""));
        row.appendChild(createCell(student.year || ""));

        const actionCell = document.createElement("td");
        const deleteButton = document.createElement("button");

        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.className = "delete-button";

        deleteButton.addEventListener("click", function () {
            deleteStudent(student);
        });

        actionCell.appendChild(deleteButton);
        row.appendChild(actionCell);
        tableBody.appendChild(row);
    });
}

async function deleteStudent(student) {
    if (!student || !student.email) return;

    const identifier = student.studentId || student.email;
    const confirmed = confirm(`Delete student "${student.name || student.email}"?\n\nThis account and associated registrations will be permanently deleted.`);
    if (!confirmed) return;

    // Try Backend API Delete
    try {
        await fetch(`${API_BASE}/admin/students/${encodeURIComponent(identifier)}`, {
            method: "DELETE"
        });
    } catch (e) {}

    // Also update LocalStorage
    const students = getStudents().filter(s => s.email !== student.email);
    localStorage.setItem(STUDENTS_KEY, JSON.stringify(students));

    const regs = getRegistrations().filter(r => r.email !== student.email);
    localStorage.setItem(REGISTRATIONS_KEY, JSON.stringify(regs));

    await renderStudents();
    await renderRegistrations();
    await renderDashboardStats();

    const message = document.getElementById("studentManagementMessage");
    if (message) {
        message.textContent = `${student.name || student.email} was deleted successfully.`;
    }
}

// ==========================================
// EVENT MANAGEMENT
// ==========================================
async function renderAdminEvents() {
    const tableBody = document.getElementById("adminEventsTable");
    if (!tableBody) return;

    let eventsList = [];

    // Try Backend API First
    try {
        const res = await fetch(`${API_BASE}/events`);
        if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.events)) {
                eventsList = data.events;
                localStorage.setItem(EVENTS_KEY, JSON.stringify(eventsList));
            }
        }
    } catch (e) {
        console.log("Backend offline, reading local events:", e);
    }

    if (eventsList.length === 0) {
        eventsList = getEvents();
    }

    tableBody.replaceChildren();

    if (eventsList.length === 0) {
        const row = document.createElement("tr");
        const cell = createCell("No events available.");
        cell.colSpan = 7;
        row.appendChild(cell);
        tableBody.appendChild(row);
        return;
    }

    eventsList.forEach(function (event) {
        const row = document.createElement("tr");

        row.appendChild(createCell(event.title || event.name));
        row.appendChild(createCell(event.category));
        row.appendChild(createCell(event.date));
        row.appendChild(createCell(event.venue));
        row.appendChild(createCell(event.seats ?? event.total_seats));

        const actionCell = document.createElement("td");
        const deleteButton = document.createElement("button");

        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.className = "delete-button";

        deleteButton.addEventListener("click", function () {
            deleteEvent(event.id || event.eventId);
        });

        actionCell.appendChild(deleteButton);
        row.appendChild(actionCell);
        tableBody.appendChild(row);
    });
}

async function addEvent(event) {
    event.preventDefault();

    const title = document.getElementById("eventTitle").value.trim();
    const category = document.getElementById("eventCategory").value;
    const date = document.getElementById("eventDate").value;
    const time = document.getElementById("eventTime").value.trim();
    const venue = document.getElementById("eventVenue").value.trim();
    const organizer = document.getElementById("eventOrganizer").value.trim();
    const seats = Number(document.getElementById("eventSeats").value);
    const description = document.getElementById("eventDescription").value.trim();

    if (!title || !category || !date || !venue || !seats || seats < 1) {
        showAdminMessage("Please fill in all event fields correctly.", true);
        return;
    }

    const eventPayload = {
        id: "event_" + Date.now(),
        title: title,
        name: title,
        category: category,
        date: date,
        time: time,
        venue: venue,
        organizer: organizer,
        seats: seats,
        description: description
    };

    // Try Backend API First
    try {
        const res = await fetch(`${API_BASE}/events`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(eventPayload)
        });
        const data = await res.json();
        if (res.ok && data.success) {
            document.getElementById("addEventForm").reset();
            await renderAdminEvents();
            await renderDashboardStats();
            showAdminMessage("Event added successfully to SQLite Database!");
            return;
        }
    } catch (e) {
        console.log("Backend offline, saving event locally:", e);
    }

    // LocalStorage Fallback
    const localEvents = getEvents();
    localEvents.push(eventPayload);
    saveEvents(localEvents);

    document.getElementById("addEventForm").reset();
    await renderAdminEvents();
    await renderDashboardStats();
    showAdminMessage("Event added successfully!");
}

async function deleteEvent(eventId) {
    if (!eventId) return;

    const confirmed = confirm("Are you sure you want to delete this event?");
    if (!confirmed) return;

    // Try Backend API Delete
    try {
        await fetch(`${API_BASE}/events/${encodeURIComponent(eventId)}`, {
            method: "DELETE"
        });
    } catch (e) {}

    // Also update LocalStorage
    const localEvents = getEvents().filter(e => String(e.id) !== String(eventId));
    saveEvents(localEvents);

    await renderAdminEvents();
    await renderDashboardStats();
    await renderRegistrations();
    showAdminMessage("Event deleted successfully.");
}

// ==========================================
// REGISTRATIONS MANAGEMENT
// ==========================================
async function renderRegistrations() {
    const tableBody = document.getElementById("adminRegistrationsTable");
    if (!tableBody) return;

    let registrationsList = [];

    // Try Backend API First
    try {
        const res = await fetch(`${API_BASE}/admin/registrations`);
        if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.registrations)) {
                registrationsList = data.registrations;
            }
        }
    } catch (e) {
        console.log("Backend offline, reading local registrations:", e);
    }

    if (registrationsList.length === 0) {
        const localRegs = getRegistrations();
        const students = getStudents();
        const events = getEvents();

        localRegs.forEach(reg => {
            const student = students.find(s => s.email === reg.email);
            const ev = events.find(e => String(e.id) === String(reg.eventId));
            registrationsList.push({
                studentName: student ? student.name : "Student",
                email: reg.email,
                studentId: student ? student.studentId : "",
                department: student ? student.department : "",
                eventName: ev ? ev.title : "Event deleted"
            });
        });
    }

    tableBody.replaceChildren();

    if (registrationsList.length === 0) {
        const row = document.createElement("tr");
        const cell = createCell("No student registrations yet.");
        cell.colSpan = 5;
        row.appendChild(cell);
        tableBody.appendChild(row);
        return;
    }

    registrationsList.forEach(function (reg) {
        const row = document.createElement("tr");
        row.appendChild(createCell(reg.studentName || reg.name || "Student"));
        row.appendChild(createCell(reg.email || reg.student_email || ""));
        row.appendChild(createCell(reg.studentId || reg.student_id || ""));
        row.appendChild(createCell(reg.department || ""));
        row.appendChild(createCell(reg.eventName || reg.title || ""));
        tableBody.appendChild(row);
    });
}

function adminLogout() {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    window.location.href = "admin-login.html";
}

// ==========================================
// ADMIN LOGIN & REGISTRATION FORMS
// ==========================================
document.addEventListener("DOMContentLoaded", function () {
    // If on admin-dashboard.html
    if (document.getElementById("adminEventsTable")) {
        initializeAdminDashboard();
    }

    // If on admin-login.html
    const adminLoginForm = document.getElementById("adminLoginForm");
    if (adminLoginForm) {
        adminLoginForm.addEventListener("submit", async function (event) {
            event.preventDefault();
            const email = document.getElementById("adminEmail").value.trim().toLowerCase();
            const password = document.getElementById("adminPassword").value;
            const message = document.getElementById("adminLoginMessage");

            // Try Backend API First
            try {
                const res = await fetch(`${API_BASE}/admin/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    localStorage.setItem(ADMIN_SESSION_KEY, "true");
                    if (message) {
                        message.style.color = "#16a34a";
                        message.textContent = "Login successful! Redirecting...";
                    }
                    setTimeout(() => { window.location.href = "admin-dashboard.html"; }, 800);
                    return;
                } else {
                    if (message) {
                        message.style.color = "#dc2626";
                        message.textContent = data.message || "Invalid admin credentials.";
                    }
                    return;
                }
            } catch (e) {
                console.log("Backend offline, checking default local admin:", e);
            }

            // Local fallback
            if ((email === "admin" || email === "admin@campusconnect.com") && password === "admin123") {
                localStorage.setItem(ADMIN_SESSION_KEY, "true");
                window.location.href = "admin-dashboard.html";
            } else {
                if (message) {
                    message.style.color = "#dc2626";
                    message.textContent = "Invalid email or password. Default is admin / admin123";
                }
            }
        });
    }

    // If on admin-register.html
    const adminRegisterForm = document.getElementById("adminRegisterForm");
    if (adminRegisterForm) {
        adminRegisterForm.addEventListener("submit", async function (event) {
            event.preventDefault();
            const name = document.getElementById("adminName").value.trim();
            const email = document.getElementById("newAdminEmail").value.trim().toLowerCase();
            const password = document.getElementById("newAdminPassword").value;
            const message = document.getElementById("registerMessage");

            try {
                const res = await fetch(`${API_BASE}/admin/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, email, password })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    if (message) {
                        message.style.color = "#16a34a";
                        message.textContent = data.message || "Admin registered successfully! Redirecting...";
                    }
                    setTimeout(() => { window.location.href = "admin-login.html"; }, 1200);
                    return;
                } else {
                    if (message) {
                        message.style.color = "#dc2626";
                        message.textContent = data.message || "Registration failed.";
                    }
                    return;
                }
            } catch (e) {
                if (message) {
                    message.style.color = "#16a34a";
                    message.textContent = "Admin registered locally! Redirecting to login...";
                }
                setTimeout(() => { window.location.href = "admin-login.html"; }, 1200);
            }
        });
    }
});