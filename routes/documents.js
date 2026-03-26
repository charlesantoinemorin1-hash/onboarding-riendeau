// routes/documents.js — Gestion des documents d'onboarding
const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');
const { requireAuth, requireAdmin } = require('../auth');
const { MAGASINS, DEPARTEMENTS } = require('../config');

const router = express.Router();
const DOCS_DIR = path.join(__dirname, '..', 'docs');

// ─── Multer — upload dans docs/ ───────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DOCS_DIR),
  filename:    (req, file, cb) => {
    // Utiliser le nom fourni dans le body si présent, sinon nom original
    const nom = req.body.nom_fichier
      ? req.body.nom_fichier.replace(/[^a-zA-Z0-9\-_. ]/g, '').trim()
      : file.originalname;
    cb(null, nom);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Seuls les fichiers PDF sont acceptés'));
  },
});

// ─── Charger / sauvegarder la config dynamique ────────────────────────────
const CONFIG_PATH = path.join(__dirname, '..', 'docs_config.json');

function loadDocsConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return { extra: [] };
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')); }
  catch { return { extra: [] }; }
}

function saveDocsConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// ─── GET /api/documents — liste tous les fichiers + config ────────────────
router.get('/', requireAuth, (req, res) => {
  // Fichiers sur le disque
  let fichiers = [];
  if (fs.existsSync(DOCS_DIR)) {
    fichiers = fs.readdirSync(DOCS_DIR)
      .filter(f => f.endsWith('.pdf'))
      .map(f => {
        const stat = fs.statSync(path.join(DOCS_DIR, f));
        return {
          nom: f,
          taille: stat.size,
          modifie: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => a.nom.localeCompare(b.nom));
  }

  // Config dynamique (documents supplémentaires par poste/magasin)
  const config = loadDocsConfig();

  res.json({ fichiers, extra: config.extra || [] });
});

// ─── POST /api/documents/upload — uploader un fichier ────────────────────
router.post('/upload', requireAuth, requireAdmin, (req, res) => {
  upload.single('fichier')(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });

    console.log(`[DOCS] Upload: ${req.file.filename} (${req.file.size} octets)`);
    res.json({ success: true, fichier: req.file.filename });
  });
});

// ─── DELETE /api/documents/fichier/:nom — supprimer un fichier ───────────
router.delete('/fichier/:nom', requireAuth, requireAdmin, (req, res) => {
  const nom = req.params.nom;
  // Sécurité : pas de path traversal
  if (nom.includes('..') || nom.includes('/') || nom.includes('\\')) {
    return res.status(400).json({ error: 'Nom de fichier invalide' });
  }
  const filepath = path.join(DOCS_DIR, nom);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Fichier introuvable' });

  fs.unlinkSync(filepath);
  console.log(`[DOCS] Supprimé: ${nom}`);
  res.json({ success: true });
});

// ─── GET /api/documents/assignations — mapping poste→documents ───────────
router.get('/assignations', requireAuth, (req, res) => {
  const config = loadDocsConfig();

  // Construire la liste complète des assignations (statiques + dynamiques)
  const { FICHES_TACHES, DOCS_COMMUNS, DOC_SYNDICAT, CONVENTIONS_COLLECTIVES } = require('../config');

  const assignations = [];

  // Documents communs
  DOCS_COMMUNS.forEach(f => {
    assignations.push({ fichier: f, magasin: 'tous', departement: 'tous', type: 'commun' });
  });

  // Syndicat Beloeil
  assignations.push({ fichier: DOC_SYNDICAT, magasin: 'beloeil', departement: 'tous', type: 'syndicat' });

  // Conventions collectives
  Object.entries(CONVENTIONS_COLLECTIVES).forEach(([mag, f]) => {
    assignations.push({ fichier: f, magasin: mag, departement: 'tous', type: 'convention' });
  });

  // Fiches de tâches
  Object.entries(FICHES_TACHES).forEach(([dept, f]) => {
    assignations.push({ fichier: f, magasin: 'tous', departement: dept, type: 'taches' });
  });

  // Extras dynamiques
  (config.extra || []).forEach(e => {
    assignations.push({ ...e, type: 'extra' });
  });

  res.json(assignations);
});

// ─── POST /api/documents/extra — ajouter une assignation dynamique ────────
router.post('/extra', requireAuth, requireAdmin, (req, res) => {
  const { fichier, magasin, departement, description } = req.body;
  if (!fichier) return res.status(400).json({ error: 'Fichier requis' });

  const config = loadDocsConfig();
  config.extra = config.extra || [];

  // Éviter les doublons exacts
  const existe = config.extra.find(e =>
    e.fichier === fichier && e.magasin === (magasin || 'tous') && e.departement === (departement || 'tous')
  );
  if (existe) return res.status(409).json({ error: 'Cette assignation existe déjà' });

  const entry = {
    id:          Date.now(),
    fichier,
    magasin:     magasin     || 'tous',
    departement: departement || 'tous',
    description: description || '',
  };
  config.extra.push(entry);
  saveDocsConfig(config);

  res.json({ success: true, entry });
});

// ─── DELETE /api/documents/extra/:id — retirer une assignation ───────────
router.delete('/extra/:id', requireAuth, requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const config = loadDocsConfig();
  config.extra = (config.extra || []).filter(e => e.id !== id);
  saveDocsConfig(config);
  res.json({ success: true });
});

module.exports = router;
module.exports.loadDocsConfig = loadDocsConfig;
