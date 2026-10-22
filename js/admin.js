// ==========================================
// CAMPUSCONNECT - ADMIN DASHBOARD
// ==========================================

// LocalStorage Keys
const ADMIN_SESSION_KEY = "campusConnectAdminLoggedIn";
const EVENTS_KEY = "campusConnectEvents";
const STUDENTS_KEY = "campusConnectStudents";
const REGISTRATIONS_KEY = "registeredEvents";

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
            id: event.id || event.eventId || "",
            title: event.title || event.name || "Untitled Event",
            category: event.category || "Other",
            date: event.date || "",
            time: event.time || "",
            venue: event.venue || "",
            organizer: event.organizer || "",
            seats: event.seats ?? event.availableSeats ?? 0,
            description: event.description || ""
        };
    });
}

function saveEvents(events) {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
}

// ==========================================
// CREATE TABLE CELL SAFELY
// ==========================================

function createCell(value) {
    const cell = document.createElement("td");
    cell.textContent = value == null ? "" : String(value);
    return cell;
}

// ==========================================
// ADMIN DASHBOARD INITIALIZATION
// ==========================================

function initializeAdminDashboard() {
    // Check admin login
    if (localStorage.getItem(ADMIN_SESSION_KEY) !== "true") {
        window.location.href = "admin-login.html";
        return;
    }

    renderDashboardStats();
    renderStudents();
    renderRegistrations();
    renderAdminEvents();

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

function renderDashboardStats() {
    const totalEventsElement = document.getElementById("totalEvents");
    const totalStudentsElement = document.getElementById("totalStudents");
    const totalRegistrationsElement = document.getElementById(
        "totalRegistrations"
    );

    if (totalEventsElement) {
        totalEventsElement.textContent = getEvents().length;
    }

    if (totalStudentsElement) {
        totalStudentsElement.textContent = getStudents().length;
    }

    if (totalRegistrationsElement) {
        totalRegistrationsElement.textContent = getRegistrations().filter(
            function (registration) {
                return (
                    registration &&
                    typeof registration === "object" &&
                    registration.email &&
                    registration.eventId
                );
            }
        ).length;
    }
}

// ==========================================
// STUDENT MANAGEMENT
// ==========================================

function renderStudents() {
    const tableBody = document.getElementById("adminStudentsTable");

    if (!tableBody) {
        return;
    }

    const students = getStudents();
    tableBody.replaceChildren();

    if (students.length === 0) {
        const row = document.createElement("tr");
        const cell = createCell("No students registered yet.");
        cell.colSpan = 6;
        row.appendChild(cell);
        tableBody.appendChild(row);
        return;
    }

    students.forEach(function (student) {
        const row = document.createElement("tr");

        row.appendChild(createCell(student.name || ""));
        row.appendChild(createCell(student.email || ""));
        row.appendChild(
            createCell(student.studentId || student.enrollmentNumber || "")
        );
        row.appendChild(createCell(student.department || ""));
        row.appendChild(createCell(student.year || ""));

        const actionCell = document.createElement("td");
        const deleteButton = document.createElement("button");

        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.className = "delete-btn";

        deleteButton.addEventListener("click", function () {
            deleteStudent(student);
        });

        actionCell.appendChild(deleteButton);
        row.appendChild(actionCell);

        tableBody.appendChild(row);
    });
}

// ==========================================
// DELETE STUDENT AND ALL RELATED DATA
// ==========================================

function deleteStudent(student) {
    if (!student || !student.email) {
        alert("Student details not found.");
        return;
    }

    const email = student.email.trim().toLowerCase();

    const confirmed = confirm(
        "Delete " + (student.name || email) + "?\n\n" +
        "The student's account and all associated registrations " +
        "will be permanently deleted."
    );

    if (!confirmed) {
        return;
    }

    try {
        const students = getStudents();

        const updatedStudents = students.filter(function (item) {
            return (
                (item.email || "").trim().toLowerCase() !== email
            );
        });

        const registrations = getRegistrations();

        const updatedRegistrations = registrations.filter(
            function (registration) {
                // Remove malformed legacy records.
                if (
                    !registration ||
                    typeof registration !== "object"
                ) {
                    return false;
                }

                return (
                    (registration.email || "").trim().toLowerCase() !== email
                );
            }
        );

        // Save updated student list and registration list.
        localStorage.setItem(
            STUDENTS_KEY,
            JSON.stringify(updatedStudents)
        );

        localStorage.setItem(
            REGISTRATIONS_KEY,
            JSON.stringify(updatedRegistrations)
        );

        // Remove student session if it belongs to this student.
        const currentUser = readStorage("campusConnectCurrentUser", null);

        if (
            currentUser &&
            (currentUser.email || "").trim().toLowerCase() === email
        ) {
            localStorage.removeItem("campusConnectCurrentUser");
        }

        // Refresh dashboard.
        renderStudents();
        renderRegistrations();
        renderDashboardStats();

        const message = document.getElementById(
            "studentManagementMessage"
        );

        if (message) {
            message.textContent =
                (student.name || email) +
                " and all associated registrations were deleted.";
        }

        alert(
            "Student and associated registrations deleted successfully."
        );
    } catch (error) {
        console.error("Student deletion error:", error);
        alert("Unable to delete student. Check the browser console.");
    }
}

// ==========================================
// EVENT MANAGEMENT - DISPLAY EVENTS
// ==========================================

function renderAdminEvents() {
    const tableBody = document.getElementById("adminEventsTable");

    if (!tableBody) {
        return;
    }

    const events = getEvents();
    tableBody.replaceChildren();

    if (events.length === 0) {
        const row = document.createElement("tr");
        const cell = createCell("No events available.");
        cell.colSpan = 7;
        row.appendChild(cell);
        tableBody.appendChild(row);
        return;
    }

    events.forEach(function (event) {
        const row = document.createElement("tr");

        row.appendChild(createCell(event.title));
        row.appendChild(createCell(event.category));
        row.appendChild(createCell(event.date));
        row.appendChild(createCell(event.time));
        row.appendChild(createCell(event.venue));
        row.appendChild(createCell(event.organizer));

        const actionCell = document.createElement("td");
        const deleteButton = document.createElement("button");

        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.className = "delete-btn";

        deleteButton.addEventListener("click", function () {
            deleteEvent(event.id);
        });

        actionCell.appendChild(deleteButton);
        row.appendChild(actionCell);

        tableBody.appendChild(row);
    });
}

// ==========================================
// ADD NEW EVENT
// ==========================================

function addEvent(event) {
    event.preventDefault();

    const title = document.getElementById("eventTitle").value.trim();
    const category = document.getElementById("eventCategory").value;
    const date = document.getElementById("eventDate").value;
    const time = document.getElementById("eventTime").value;
    const venue = document.getElementById("eventVenue").value.trim();
    const organizer = document.getElementById("eventOrganizer").value.trim();
    const seats = Number(document.getElementById("eventSeats").value);
    const description = document.getElementById(
        "eventDescription"
    ).value.trim();

    if (
        !title ||
        !category ||
        !date ||
        !time ||
        !venue ||
        !organizer ||
        !Number.isFinite(seats) ||
        seats < 1
    ) {
        showAdminMessage("Please fill in all event fields correctly.");
        return;
    }

    const events = getEvents();

    const newEvent = {
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

    events.push(newEvent);

    try {
        saveEvents(events);

        document.getElementById("addEventForm").reset();

        renderAdminEvents();
        renderDashboardStats();

        showAdminMessage("Event added successfully!");
    } catch (error) {
        console.error("Add event error:", error);
        showAdminMessage("Unable to save the event.");
    }
}

// ==========================================
// DELETE EVENT
// ==========================================

function deleteEvent(eventId) {
    if (!eventId) {
        alert("Event ID not found.");
        return;
    }

    const confirmed = confirm(
        "Are you sure you want to delete this event?"
    );

    if (!confirmed) {
        return;
    }

    const events = getEvents();

    const updatedEvents = events.filter(function (event) {
        return event.id !== eventId;
    });

    saveEvents(updatedEvents);

    renderAdminEvents();
    renderDashboardStats();

    // Keep historical registrations intact.
    // They will show "Event deleted" in the registrations table.
    renderRegistrations();

    showAdminMessage("Event deleted successfully.");
}

// ==========================================
// STUDENT EVENT REGISTRATIONS
// ==========================================

function renderRegistrations() {
    const tableBody = document.getElementById("adminRegistrationsTable");

    if (!tableBody) {
        return;
    }

    const registrations = getRegistrations();
    const students = getStudents();
    const events = getEvents();

    tableBody.replaceChildren();

    // Ignore invalid legacy records.
    const validRegistrations = registrations.filter(
        function (registration) {
            return (
                registration &&
                typeof registration === "object" &&
                registration.email &&
                registration.eventId
            );
        }
    );

    if (validRegistrations.length === 0) {
        const row = document.createElement("tr");
        const cell = createCell("No student registrations yet.");
        cell.colSpan = 5;
        row.appendChild(cell);
        tableBody.appendChild(row);
        return;
    }

    validRegistrations.forEach(function (registration) {
        const row = document.createElement("tr");

        const registrationEmail = (
            registration.email || ""
        ).trim().toLowerCase();

        const student = students.find(function (item) {
            return (
                item.email &&
                item.email.trim().toLowerCase() === registrationEmail
            );
        });

        const registeredEvent = events.find(function (item) {
            return item.id === registration.eventId;
        });

        row.appendChild(
            createCell(student ? student.name : "Student not found")
        );

        row.appendChild(createCell(registration.email || ""));

        row.appendChild(
            createCell(
                student
                    ? student.studentId || student.enrollmentNumber || ""
                    : ""
            )
        );

        row.appendChild(
            createCell(student ? student.department || "" : "")
        );

        row.appendChild(
            createCell(
                registeredEvent
                    ? registeredEvent.title
                    : "Event deleted"
            )
        );

        tableBody.appendChild(row);
    });
}

// ==========================================
// ADMIN MESSAGE
// ==========================================

function showAdminMessage(message) {
    const messageElement = document.getElementById("adminMessage");

    if (messageElement) {
        messageElement.textContent = message;
    }
}

// ==========================================
// ADMIN LOGOUT
// ==========================================

function adminLogout() {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    window.location.href = "admin-login.html";
}

// ==========================================
// START DASHBOARD
// ==========================================

document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById("adminEventsTable")) {
        initializeAdminDashboard();
    }
});

