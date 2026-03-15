// database.js — SQLite setup avec sql.js (zéro compilation native)
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.db');

let db = null;

// Sauvegarde automatique sur disque après chaque écriture
function saveDb() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ─── Init async (doit être appelé au démarrage) ─────────────────
async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nom_complet TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'cadre')),
      magasin TEXT,
      actif INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prenom TEXT NOT NULL,
      nom TEXT NOT NULL,
      courriel TEXT NOT NULL,
      magasin TEXT NOT NULL,
      departement TEXT NOT NULL,
      date_embauche TEXT,
      statut TEXT DEFAULT 'actif' CHECK(statut IN ('actif', 'probation', 'terminé')),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS onboarding_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      prenom TEXT NOT NULL,
      nom TEXT NOT NULL,
      courriel TEXT NOT NULL,
      magasin TEXT NOT NULL,
      departement TEXT NOT NULL,
      documents_envoyes TEXT,
      statut TEXT DEFAULT 'envoyé' CHECK(statut IN ('envoyé', 'complété', 'erreur')),
      envoye_par INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      FOREIGN KEY (envoye_par) REFERENCES admin_users(id)
    )
  `);

  try { db.run('CREATE INDEX IF NOT EXISTS idx_employees_magasin ON employees(magasin)'); } catch {}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_employees_departement ON employees(departement)'); } catch {}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_onboarding_magasin ON onboarding_logs(magasin)'); } catch {}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role)'); } catch {}

  saveDb();
  console.log('[DB] SQLite initialisé (sql.js) -', DB_PATH);
  return db;
}

// ─── Helpers : convertir les résultats sql.js en objets ─────────
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function runSql(sql, params = []) {
  db.run(sql, params);
  saveDb();
  const lastId = queryOne('SELECT last_insert_rowid() as id');
  return { lastInsertRowid: lastId ? lastId.id : null };
}

// ─── Admin Users ────────────────────────────────────────────────
const stmts = {
  insertUser(username, passwordHash, nomComplet, role, magasin) {
    return runSql('INSERT INTO admin_users (username, password_hash, nom_complet, role, magasin) VALUES (?, ?, ?, ?, ?)',
      [username, passwordHash, nomComplet, role, magasin]);
  },
  getUserByUsername(username) {
    return queryOne('SELECT * FROM admin_users WHERE username = ? AND actif = 1', [username]);
  },
  getUserById(id) {
    return queryOne('SELECT id, username, nom_complet, role, magasin, actif, created_at FROM admin_users WHERE id = ?', [id]);
  },
  getAllUsers() {
    return queryAll('SELECT id, username, nom_complet, role, magasin, actif, created_at FROM admin_users ORDER BY role, nom_complet');
  },
  updateUser(nomComplet, role, magasin, id) {
    runSql("UPDATE admin_users SET nom_complet = ?, role = ?, magasin = ?, updated_at = datetime('now','localtime') WHERE id = ?",
      [nomComplet, role, magasin, id]);
  },
  updatePassword(passwordHash, id) {
    runSql("UPDATE admin_users SET password_hash = ?, updated_at = datetime('now','localtime') WHERE id = ?", [passwordHash, id]);
  },
  toggleUser(actif, id) {
    runSql("UPDATE admin_users SET actif = ?, updated_at = datetime('now','localtime') WHERE id = ?", [actif, id]);
  },

  // Employees
  insertEmployee(prenom, nom, courriel, magasin, departement, dateEmbauche, statut) {
    return runSql('INSERT INTO employees (prenom, nom, courriel, magasin, departement, date_embauche, statut) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [prenom, nom, courriel, magasin, departement, dateEmbauche, statut]);
  },
  getEmployeeById(id) {
    return queryOne('SELECT * FROM employees WHERE id = ?', [id]);
  },
  updateEmployee(prenom, nom, courriel, magasin, departement, dateEmbauche, statut, notes, id) {
    runSql("UPDATE employees SET prenom = ?, nom = ?, courriel = ?, magasin = ?, departement = ?, date_embauche = ?, statut = ?, notes = ?, updated_at = datetime('now','localtime') WHERE id = ?",
      [prenom, nom, courriel, magasin, departement, dateEmbauche, statut, notes, id]);
  },
  deleteEmployee(id) {
    runSql('DELETE FROM employees WHERE id = ?', [id]);
  },

  // Onboarding logs
  insertLog(employeeId, prenom, nom, courriel, magasin, departement, documentsEnvoyes, statut, envoyePar) {
    return runSql('INSERT INTO onboarding_logs (employee_id, prenom, nom, courriel, magasin, departement, documents_envoyes, statut, envoye_par) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [employeeId, prenom, nom, courriel, magasin, departement, documentsEnvoyes, statut, envoyePar]);
  },
  updateLogStatus(statut, id) {
    runSql('UPDATE onboarding_logs SET statut = ? WHERE id = ?', [statut, id]);
  },
};

// ─── Fonctions de requête avec filtres ──────────────────────────

function getEmployees(filters = {}) {
  let sql = 'SELECT * FROM employees WHERE 1=1';
  const params = [];
  if (filters.magasin) { sql += ' AND magasin = ?'; params.push(filters.magasin); }
  if (filters.departement) { sql += ' AND departement = ?'; params.push(filters.departement); }
  if (filters.statut) { sql += ' AND statut = ?'; params.push(filters.statut); }
  if (filters.search) {
    sql += ' AND (prenom LIKE ? OR nom LIKE ? OR courriel LIKE ?)';
    const s = `%${filters.search}%`;
    params.push(s, s, s);
  }
  sql += ' ORDER BY nom, prenom';
  return queryAll(sql, params);
}

function getOnboardingLogs(filters = {}) {
  let sql = 'SELECT * FROM onboarding_logs WHERE 1=1';
  const params = [];
  if (filters.magasin) { sql += ' AND magasin = ?'; params.push(filters.magasin); }
  if (filters.departement) { sql += ' AND departement = ?'; params.push(filters.departement); }
  if (filters.statut) { sql += ' AND statut = ?'; params.push(filters.statut); }
  sql += ' ORDER BY created_at DESC';
  return queryAll(sql, params);
}

function getDashboardStats(magasin = null) {
  const where = magasin ? 'WHERE magasin = ?' : '';
  const params = magasin ? [magasin] : [];

  const totalEmployes = queryOne(`SELECT COUNT(*) as n FROM employees ${where}`, params).n;
  const enProbation = queryOne(`SELECT COUNT(*) as n FROM employees ${where ? where + " AND" : "WHERE"} statut = 'probation'`, params).n;
  const totalOnboardings = queryOne(`SELECT COUNT(*) as n FROM onboarding_logs ${where}`, params).n;
  const onboardingsCompletes = queryOne(`SELECT COUNT(*) as n FROM onboarding_logs ${where ? where + " AND" : "WHERE"} statut = 'complété'`, params).n;
  const recent = queryOne(`SELECT COUNT(*) as n FROM onboarding_logs ${where ? where + " AND" : "WHERE"} created_at >= datetime('now','-30 days')`, params).n;
  const parMagasin = queryAll('SELECT magasin, COUNT(*) as n FROM onboarding_logs GROUP BY magasin ORDER BY n DESC');

  return { totalEmployes, enProbation, totalOnboardings, onboardingsCompletes, recent, parMagasin };
}

function findEmployeeByEmail(courriel, magasin) {
  return queryOne('SELECT id FROM employees WHERE courriel = ? AND magasin = ?', [courriel, magasin]);
}

module.exports = {
  initDatabase,
  stmts,
  getEmployees,
  getOnboardingLogs,
  getDashboardStats,
  findEmployeeByEmail,
};
