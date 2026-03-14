# Onboarding Marchés Riendeau — Guide de démarrage

## Structure du projet

```
onboarding/
├── server.js          ← Backend Node.js (Express)
├── config.js          ← Mapping documents / départements / magasins
├── package.json
├── .env.example       ← Copier en .env et remplir
├── public/
│   └── index.html     ← Page web frontend
└── docs/              ← Tous les PDFs à envoyer
```

---

## Étape 1 — Installer les dépendances

```bash
cd onboarding
npm install
```

---

## Étape 2 — Configurer Gmail OAuth2 (10 minutes)

### 2.1 — Créer un projet Google Cloud (gratuit)

1. Va sur https://console.cloud.google.com
2. Clique **"Nouveau projet"** → nomme-le "Onboarding Riendeau"
3. Dans le menu gauche : **APIs & Services → Bibliothèque**
4. Cherche **"Gmail API"** → Activer

### 2.2 — Créer les identifiants OAuth2

1. **APIs & Services → Identifiants → Créer des identifiants → ID client OAuth**
2. Type : **Application Web**
3. Nom : "Onboarding Riendeau"
4. URI de redirection autorisés : `https://developers.google.com/oauthplayground`
5. Clique **Créer** → Note le **Client ID** et le **Client Secret**

### 2.3 — Obtenir le Refresh Token

1. Va sur https://developers.google.com/oauthplayground
2. Clique l'icône ⚙️ (en haut à droite) → coche **"Use your own OAuth credentials"**
3. Entre ton **Client ID** et **Client Secret**
4. Dans la liste à gauche, cherche **"Gmail API v1"** → coche `https://mail.google.com/`
5. Clique **"Authorize APIs"** → connecte-toi avec le compte Gmail d'envoi
6. Clique **"Exchange authorization code for tokens"**
7. Note le **Refresh Token**

### 2.4 — Remplir le fichier .env

```bash
cp .env.example .env
```

Ouvre `.env` et remplis :
```
GMAIL_CLIENT_ID=xxx.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=xxx
GMAIL_REFRESH_TOKEN=xxx
GMAIL_EMAIL=onboarding@votredomaine.com
PORT=3000
```

---

## Étape 3 — Démarrer le serveur

```bash
npm start
```

Ouvre http://localhost:3000 dans ton navigateur.

---

## Logique des documents envoyés

| Condition | Documents joints |
|---|---|
| Tous les employés | Formulaire d'embauche + Manuel de l'employé 2025 |
| Beloeil seulement | + Document syndicat STTPM |
| Selon département | + Fiche de tâches correspondante |

---

## Migration vers Microsoft 365 (phase production)

Quand le projet est approuvé, remplacer dans `server.js` la fonction `createTransporter()` par :

```javascript
const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
  auth: {
    type: 'OAuth2',
    user: process.env.M365_EMAIL,
    clientId: process.env.M365_CLIENT_ID,
    clientSecret: process.env.M365_CLIENT_SECRET,
    refreshToken: process.env.M365_REFRESH_TOKEN,
  }
});
```

Les variables d'environnement s'obtiennent via le portail Azure → App Registration.
