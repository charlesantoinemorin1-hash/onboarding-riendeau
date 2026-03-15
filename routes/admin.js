// routes/admin.js — Routes back-office admin & cadre
const express = require('express');
const router = express.Router();
const { stmts, getEmployees, getOnboardingLogs, getDashboardStats } = require('../database');
const { login, logout, requireAuth, requireAdmin, applyMagasinFilter, hashPassword } = require('../auth');

// ─── Auth routes ────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username et mot de passe requis' });

  const result = await login(username, password, stmts);
  if (!result) return res.status(401).json({ error: 'Identifiants invalides' });

  res.cookie('session', result.sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
  });

  res.json({ success: true, user: result.user });
});

router.post('/logout', (req, res) => {
  const sessionId = req.cookies?.session;
  if (sessionId) logout(sessionId);
  res.clearCookie('session');
  res.json({ success: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ─── Dashboard ──────────────────────────────────────────────────

router.get('/dashboard', requireAuth, (req, res) => {
  const magasin = applyMagasinFilter(req);
  const stats = getDashboardStats(magasin);
  res.json(stats);
});

// ─── Employees ──────────────────────────────────────────────────

router.get('/employees', requireAuth, (req, res) => {
  const magasin = applyMagasinFilter(req);
  const filters = {
    magasin,
    departement: req.query.departement || null,
    statut: req.query.statut || null,
    search: req.query.search || null,
  };
  res.json(getEmployees(filters));
});

router.get('/employees/:id', requireAuth, (req, res) => {
  const emp = stmts.getEmployeeById(parseInt(req.params.id));
  if (!emp) return res.status(404).json({ error: 'Employé non trouvé' });

  if (req.user.role === 'cadre' && emp.magasin !== req.user.magasin) {
    return res.status(403).json({ error: 'Accès non autorisé' });
  }

  res.json(emp);
});

router.post('/employees', requireAuth, requireAdmin, (req, res) => {
  const { prenom, nom, courriel, magasin, departement, date_embauche, statut } = req.body;
  if (!prenom || !nom || !courriel || !magasin || !departement) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }
  try {
    const result = stmts.insertEmployee(prenom, nom, courriel, magasin, departement, date_embauche || null, statut || 'actif');
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/employees/:id', requireAuth, requireAdmin, (req, res) => {
  const { prenom, nom, courriel, magasin, departement, date_embauche, statut, notes } = req.body;
  try {
    stmts.updateEmployee(prenom, nom, courriel, magasin, departement, date_embauche || null, statut || 'actif', notes || null, parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/employees/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    stmts.deleteEmployee(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Onboarding logs ────────────────────────────────────────────

router.get('/onboarding-logs', requireAuth, (req, res) => {
  const magasin = applyMagasinFilter(req);
  const filters = {
    magasin,
    departement: req.query.departement || null,
    statut: req.query.statut || null,
  };
  res.json(getOnboardingLogs(filters));
});

router.put('/onboarding-logs/:id/status', requireAuth, requireAdmin, (req, res) => {
  const { statut } = req.body;
  if (!['envoyé', 'complété', 'erreur'].includes(statut)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }
  try {
    stmts.updateLogStatus(statut, parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Export CSV ─────────────────────────────────────────────────

router.get('/export/employees', requireAuth, requireAdmin, (req, res) => {
  const employees = getEmployees({ magasin: req.query.magasin || null });
  const header = 'ID,Prénom,Nom,Courriel,Magasin,Département,Date embauche,Statut\n';
  const rows = employees.map(e =>
    `${e.id},"${e.prenom}","${e.nom}","${e.courriel}","${e.magasin}","${e.departement}","${e.date_embauche || ''}","${e.statut}"`
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=employes_${new Date().toISOString().slice(0, 10)}.csv`);
  res.send('\uFEFF' + header + rows);
});

router.get('/export/onboarding', requireAuth, requireAdmin, (req, res) => {
  const logs = getOnboardingLogs({ magasin: req.query.magasin || null });
  const header = 'ID,Prénom,Nom,Courriel,Magasin,Département,Documents,Statut,Date\n';
  const rows = logs.map(l =>
    `${l.id},"${l.prenom}","${l.nom}","${l.courriel}","${l.magasin}","${l.departement}","${l.documents_envoyes || ''}","${l.statut}","${l.created_at}"`
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=onboarding_${new Date().toISOString().slice(0, 10)}.csv`);
  res.send('\uFEFF' + header + rows);
});

// ─── Gestion des comptes (admin seulement) ──────────────────────

router.get('/users', requireAuth, requireAdmin, (req, res) => {
  res.json(stmts.getAllUsers());
});

router.post('/users', requireAuth, requireAdmin, async (req, res) => {
  const { username, password, nom_complet, role, magasin } = req.body;
  if (!username || !password || !nom_complet || !role) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }
  if (role === 'cadre' && !magasin) {
    return res.status(400).json({ error: 'Un cadre doit être assigné à un magasin' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
  }
  try {
    const hash = await hashPassword(password);
    const result = stmts.insertUser(username, hash, nom_complet, role, role === 'admin' ? null : magasin);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: "Ce nom d'utilisateur existe déjà" });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const { nom_complet, role, magasin, password } = req.body;
  try {
    if (nom_complet && role) {
      stmts.updateUser(nom_complet, role, role === 'admin' ? null : magasin, parseInt(req.params.id));
    }
    if (password && password.length >= 6) {
      const hash = await hashPassword(password);
      stmts.updatePassword(hash, parseInt(req.params.id));
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id/toggle', requireAuth, requireAdmin, (req, res) => {
  const user = stmts.getUserById(parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

  if (user.id === req.user.userId) {
    return res.status(400).json({ error: 'Vous ne pouvez pas vous désactiver vous-même' });
  }

  stmts.toggleUser(user.actif ? 0 : 1, parseInt(req.params.id));
  res.json({ success: true, actif: !user.actif });
});

module.exports = router;
