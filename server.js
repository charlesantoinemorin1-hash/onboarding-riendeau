require('dotenv').config();

const express      = require('express');
const path         = require('path');
const fs           = require('fs');
const cookieParser = require('cookie-parser');
const sgMail       = require('@sendgrid/mail');
const { DOCS_DIR, MAGASINS, DEPARTEMENTS, getDocuments } = require('./config');

const app  = express();
const PORT = process.env.PORT || 3000;

// Config SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Routes API existantes ──────────────────────────────────────
app.get('/api/magasins',     (req, res) => res.json(MAGASINS));
app.get('/api/departements', (req, res) => res.json(DEPARTEMENTS));

// ─── Routes admin (back-office) ─────────────────────────────────
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// Page admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ─── Route onboarding (existante + log en BD) ───────────────────
app.post('/api/onboarding', async (req, res) => {
  const { prenom, nom, courriel, magasin, departement, consentement } = req.body;

  if (!prenom || !nom || !courriel || !magasin || !departement || consentement !== 'true') {
    return res.status(400).json({ success: false, message: 'Tous les champs sont requis et le consentement doit être accordé.' });
  }

  const docs = getDocuments(magasin, departement);
  const attachments = docs
    .map(filename => {
      const filepath = path.join(__dirname, 'docs', filename);
      console.log('Cherche:', filepath, '->', fs.existsSync(filepath) ? 'TROUVE' : 'ABSENT');
      if (!fs.existsSync(filepath)) return null;
      return {
        filename,
        path: filepath,
        content: fs.readFileSync(filepath).toString('base64'),
        type: 'application/pdf',
        disposition: 'attachment',
      };
    })
    .filter(Boolean);

  console.log(`Pieces jointes: ${attachments.length}/${docs.length}`);

  const magasinLabel = MAGASINS.find(m => m.value === magasin)?.label || magasin;

  const htmlBody = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
        <tr><td style="background:#e31837;padding:32px 40px;">
          <p style="margin:0;color:#ffcccc;font-size:12px;letter-spacing:2px;text-transform:uppercase">Marchés Riendeau</p>
          <h1 style="margin:8px 0 0;color:white;font-size:26px;font-weight:700">Bienvenue, ${prenom}&nbsp;!</h1>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 20px">
            Nous sommes ravis de t'accueillir au sein de l'équipe du <strong>${magasinLabel}</strong>,
            au poste de <strong>${departement.toLowerCase()}</strong>.
          </p>
          <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 28px">
            Tu trouveras en pièces jointes à ce courriel tous les documents importants pour ton intégration :
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff5f5;border-radius:8px;padding:4px 0;margin-bottom:28px;">
            ${attachments.map(a => `
            <tr>
              <td style="padding:10px 20px;border-bottom:1px solid #ffe0e0;">
                <span style="color:#e31837;font-size:13px;">&#128196; ${a.filename}</span>
              </td>
            </tr>`).join('')}
          </table>
          <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">
            <strong>Important :</strong> Lors de ton premier jour, n'oublie pas d'apporter un spécimen de chèque
            avec les documents complétés que tu nous remettras.
          </p>
          <p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 12px">
            Si tu as des questions avant ton premier jour, n'hésite pas à communiquer avec ton gestionnaire.
          </p>
          <p style="color:#333;font-size:15px;line-height:1.7;margin:0">
            On a hâte de te voir !
          </p>
        </td></tr>
        <tr><td style="padding:0 40px 36px;">
          <div style="border-top:1px solid #eee;padding-top:24px;">
            <p style="margin:0;color:#e31837;font-weight:700;font-size:14px">L'équipe Marchés Riendeau</p>
            <p style="margin:4px 0 0;color:#888;font-size:12px">${magasinLabel}</p>
          </div>
        </td></tr>
        <tr><td style="background:#f0f0f0;padding:16px 40px;text-align:center;">
          <p style="margin:0;color:#aaa;font-size:11px">
            Ce courriel vous a été envoyé car vous avez consenti à recevoir des communications de Marchés Riendeau.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // Importer stmts et findEmployeeByEmail après init
  const { stmts, findEmployeeByEmail } = require('./database');

  try {
    const msg = {
      to: courriel,
      from: process.env.FROM_EMAIL,
      subject: `Bienvenue chez ${magasinLabel}, ${prenom}!`,
      html: htmlBody,
      attachments,
    };

    await sgMail.send(msg);

    // Log en BD
    let employeeId = null;
    const existing = findEmployeeByEmail(courriel, magasin);
    if (existing) {
      employeeId = existing.id;
    } else {
      const result = stmts.insertEmployee(prenom, nom, courriel, magasin, departement, new Date().toISOString().slice(0, 10), 'probation');
      employeeId = result.lastInsertRowid;
    }

    stmts.insertLog(employeeId, prenom, nom, courriel, magasin, departement, JSON.stringify(docs), 'envoyé', null);

    console.log(`[${new Date().toISOString()}] Courriel envoye a ${courriel} - ${magasinLabel} / ${departement} - ${attachments.length} pieces jointes`);
    res.json({ success: true });
  } catch (err) {
    console.error('Erreur envoi courriel:', err.message);
    try {
      const { stmts: s } = require('./database');
      s.insertLog(null, prenom, nom, courriel, magasin, departement, JSON.stringify(docs), 'erreur', null);
    } catch (e) { /* silencieux */ }
    res.status(500).json({ success: false, message: "Erreur lors de l'envoi du courriel. Vérifie la configuration SendGrid." });
  }
});

// ─── Démarrage async (pour sql.js) ──────────────────────────────
async function start() {
  const { initDatabase } = require('./database');
  await initDatabase();
  app.listen(PORT, () => console.log(`Onboarding Riendeau - http://localhost:${PORT}`));
}

start().catch(err => {
  console.error('Erreur démarrage:', err);
  process.exit(1);
});
