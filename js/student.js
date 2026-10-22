// CampusConnect - Student Module
// Student registration, login and event management

// ---------------- SHARED EVENTS STORAGE ----------------

const EVENTS_KEY = "campusConnectEvents";

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
    }
];

// Default events sirf tab add honge jab events storage pehle se exist nahi karti.
// Agar Admin ne saare events delete kar diye hain aur array empty hai,
// toh empty array hi rahegi.
if (localStorage.getItem(EVENTS_KEY) === null) {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(defaultEvents));
}

// Admin ke saved events read karein
function getEvents() {
    try {
        const savedEvents = JSON.parse(localStorage.getItem(EVENTS_KEY));

        if (!Array.isArray(savedEvents)) {
            return [];
        }

        // Admin title use kar sakta hai aur Student pages name.
        // Dono ko support karne ke liye normalize kar rahe hain.
        return savedEvents.map(function (item) {
            return {
                ...item,
                name: item.name || item.title || "Untitled Event",
                title: item.title || item.name || "Untitled Event",
                category: item.category || "Other",
                description: item.description || "",
                date: item.date || "",
                time: item.time || "",
                venue: item.venue || "",
                organizer: item.organizer || "",
                seats: Number(item.seats) || 0
            };
        });
    } catch (error) {
        console.error("Events load nahi ho paaye:", error);
        return [];
    }
}

const events = getEvents();

const STUDENTS_KEY = "campusConnectStudents";
const CURRENT_USER_KEY = "campusConnectCurrentUser";
const REGISTRATIONS_KEY = "registeredEvents";


// ---------------- HELPER FUNCTIONS ----------------

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
        const registrations = JSON.parse(
            localStorage.getItem(REGISTRATIONS_KEY)
        );

        return Array.isArray(registrations) ? registrations : [];
    } catch (error) {
        return [];
    }
}

function saveRegistrations(registrations) {
    localStorage.setItem(
        REGISTRATIONS_KEY,
        JSON.stringify(registrations)
    );
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
    registerForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email")
            .value.trim().toLowerCase();
        const studentId = document.getElementById("studentId").value.trim();
        const department = document.getElementById("department").value;
        const year = document.getElementById("year").value;
        const password = document.getElementById("password").value;
        const confirmPassword =
            document.getElementById("confirmPassword").value;

        if (!name || !email || !studentId || !department || !year) {
            showMessage(
                "registerMessage",
                "Please fill in all fields.",
                true
            );
            return;
        }

        if (password.length < 6) {
            showMessage(
                "registerMessage",
                "Password must contain at least 6 characters.",
                true
            );
            return;
        }

        if (password !== confirmPassword) {
            showMessage(
                "registerMessage",
                "Passwords do not match.",
                true
            );
            return;
        }

        const students = getStudents();

        const emailExists = students.some(function (student) {
            return student.email === email;
        });

        const studentIdExists = students.some(function (student) {
            return (
                student.studentId &&
                student.studentId.toLowerCase() === studentId.toLowerCase()
            );
        });

        if (emailExists) {
            showMessage(
                "registerMessage",
                "This email is already registered. Please login.",
                true
            );
            return;
        }

        if (studentIdExists) {
            showMessage(
                "registerMessage",
                "This enrollment number is already registered.",
                true
            );
            return;
        }

        const newStudent = {
            name: name,
            email: email,
            studentId: studentId,
            department: department,
            year: year,
            password: password
        };

        students.push(newStudent);

        localStorage.setItem(
            STUDENTS_KEY,
            JSON.stringify(students)
        );

        showMessage(
            "registerMessage",
            "Registration successful! Redirecting to login..."
        );

        registerForm.reset();

        setTimeout(function () {
            window.location.href = "login.html";
        }, 1200);
    });
}


// ---------------- STUDENT LOGIN ----------------

const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const email = document.getElementById("loginEmail")
            .value.trim().toLowerCase();

        const password = document.getElementById("loginPassword").value;

        const students = getStudents();

        const student = students.find(function (item) {
            return item.email === email && item.password === password;
        });

        if (!student) {
            showMessage(
                "loginMessage",
                "Invalid email or password. Please try again.",
                true
            );
            return;
        }

        localStorage.setItem(
            CURRENT_USER_KEY,
            JSON.stringify({
                email: student.email,
                name: student.name,
                studentId: student.studentId
            })
        );

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

