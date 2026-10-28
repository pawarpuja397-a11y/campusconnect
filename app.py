from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import os
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

DB_NAME = 'campusconnect.db'
ADMIN_SECRET_KEY = os.environ.get('ADMIN_SECRET_KEY', 'CAMPUS@2026')

def get_db_connection():
    """Create database connection with WAL mode and busy timeout to avoid database locks."""
    conn = sqlite3.connect(DB_NAME, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 30000")
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    """Initialize database tables with schema matching the CampusConnect frontend."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # 1. Students Table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS Students (
                student_id TEXT PRIMARY KEY,
                full_name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                department TEXT NOT NULL,
                year TEXT NOT NULL,
                password_hash TEXT NOT NULL
            )
        ''')

        # 2. Admins Table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS Admins (
                admin_id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL
            )
        ''')

        # 3. Events Table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS Events (
                event_id TEXT PRIMARY KEY,
                event_name TEXT NOT NULL,
                category TEXT NOT NULL,
                description TEXT,
                event_date TEXT NOT NULL,
                event_time TEXT,
                venue TEXT NOT NULL,
                organizer TEXT,
                total_seats INTEGER NOT NULL
            )
        ''')

        # 4. Registrations Table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS Registrations (
                registration_id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT NOT NULL,
                event_id TEXT NOT NULL,
                registration_date TEXT NOT NULL,
                FOREIGN KEY (student_id) REFERENCES Students (student_id) ON DELETE CASCADE,
                FOREIGN KEY (event_id) REFERENCES Events (event_id) ON DELETE CASCADE,
                UNIQUE(student_id, event_id)
            )
        ''')

        # Default Admin account (support both 'admin' and 'admin@campusconnect.com')
        cursor.execute('SELECT * FROM Admins WHERE email = ?', ('admin@campusconnect.com',))
        if not cursor.fetchone():
            admin_hash = generate_password_hash('admin123')
            cursor.execute('''
                INSERT INTO Admins (name, email, password_hash)
                VALUES (?, ?, ?)
            ''', ('Super Admin', 'admin@campusconnect.com', admin_hash))

        # Add default events matching frontend initial state if empty
        cursor.execute('SELECT COUNT(*) as count FROM Events')
        if cursor.fetchone()['count'] == 0:
            sample_events = [
                (
                    'event1',
                    'Campus Code Fest',
                    'Technical',
                    'Take part in coding challenges and show your programming skills.',
                    '2026-11-15',
                    '10:00 AM',
                    'Computer Lab',
                    'Computer Science Department',
                    50
                ),
                (
                    'event2',
                    'Cultural Night',
                    'Cultural',
                    'Enjoy music, dance, performances and other cultural activities.',
                    '2026-11-20',
                    '5:00 PM',
                    'College Auditorium',
                    'Cultural Committee',
                    100
                ),
                (
                    'event3',
                    'Inter-College Sports Meet',
                    'Sports',
                    'Participate in exciting sports competitions with other students.',
                    '2026-11-25',
                    '9:00 AM',
                    'College Sports Ground',
                    'Sports Department',
                    80
                ),
                (
                    'event4',
                    'AI & Machine Learning Workshop',
                    'Technical',
                    'Hands-on workshop on AI fundamentals, neural networks, and Python tools.',
                    '2026-12-05',
                    '10:00 AM',
                    'Auditorium Hall A',
                    'Tech Club',
                    60
                )
            ]
            cursor.executemany('''
                INSERT INTO Events (event_id, event_name, category, description, event_date, event_time, venue, organizer, total_seats)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', sample_events)

        conn.commit()
        print("Database initialized successfully with all tables!")
    finally:
        conn.close()

# ----------------- CORS & PRIVATE NETWORK HEADERS -----------------
@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Allow-Private-Network'] = 'true'
    return response

@app.route('/api/<path:subpath>', methods=['OPTIONS'])
def handle_options(subpath):
    response = app.make_default_options_response()
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Allow-Private-Network'] = 'true'
    return response

# ----------------- HEALTH CHECK -----------------
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'success': True, 'message': 'CampusConnect Backend is active and running!'}), 200

# ----------------- STUDENT AUTH -----------------
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    student_id = data.get('student_id', '').strip()
    full_name = data.get('full_name') or data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    department = data.get('department', '').strip()
    year = data.get('year', '').strip()
    password = data.get('password', '').strip()

    if not all([student_id, full_name, email, department, year, password]):
        return jsonify({'success': False, 'message': 'Please fill in all fields.'}), 400

    if len(password) < 6:
        return jsonify({'success': False, 'message': 'Password must contain at least 6 characters.'}), 400

    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        cursor.execute('SELECT * FROM Students WHERE LOWER(email) = ?', (email,))
        if cursor.fetchone():
            return jsonify({'success': False, 'message': 'This email is already registered. Please login.'}), 400

        cursor.execute('SELECT * FROM Students WHERE LOWER(student_id) = LOWER(?)', (student_id,))
        if cursor.fetchone():
            return jsonify({'success': False, 'message': 'This enrollment number is already registered.'}), 400

        password_hash = generate_password_hash(password)
        cursor.execute('''
            INSERT INTO Students (student_id, full_name, email, department, year, password_hash)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (student_id, full_name, email, department, year, password_hash))
        conn.commit()
        return jsonify({'success': True, 'message': 'Registration successful! Redirecting to login...'}), 201
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    identifier = (data.get('email') or data.get('username') or data.get('student_id') or '').strip()
    password = data.get('password', '').strip()

    if not identifier or not password:
        return jsonify({'success': False, 'message': 'Email or Enrollment Number and Password are required.'}), 400

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM Students 
            WHERE LOWER(email) = LOWER(?) OR LOWER(student_id) = LOWER(?)
        ''', (identifier, identifier))
        student = cursor.fetchone()
    finally:
        conn.close()

    if student and check_password_hash(student['password_hash'], password):
        student_data = {
            'studentId': student['student_id'],
            'student_id': student['student_id'],
            'name': student['full_name'],
            'full_name': student['full_name'],
            'email': student['email'],
            'department': student['department'],
            'year': student['year']
        }
        return jsonify({'success': True, 'message': 'Login successful!', 'student': student_data}), 200
    else:
        return jsonify({'success': False, 'message': 'Invalid email/enrollment number or password. Please try again.'}), 401

# ----------------- ADMIN AUTH -----------------
@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    data = request.get_json() or {}
    identifier = (data.get('email') or data.get('username') or '').strip().lower()
    password = data.get('password', '').strip()

    if not identifier or not password:
        return jsonify({'success': False, 'message': 'Email/Username and Password are required.'}), 400

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM Admins 
            WHERE LOWER(email) = ? 
               OR LOWER(name) = ? 
               OR (email = 'admin@campusconnect.com' AND ? IN ('admin', 'superadmin', 'super admin'))
        ''', (identifier, identifier, identifier))
        admin = cursor.fetchone()
    finally:
        conn.close()

    if admin and check_password_hash(admin['password_hash'], password):
        return jsonify({
            'success': True,
            'message': 'Admin login successful!',
            'admin': {'id': admin['admin_id'], 'name': admin['name'], 'email': admin['email']}
        }), 200
    else:
        return jsonify({'success': False, 'message': 'Invalid admin email/username or password.'}), 401

@app.route('/api/admin/register', methods=['POST'])
def admin_register():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()
    secret_key = data.get('secret_key', '').strip()

    if not name or not email or not password or not secret_key:
        return jsonify({'success': False, 'message': 'All fields including Admin Secret Key are required.'}), 400

    if secret_key != ADMIN_SECRET_KEY:
        return jsonify({'success': False, 'message': 'Invalid Admin Secret Key! Only authorized personnel can register as Admin.'}), 403

    if len(password) < 6:
        return jsonify({'success': False, 'message': 'Password must be at least 6 characters.'}), 400

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM Admins WHERE LOWER(email) = ?', (email,))
        if cursor.fetchone():
            return jsonify({'success': False, 'message': 'Admin with this email already exists.'}), 400

        password_hash = generate_password_hash(password)
        cursor.execute('INSERT INTO Admins (name, email, password_hash) VALUES (?, ?, ?)', (name, email, password_hash))
        conn.commit()
        return jsonify({'success': True, 'message': 'Admin registered successfully!'}), 201
    finally:
        conn.close()

# ----------------- FORGOT PASSWORD API -----------------
@app.route('/api/admin/forgot-password', methods=['POST'])
def admin_forgot_password():
    data = request.get_json() or {}
    identifier = (data.get('email') or data.get('username') or '').strip().lower()
    secret_key = data.get('secret_key', '').strip()
    new_password = data.get('new_password', '').strip()

    if not identifier or not secret_key or not new_password:
        return jsonify({'success': False, 'message': 'Admin Email/Username, Secret Key, and New Password are required.'}), 400

    if secret_key != ADMIN_SECRET_KEY:
        return jsonify({'success': False, 'message': 'Invalid Admin Secret Key! Only authorized personnel can reset admin password.'}), 403

    if len(new_password) < 6:
        return jsonify({'success': False, 'message': 'New password must be at least 6 characters.'}), 400

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM Admins 
            WHERE LOWER(email) = ? 
               OR LOWER(name) = ? 
               OR (email = 'admin@campusconnect.com' AND ? IN ('admin', 'superadmin', 'super admin'))
        ''', (identifier, identifier, identifier))
        admin = cursor.fetchone()

        if not admin:
            return jsonify({'success': False, 'message': 'No admin account found matching this email or username.'}), 404

        new_hash = generate_password_hash(new_password)
        cursor.execute('UPDATE Admins SET password_hash = ? WHERE admin_id = ?', (new_hash, admin['admin_id']))
        conn.commit()

        return jsonify({
            'success': True, 
            'message': f"Admin password reset successfully for {admin['name']}! Redirecting to login...",
            'admin': {'email': admin['email'], 'name': admin['name']}
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500
    finally:
        conn.close()

@app.route('/api/forgot-password', methods=['POST'])
def student_forgot_password():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    student_id = data.get('student_id', '').strip()
    identifier = (data.get('identifier') or '').strip()
    new_password = data.get('new_password', '').strip()

    query_val = identifier or student_id or email
    if not query_val or not new_password:
        return jsonify({'success': False, 'message': 'Email or Enrollment Number, and New Password are required.'}), 400

    if len(new_password) < 6:
        return jsonify({'success': False, 'message': 'New password must be at least 6 characters.'}), 400

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        student = None

        # 1. If both email and student_id are provided, try exact match
        if email and student_id and email != student_id:
            cursor.execute('''
                SELECT * FROM Students 
                WHERE LOWER(email) = LOWER(?) AND LOWER(student_id) = LOWER(?)
            ''', (email, student_id))
            student = cursor.fetchone()

        # 2. Match by student_id or email
        if not student:
            cursor.execute('''
                SELECT * FROM Students 
                WHERE LOWER(student_id) = LOWER(?) 
                   OR LOWER(email) = LOWER(?) 
                   OR LOWER(student_id) = LOWER(?) 
                   OR LOWER(email) = LOWER(?)
            ''', (query_val, query_val, student_id or query_val, email or query_val))
            student = cursor.fetchone()

        if not student:
            return jsonify({'success': False, 'message': 'No registered student found with this email or enrollment number.'}), 404

        new_hash = generate_password_hash(new_password)
        cursor.execute('UPDATE Students SET password_hash = ? WHERE student_id = ?', (new_hash, student['student_id']))
        conn.commit()

        return jsonify({
            'success': True, 
            'message': f"Password reset successfully for {student['full_name']}! Redirecting to login...",
            'student': {
                'studentId': student['student_id'],
                'student_id': student['student_id'],
                'name': student['full_name'],
                'email': student['email'],
                'department': student['department'],
                'year': student['year']
            }
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500
    finally:
        conn.close()

# ----------------- EVENTS API -----------------
@app.route('/api/events', methods=['GET'])
def get_events():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT 
                e.event_id,
                e.event_name,
                e.category,
                e.description,
                e.event_date,
                e.event_time,
                e.venue,
                e.organizer,
                e.total_seats,
                (e.total_seats - COUNT(r.registration_id)) AS available_seats,
                COUNT(r.registration_id) AS registered_count
            FROM Events e
            LEFT JOIN Registrations r ON e.event_id = r.event_id
            GROUP BY e.event_id
            ORDER BY e.event_date ASC
        ''')
        rows = cursor.fetchall()

        events = []
        for row in rows:
            events.append({
                'id': row['event_id'],
                'eventId': row['event_id'],
                'title': row['event_name'],
                'name': row['event_name'],
                'category': row['category'],
                'description': row['description'] or '',
                'date': row['event_date'],
                'time': row['event_time'] or '',
                'venue': row['venue'],
                'organizer': row['organizer'] or '',
                'seats': row['total_seats'],
                'availableSeats': max(0, row['available_seats']),
                'registeredCount': row['registered_count']
            })

        return jsonify({'success': True, 'events': events}), 200
    finally:
        conn.close()

@app.route('/api/events/<string:event_id>', methods=['GET'])
def get_event_by_id(event_id):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT 
                e.event_id,
                e.event_name,
                e.category,
                e.description,
                e.event_date,
                e.event_time,
                e.venue,
                e.organizer,
                e.total_seats,
                (e.total_seats - COUNT(r.registration_id)) AS available_seats
            FROM Events e
            LEFT JOIN Registrations r ON e.event_id = r.event_id
            WHERE e.event_id = ? OR e.event_name = ?
            GROUP BY e.event_id
        ''', (event_id, event_id))
        row = cursor.fetchone()

        if not row:
            return jsonify({'success': False, 'message': 'Event not found.'}), 404

        event = {
            'id': row['event_id'],
            'title': row['event_name'],
            'name': row['event_name'],
            'category': row['category'],
            'description': row['description'] or '',
            'date': row['event_date'],
            'time': row['event_time'] or '',
            'venue': row['venue'],
            'organizer': row['organizer'] or '',
            'seats': row['total_seats'],
            'availableSeats': max(0, row['available_seats'])
        }
        return jsonify({'success': True, 'event': event}), 200
    finally:
        conn.close()

@app.route('/api/events', methods=['POST'])
def add_event():
    data = request.get_json() or {}
    title = (data.get('title') or data.get('name', '')).strip()
    category = data.get('category', '').strip()
    date = data.get('date', '').strip()
    time = data.get('time', '').strip()
    venue = data.get('venue', '').strip()
    organizer = data.get('organizer', '').strip()
    seats = int(data.get('seats', 50))
    description = data.get('description', '').strip()
    event_id = data.get('id') or f"event_{int(datetime.now().timestamp() * 1000)}"

    if not all([title, category, date, venue, seats]):
        return jsonify({'success': False, 'message': 'Please fill all required event fields.'}), 400

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO Events (event_id, event_name, category, description, event_date, event_time, venue, organizer, total_seats)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (event_id, title, category, description, date, time, venue, organizer, seats))
        conn.commit()
        return jsonify({'success': True, 'message': 'Event added successfully!', 'event_id': event_id}), 201
    finally:
        conn.close()

@app.route('/api/events/<string:event_id>', methods=['DELETE'])
def delete_event(event_id):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM Registrations WHERE event_id = ?', (event_id,))
        cursor.execute('DELETE FROM Events WHERE event_id = ?', (event_id,))
        conn.commit()
        return jsonify({'success': True, 'message': 'Event deleted successfully.'}), 200
    finally:
        conn.close()

# ----------------- EVENT REGISTRATION API -----------------
@app.route('/api/register-event', methods=['POST'])
def register_event():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    student_id = data.get('student_id') or data.get('studentId', '').strip()
    event_id = data.get('event_id') or data.get('eventId', '').strip()

    if not event_id or (not email and not student_id):
        return jsonify({'success': False, 'message': 'Student details and event ID are required.'}), 400

    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # Find student
        if email and student_id:
            cursor.execute('SELECT * FROM Students WHERE LOWER(email) = ? OR LOWER(student_id) = LOWER(?)', (email, student_id))
        elif email:
            cursor.execute('SELECT * FROM Students WHERE LOWER(email) = ?', (email,))
        else:
            cursor.execute('SELECT * FROM Students WHERE LOWER(student_id) = LOWER(?)', (student_id,))
        student = cursor.fetchone()

        if not student:
            return jsonify({'success': False, 'message': 'Student account not found. Please log in.'}), 404

        resolved_student_id = student['student_id']

        # Check seats available
        cursor.execute('''
            SELECT 
                e.total_seats,
                (e.total_seats - COUNT(r.registration_id)) AS available_seats
            FROM Events e
            LEFT JOIN Registrations r ON e.event_id = r.event_id
            WHERE e.event_id = ?
            GROUP BY e.event_id
        ''', (event_id,))
        event = cursor.fetchone()

        if not event:
            return jsonify({'success': False, 'message': 'This event is no longer available.'}), 404

        if event['available_seats'] <= 0:
            return jsonify({'success': False, 'message': 'Sorry, all seats are booked.'}), 400

        # Check duplicate registration
        cursor.execute('SELECT * FROM Registrations WHERE student_id = ? AND event_id = ?', (resolved_student_id, event_id))
        if cursor.fetchone():
            return jsonify({'success': False, 'message': 'You are already registered for this event.'}), 400

        reg_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute('''
            INSERT INTO Registrations (student_id, event_id, registration_date)
            VALUES (?, ?, ?)
        ''', (resolved_student_id, event_id, reg_date))
        conn.commit()

        return jsonify({'success': True, 'message': 'Registration successful!'}), 201
    finally:
        conn.close()

@app.route('/api/my-events', methods=['GET'])
def get_my_events():
    email = request.args.get('email', '').strip().lower()
    student_id = request.args.get('student_id') or request.args.get('studentId', '').strip()

    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        if email:
            cursor.execute('SELECT student_id FROM Students WHERE LOWER(email) = ?', (email,))
            row = cursor.fetchone()
            resolved_id = row['student_id'] if row else None
        else:
            resolved_id = student_id

        if not resolved_id:
            return jsonify({'success': True, 'events': []}), 200

        cursor.execute('''
            SELECT 
                r.registration_id,
                r.registration_date,
                e.event_id,
                e.event_name,
                e.category,
                e.description,
                e.event_date,
                e.event_time,
                e.venue,
                e.organizer
            FROM Registrations r
            JOIN Events e ON r.event_id = e.event_id
            WHERE r.student_id = ?
            ORDER BY r.registration_id DESC
        ''', (resolved_id,))
        rows = cursor.fetchall()

        events = []
        for r in rows:
            events.append({
                'registrationId': r['registration_id'],
                'registrationDate': r['registration_date'],
                'id': r['event_id'],
                'eventId': r['event_id'],
                'title': r['event_name'],
                'name': r['event_name'],
                'category': r['category'],
                'description': r['description'],
                'date': r['event_date'],
                'time': r['event_time'] or '',
                'venue': r['venue'],
                'organizer': r['organizer'] or ''
            })

        return jsonify({'success': True, 'events': events}), 200
    finally:
        conn.close()

@app.route('/api/cancel-registration', methods=['POST'])
def cancel_registration():
    data = request.get_json() or {}
    event_id = data.get('event_id') or data.get('eventId')
    email = data.get('email', '').strip().lower()
    student_id = data.get('student_id') or data.get('studentId')

    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        if email:
            cursor.execute('SELECT student_id FROM Students WHERE LOWER(email) = ?', (email,))
            s_row = cursor.fetchone()
            target_student_id = s_row['student_id'] if s_row else None
        else:
            target_student_id = student_id

        if not target_student_id or not event_id:
            return jsonify({'success': False, 'message': 'Missing event ID or student identifier.'}), 400

        cursor.execute('''
            DELETE FROM Registrations 
            WHERE student_id = ? AND event_id = ?
        ''', (target_student_id, str(event_id)))
        rows = cursor.rowcount
        conn.commit()

        if rows > 0:
            return jsonify({'success': True, 'message': 'Registration cancelled successfully.'}), 200
        else:
            return jsonify({'success': False, 'message': 'Registration record not found.'}), 404
    finally:
        conn.close()

# ----------------- ADMIN DASHBOARD MANAGEMENT API -----------------
@app.route('/api/admin/stats', methods=['GET'])
def admin_stats():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) as count FROM Events')
        total_events = cursor.fetchone()['count']

        cursor.execute('SELECT COUNT(*) as count FROM Students')
        total_students = cursor.fetchone()['count']

        cursor.execute('SELECT COUNT(*) as count FROM Registrations')
        total_registrations = cursor.fetchone()['count']

        return jsonify({
            'success': True,
            'totalEvents': total_events,
            'totalStudents': total_students,
            'totalRegistrations': total_registrations
        }), 200
    finally:
        conn.close()

@app.route('/api/admin/students', methods=['GET'])
def get_admin_students():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('SELECT student_id, full_name, email, department, year FROM Students ORDER BY student_id ASC')
        rows = cursor.fetchall()

        students = []
        for r in rows:
            students.append({
                'studentId': r['student_id'],
                'name': r['full_name'],
                'email': r['email'],
                'department': r['department'],
                'year': r['year']
            })
        return jsonify({'success': True, 'students': students}), 200
    finally:
        conn.close()

@app.route('/api/admin/students/<string:identifier>', methods=['DELETE'])
def delete_admin_student(identifier):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM Registrations WHERE student_id IN (SELECT student_id FROM Students WHERE student_id = ? OR LOWER(email) = LOWER(?))', (identifier, identifier))
        cursor.execute('DELETE FROM Students WHERE student_id = ? OR LOWER(email) = LOWER(?)', (identifier, identifier))
        rows = cursor.rowcount
        conn.commit()

        if rows > 0:
            return jsonify({'success': True, 'message': 'Student deleted successfully.'}), 200
        return jsonify({'success': False, 'message': 'Student not found.'}), 404
    finally:
        conn.close()

@app.route('/api/admin/registrations', methods=['GET'])
def get_admin_registrations():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT 
                r.registration_id,
                r.registration_date,
                s.full_name AS student_name,
                s.email AS student_email,
                s.student_id,
                s.department,
                e.event_name,
                e.event_id
            FROM Registrations r
            JOIN Students s ON r.student_id = s.student_id
            JOIN Events e ON r.event_id = e.event_id
            ORDER BY r.registration_id DESC
        ''')
        rows = cursor.fetchall()

        registrations = []
        for r in rows:
            registrations.append({
                'registrationId': r['registration_id'],
                'date': r['registration_date'],
                'studentName': r['student_name'],
                'name': r['student_name'],
                'email': r['student_email'],
                'studentId': r['student_id'],
                'department': r['department'],
                'eventName': r['event_name'],
                'title': r['event_name'],
                'eventId': r['event_id']
            })
        return jsonify({'success': True, 'registrations': registrations}), 200
    finally:
        conn.close()

# ----------------- STATIC FILE ROUTES -----------------
@app.route('/')
def home():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    if path.startswith('api'):
        return jsonify({'success': False, 'message': f'API route /{path} not found.'}), 404
    if os.path.exists(path):
        return send_from_directory('.', path)
    return send_from_directory('.', 'index.html')

if __name__ == '__main__':
    init_db()
    print("Starting CampusConnect Flask Server on http://127.0.0.1:5000")
    app.run(debug=True, port=5000)
