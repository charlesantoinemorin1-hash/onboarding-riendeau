// config.js — mapping documents par département et règles par magasin

const DOCS_DIR = 'docs';

// Documents envoyés à TOUS les nouveaux employés (peu importe magasin/département)
const DOCS_COMMUNS = [
  "1-FORMULAIRE embauche 5 cies.pdf",
  "3-Manuel de employe 2025.pdf",
];

// Conventions collectives par magasin
const CONVENTIONS_COLLECTIVES = {
  'beloeil':      "Convention collective Beloeil.pdf",
  'st-hilaire':   "Convention collective Mont-Saint-Hilaire.pdf",
  'ste-julie':    "Convention collective Sainte-Julie.pdf",
  'st-hubert':    "Convention collective Saint-Hubert.pdf",
  'st-hyacinthe': "Convention collective Saint-Hyacinthe.pdf",
};

// Document syndicat — Beloeil seulement
const DOC_SYNDICAT = "1-Syndicat Beloeil STTPM.pdf";
const MAGASINS_SYNDICAT = ['beloeil'];

// Fiche de tâches par département
const FICHES_TACHES = {
  'caissier':                      "Taches caissier.pdf",
  'boulangerie':                   "Taches commis boulangerie.pdf",
  'charcuterie':                   "Taches commis charcuterie.pdf",
  'emballeur':                     "Taches commis emballeur.pdf",
  'épicerie':                      "Taches commis epicerie.pdf",
  'fruits et légumes transformés': "Taches commis fruits legumes transformes.pdf",
  'mets cuisinés':                 "Taches commis mets cuisines.pdf",
  'fruits et légumes':             "Taches commis fruits legumes.pdf",
  'poissonnerie':                  "Taches commis poissonnerie.pdf",
  'viande':                        "Taches commis viande.pdf",
  'livreur':                       "Taches livreur.pdf",
  'préparateur de commandes':      "Taches preparateur de commandes.pdf",
};

const MAGASINS = [
  { value: 'beloeil',      label: 'Marché Riendeau Beloeil' },
  { value: 'st-hilaire',   label: 'Marché Riendeau Mont-Saint-Hilaire' },
  { value: 'ste-julie',    label: 'Marché Riendeau Sainte-Julie' },
  { value: 'st-hubert',    label: 'Marché Riendeau Saint-Hubert' },
  { value: 'st-hyacinthe', label: 'Marché Riendeau Saint-Hyacinthe' },
];

const DEPARTEMENTS = [
  'Caissier',
  'Boulangerie',
  'Charcuterie',
  'Emballeur',
  'Épicerie',
  'Fruits et légumes',
  'Fruits et légumes transformés',
  'Mets cuisinés',
  'Poissonnerie',
  'Viande',
  'Livreur',
  'Préparateur de commandes',
];

function getDocuments(magasin, departement) {
  const docs = [...DOCS_COMMUNS];

  // Syndicat si Beloeil
  if (MAGASINS_SYNDICAT.includes(magasin.toLowerCase())) {
    docs.push(DOC_SYNDICAT);
  }
  
  // Convention collective selon magasin
  const convention = CONVENTIONS_COLLECTIVES[magasin.toLowerCase()];
  if (convention) docs.push(convention);

  // Fiche de tâches selon département
  const key = departement.toLowerCase();
  const fiche = FICHES_TACHES[key];
  if (fiche) {
    docs.push(fiche);
  } else {
    // Chercher une correspondance partielle
    const match = Object.entries(FICHES_TACHES).find(([k]) => key.includes(k) || k.includes(key));
    if (match) docs.push(match[1]);
  }

  return docs;
}

module.exports = { DOCS_DIR, DOCS_COMMUNS, DOC_SYNDICAT, CONVENTIONS_COLLECTIVES, FICHES_TACHES, MAGASINS, DEPARTEMENTS, getDocuments };