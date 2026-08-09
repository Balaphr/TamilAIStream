'use strict';

// ============================================
// Builder V2 - Separate Authentication System
// ============================================

const BUILDER_V2_CREDENTIALS = {
    username: 'builder@tamilaistream.com',
    password: 'Builder@123'
};

const BUILDER_V2_SESSION_KEY = 'builderV2Session';
const BUILDER_V2_USERS_KEY = 'builderV2Users';

// Get registered builder v2 users
function getBuilderV2Users() {
    try {
        return JSON.parse(localStorage.getItem(BUILDER_V2_USERS_KEY)) || [];
    } catch {
        return [];
    }
}

// Save builder v2 users
function saveBuilderV2Users(users) {
    localStorage.setItem(BUILDER_V2_USERS_KEY, JSON.stringify(users));
}

// Check if user is authenticated for builder v2
function checkBuilderV2Auth() {
    const session = localStorage.getItem(BUILDER_V2_SESSION_KEY);
    if (session) {
        try {
            const data = JSON.parse(session);
            if (data.expiry > Date.now()) {
                return data;
            } else {
                localStorage.removeItem(BUILDER_V2_SESSION_KEY);
                return null;
            }
        } catch (e) {
            localStorage.removeItem(BUILDER_V2_SESSION_KEY);
            return null;
        }
    }
    return null;
}

// Create builder v2 session
function createBuilderV2Session(user) {
    const sessionData = {
        username: user.username || user.email,
        email: user.email,
        displayName: user.displayName || user.username || 'Builder User',
        role: user.role || 'builder',
        loginTime: Date.now(),
        expiry: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };
    localStorage.setItem(BUILDER_V2_SESSION_KEY, JSON.stringify(sessionData));
    return sessionData;
}

// Login with email and password
function loginBuilderV2(email, password) {
    const users = getBuilderV2Users();
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
        // Check default credentials
        if (email === BUILDER_V2_CREDENTIALS.username && password === BUILDER_V2_CREDENTIALS.password) {
            const defaultUser = {
                email: BUILDER_V2_CREDENTIALS.username,
                username: 'builder',
                displayName: 'Builder User',
                role: 'builder'
            };
            return createBuilderV2Session(defaultUser);
        }
        return null;
    }

    return createBuilderV2Session(user);
}

// Sign up new builder v2 user
function signUpBuilderV2(displayName, email, password) {
    const users = getBuilderV2Users();

    // Check if user already exists
    if (users.find(u => u.email === email)) {
        return { success: false, message: 'User already exists' };
    }

    const newUser = {
        username: email.split('@')[0],
        email: email,
        displayName: displayName,
        password: password,
        role: 'builder',
        createdAt: Date.now()
    };

    users.push(newUser);
    saveBuilderV2Users(users);

    // Auto login after signup
    const session = createBuilderV2Session(newUser);
    return { success: true, user: session };
}

// Logout from builder v2
function logoutBuilderV2() {
    localStorage.removeItem(BUILDER_V2_SESSION_KEY);
}

// Redirect to builder v2 login
function redirectToBuilderV2Login() {
    window.location.href = 'builder-v2-login.html';
}

// Check auth and redirect if not logged in
function requireBuilderV2Auth() {
    const session = checkBuilderV2Auth();
    if (!session) {
        redirectToBuilderV2Login();
        return false;
    }
    return true;
}

// Export for use in builder-v2
window.BuilderV2Auth = {
    checkAuth: checkBuilderV2Auth,
    login: loginBuilderV2,
    signup: signUpBuilderV2,
    logout: logoutBuilderV2,
    requireAuth: requireBuilderV2Auth,
    redirectToLogin: redirectToBuilderV2Login,
    credentials: BUILDER_V2_CREDENTIALS
};