function displayEvents(eventList) {
    const eventContainer = document.getElementById("eventContainer");

    if (!eventContainer) {
        return;
    }

    eventContainer.innerHTML = "";

    if (eventList.length === 0) {
        eventContainer.innerHTML = "<p>No events found.</p>";
        return;
    }

    eventList.forEach(function (item) {
        const card = document.createElement("div");
        card.className = "event-card";

        const category = document.createElement("span");
        category.className = "event-category";
        category.textContent = item.category;

        const heading = document.createElement("h3");
        heading.textContent = item.name;

        const description = document.createElement("p");
        description.textContent = item.description;

        const date = document.createElement("p");
        date.innerHTML = "<strong>Date:</strong> ";
        date.appendChild(document.createTextNode(item.date));

        const time = document.createElement("p");
        time.innerHTML = "<strong>Time:</strong> ";
        time.appendChild(document.createTextNode(item.time));

        const venue = document.createElement("p");
        venue.innerHTML = "<strong>Venue:</strong> ";
        venue.appendChild(document.createTextNode(item.venue));

        const detailsLink = document.createElement("a");
        detailsLink.href =
            "event-details.html?event=" + encodeURIComponent(item.id);
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

    const searchText = searchInput
        ? searchInput.value.trim().toLowerCase()
        : "";

    const selectedCategory = categoryFilter
        ? categoryFilter.value
        : "All";

    // Current LocalStorage se latest events read karein
    const latestEvents = getEvents();

    const filteredEvents = latestEvents.filter(function (item) {
    const eventName = (item.name || "").toLowerCase();
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

displayEvents(filteredEvents);
}
if (document.getElementById("eventContainer")) {
    displayEvents(getEvents());

    const searchInput = document.getElementById("searchInput");
    const categoryFilter = document.getElementById("categoryFilter");

    if (searchInput) {
        searchInput.addEventListener("input", filterEvents);
    }

    if (categoryFilter) {
        categoryFilter.addEventListener("change", filterEvents);
    }

    // Dusre page par Admin changes ke baad dashboard refresh ho toh
    // latest events dobara load ho jayenge.
    window.addEventListener("storage", function (event) {
        if (event.key === EVENTS_KEY) {
            filterEvents();
        }
    });
}


// ---------------- EVENT DETAILS ----------------

function getSelectedEvent() {
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get("event");

    const latestEvents = getEvents();

    return latestEvents.find(function (item) {
        return item.id === eventId || item.name === eventId;
    });
}

function showEventDetails() {
    const eventNameElement = document.getElementById("eventName");

    if (!eventNameElement) {
        return;
    }

    const selectedEvent = getSelectedEvent();

    if (!selectedEvent) {
        eventNameElement.textContent = "Event Not Found";

        showMessage(
            "eventMessage",
            "This event is no longer available. Please return to the dashboard.",
            true
        );

        const button = document.getElementById("registerEventBtn");

        if (button) {
            button.disabled = true;
        }

        return;
    }

    document.getElementById("eventName").textContent = selectedEvent.name;
    document.getElementById("eventCategory").textContent =
        selectedEvent.category;
    document.getElementById("eventDescription").textContent =
        selectedEvent.description;
    document.getElementById("eventDate").textContent = selectedEvent.date;
    document.getElementById("eventTime").textContent = selectedEvent.time;
    document.getElementById("eventVenue").textContent = selectedEvent.venue;
    document.getElementById("eventOrganizer").textContent =
        selectedEvent.organizer;

    const registrations = getRegistrations();

    const registeredCount = registrations.filter(function (registration) {
        return registration.eventId === selectedEvent.id;
    }).length;

    const availableSeats = Math.max(
        0,
        selectedEvent.seats - registeredCount
    );

    const seatsElement = document.getElementById("eventSeats");

    if (seatsElement) {
        seatsElement.textContent = availableSeats;
    }

    const registerButton = document.getElementById("registerEventBtn");

    if (!registerButton) {
        return;
    }

    const currentUser = getCurrentUser();

    const alreadyRegistered = currentUser &&
        registrations.some(function (registration) {
            return (
                registration.eventId === selectedEvent.id &&
                registration.email === currentUser.email
            );
        });

    if (alreadyRegistered) {
        registerButton.textContent = "Already Registered";
        registerButton.disabled = true;

        showMessage(
            "eventMessage",
            "You have already registered for this event."
        );
    } else if (availableSeats === 0) {
        registerButton.textContent = "Event Full";
        registerButton.disabled = true;
    } else {
        registerButton.disabled = false;
        registerButton.textContent = "Register for Event";
    }

    // Prevent multiple click handlers if this function is called again.
    registerButton.onclick = function () {
        const loggedInStudent = getCurrentUser();

        if (!loggedInStudent) {
            showMessage(
                "eventMessage",
                "Please login before registering for an event.",
                true
            );

            setTimeout(function () {
                window.location.href = "login.html";
            }, 1000);

            return;
        }

        // Verify that the event still exists in Admin's saved events.
        const currentEvent = getEvents().find(function (item) {
            return item.id === selectedEvent.id;
        });

        if (!currentEvent) {
            showMessage(
                "eventMessage",
                "This event has been deleted by Admin.",
                true
            );

            registerButton.disabled = true;
            return;
        }

        const currentRegistrations = getRegistrations();

        const duplicate = currentRegistrations.some(function (registration) {
            return (
                registration.eventId === currentEvent.id &&
                registration.email === loggedInStudent.email
            );
        });

        if (duplicate) {
            showMessage(
                "eventMessage",
                "You are already registered for this event.",
                true
            );

            registerButton.disabled = true;
            return;
        }

        const latestCount = currentRegistrations.filter(function (registration) {
            return registration.eventId === currentEvent.id;
        }).length;

        if (latestCount >= currentEvent.seats) {
            showMessage(
                "eventMessage",
                "Sorry, all seats are booked.",
                true
            );

            registerButton.disabled = true;
            return;
        }

        currentRegistrations.push({
            eventId: currentEvent.id,
            email: loggedInStudent.email,
            registeredAt: new Date().toISOString()
        });

        saveRegistrations(currentRegistrations);

        registerButton.textContent = "Already Registered";
        registerButton.disabled = true;

        if (seatsElement) {
            seatsElement.textContent = Math.max(
                0,
                currentEvent.seats - latestCount - 1
            );
        }

        showMessage(
            "eventMessage",
            "Registration successful! You can view it in My Events."
        );
    };
}

showEventDetails();


// ---------------- MY EVENTS ----------------

function displayMyEvents() {
    const container = document.getElementById("myEventsContainer");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    const currentUser = getCurrentUser();

    if (!currentUser) {
        showMessage(
            "myEventsMessage",
            "Please login to view your registered events.",
            true
        );

        setTimeout(function () {
            window.location.href = "login.html";
        }, 1000);

        return;
    }

    const registrations = getRegistrations();

    const myRegistrations = registrations.filter(function (registration) {
        return registration.email === currentUser.email;
    });

    if (myRegistrations.length === 0) {
        container.innerHTML =
            "<p>You have not registered for any events yet.</p>";
        return;
    }

    // Latest Admin events use karein
    const latestEvents = getEvents();

    myRegistrations.forEach(function (registration) {
        const eventItem = latestEvents.find(function (item) {
            return item.id === registration.eventId;
        });

        // Deleted event ki registration My Events mein display nahi hogi.
        if (!eventItem) {
            return;
        }

        const card = document.createElement("div");
        card.className = "event-card";

        const heading = document.createElement("h3");
        heading.textContent = eventItem.name;

        const category = document.createElement("p");
        category.textContent = "Category: " + eventItem.category;

        const date = document.createElement("p");
        date.textContent = "Date: " + eventItem.date;

        const venue = document.createElement("p");
        venue.textContent = "Venue: " + eventItem.venue;

        const detailsLink = document.createElement("a");
        detailsLink.href =
            "event-details.html?event=" + encodeURIComponent(eventItem.id);
        detailsLink.className = "details-btn";
        detailsLink.textContent = "View Details";

        const cancelButton = document.createElement("button");
        cancelButton.className = "cancel-btn";
        cancelButton.textContent = "Cancel Registration";

        cancelButton.addEventListener("click", function () {
            const updatedRegistrations = getRegistrations().filter(
                function (item) {
                    return !(
                        item.eventId === eventItem.id &&
                        item.email === currentUser.email
                    );
                }
            );

            saveRegistrations(updatedRegistrations);
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

    
    if (container.children.length === 0) {
        container.innerHTML =
            "<p>Your registered events are no longer available.</p>";
    }
}

displayMyEvents(); 