// ==========================================
// ADMIN LOGIN + MULTIPLE ADMIN REGISTRATION
// ==========================================

const ADMINS_KEY = "campusConnectAdmins";

// Default admin: sirf pehli baar initialize hoga
function initializeAdmins() {
    let admins = [];

    try {
        admins = JSON.parse(localStorage.getItem(ADMINS_KEY)) || [];
    } catch (error) {
        admins = [];
    }

    if (!Array.isArray(admins)) {
        admins = [];
    }

    // Existing admin list empty ho tab default admin create karo
    if (admins.length === 0) {
        admins.push({
            name: "Campus Admin",
            email: "admin@campusconnect.com",
            password: "Admin123"
        });

        localStorage.setItem(ADMINS_KEY, JSON.stringify(admins));
    }
}

// Admin login form
document.addEventListener("DOMContentLoaded", function () {
    const loginForm = document.getElementById("adminLoginForm");

    if (!loginForm) {
        return;
    }

    initializeAdmins();

    loginForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const email = document
            .getElementById("adminEmail")
            .value.trim()
            .toLowerCase();

        const password = document
            .getElementById("adminPassword")
            .value;

        const message = document.getElementById("adminLoginMessage");

        let admins = [];

        try {
            admins = JSON.parse(localStorage.getItem(ADMINS_KEY)) || [];
        } catch (error) {
            admins = [];
        }

        const admin = admins.find(function (item) {
            return (
                item.email.toLowerCase() === email &&
                item.password === password
            );
        });

        if (admin) {
            localStorage.setItem(ADMIN_SESSION_KEY, "true");
            localStorage.setItem("campusConnectCurrentAdmin", JSON.stringify({
                name: admin.name,
                email: admin.email
            }));

            window.location.href = "admin-dashboard.html";
        } else {
            message.textContent = "Invalid admin email or password.";
            message.style.color = "red";
        }
    });
});

// ==========================================
// REGISTER NEW ADMIN
// ==========================================

function registerNewAdmin(name, email, password) {
    initializeAdmins();

    name = name.trim();
    email = email.trim().toLowerCase();

    if (!name || !email || !password) {
        return {
            success: false,
            message: "Please fill in all fields."
        };
    }

    if (password.length < 6) {
        return {
            success: false,
            message: "Password must be at least 6 characters."
        };
    }

    let admins = [];

    try {
        admins = JSON.parse(localStorage.getItem(ADMINS_KEY)) || [];
    } catch (error) {
        admins = [];
    }

    const alreadyExists = admins.some(function (admin) {
        return admin.email.toLowerCase() === email;
    });

    if (alreadyExists) {
        return {
            success: false,
            message: "This admin email is already registered."
        };
    }

    admins.push({
        name: name,
        email: email,
        password: password
    });

    localStorage.setItem(ADMINS_KEY, JSON.stringify(admins));

    return {
        success: true,
        message: "Admin registered successfully. You can now log in."
    };
}