// auth.js — Authentification et middleware de session
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const SALT_ROUNDS = 12;

// Store de sessions en mémoire (suffisant pour 30 users)
const sessions = new Map();
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 heures

// ─── Helpers ────────────────────────────────────────────────────

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

// ─── Login / Logout ─────────────────────────────────────────────

async function login(username, password, stmts) {
  const user = stmts.getUserByUsername(username);
  if (!user) return null;

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return null;

  const sessionId = generateSessionId();
  sessions.set(sessionId, {
    userId: user.id,
    username: user.username,
    nom_complet: user.nom_complet,
    role: user.role,
    magasin: user.magasin,
    createdAt: Date.now(),
  });

  return { sessionId, user: { id: user.id, username: user.username, nom_complet: user.nom_complet, role: user.role, magasin: user.magasin } };
}

function logout(sessionId) {
  sessions.delete(sessionId);
}

function getSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_DURATION) {
    sessions.delete(sessionId);
    return null;
  }
  return session;
}

// ─── Middleware Express ──────────────────────────────────────────

function requireAuth(req, res, next) {
  const sessionId = req.cookies?.session;
  if (!sessionId) return res.status(401).json({ error: 'Non authentifié' });

  const session = getSession(sessionId);
  if (!session) return res.status(401).json({ error: 'Session expirée' });

  req.user = session;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  }
  next();
}

function applyMagasinFilter(req) {
  if (req.user.role === 'cadre' && req.user.magasin) {
    return req.user.magasin;
  }
  return req.query.magasin || null;
}

// Nettoyage périodique des sessions expirées
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_DURATION) sessions.delete(id);
  }
}, 30 * 60 * 1000);

module.exports = {
  hashPassword,
  verifyPassword,
  login,
  logout,
  getSession,
  requireAuth,
  requireAdmin,
  applyMagasinFilter,
};
