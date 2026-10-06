# iOS : build Codemagic → TestFlight

L'app iOS est générée par Capacitor (`ios/`, Swift Package Manager, pas de CocoaPods) et compilée sur un Mac Codemagic. Rien n'est signé ni compilé en local.

## 1. Apple Developer / App Store Connect

1. **Compte Apple Developer Program** (99 $/an) actif.
2. **Identifiant d'app** — developer.apple.com → Certificates, IDs & Profiles → Identifiers → « + » → App IDs → App :
   - Description : `JourneyPilot AI`
   - Bundle ID (Explicit) : `com.journeypilot.ai`
   - Capabilities : cocher **In-App Purchase** (abonnement RevenueCat). Rien d'autre.
3. **Fiche d'app** — appstoreconnect.apple.com → Apps → « + » → Nouvelle app :
   - Plateforme iOS, nom `JourneyPilot AI`, langue principale Français
   - Bundle ID : `com.journeypilot.ai`, SKU : `journeypilot-ai`
   - Noter l'**Apple ID** numérique de l'app (Informations sur l'app → Informations générales) → variable `APP_STORE_APPLE_ID`.
4. **Clé API App Store Connect** — Utilisateurs et accès → Intégrations → App Store Connect API → « + » :
   - Nom : `Codemagic`, accès : **App Manager**
   - Télécharger le fichier `.p8` (une seule fois possible), noter **Issuer ID** et **Key ID**.
5. **TestFlight** — onglet TestFlight → Tests internes → créer un groupe et s'y ajouter comme testeur.

## 2. Codemagic

1. codemagic.io → Add application → GitHub → `chaouachiifiras/journeypilot-ai` → type **codemagic.yaml**.
2. **Team settings → Integrations → Developer Portal → Connect** : coller Issuer ID, Key ID, le `.p8`.
   - Nom de la clé : **`JourneyPilot App Store Connect`** (doit correspondre exactement à `integrations.app_store_connect` dans `codemagic.yaml`).
3. **Code signing identities → iOS certificates** : « Generate certificate » (type Apple Distribution) via la clé ci-dessus, ou importer un `.p12` existant. Les profils sont récupérés automatiquement au build (`xcode-project use-profiles`, `distribution_type: app_store`).
4. **App settings → Environment variables**, groupe **`journeypilot_ios`** :

   | Variable | Valeur | Secret ? |
   |---|---|---|
   | `APP_STORE_APPLE_ID` | Apple ID numérique de l'app (étape 1.3) | non |
   | `VITE_SUPABASE_URL` | même valeur que le `.env` local | non |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | idem | non (clé publique) |
   | `VITE_SUPABASE_PROJECT_ID` | idem | non |
   | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID` | idem | non |
   | `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`, `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID` | idem | non |
   | `VITE_REVENUECAT_IOS_SDK_KEY` | clé SDK **iOS** RevenueCat (`appl_…`) | non (clé publique) |
   | `VITE_DEBUG_CONSOLE` | `1` pour un build de test avec console d'erreurs visible ; absent en production | non |

   Les clés serveur (`LOVABLE_API_KEY`, `GOOGLE_MAPS_API_KEY`, `REVENUECAT_SECRET_API_KEY`) **ne vont pas ici** : l'app iOS appelle le serveur hébergé par Lovable.
5. Lancer le workflow **iOS → TestFlight** (branche `feature/ios`, puis `main` une fois fusionnée). Comptez ~15 min ; le build apparaît dans TestFlight après le traitement Apple (5–30 min).

## 3. Côté services

- **Supabase → Authentication → URL configuration** : l'URL `https://personal-trip-creator.lovable.app/auth-callback` est déjà autorisée pour Android ; rien à ajouter pour iOS (même rebond vers `com.journeypilot.ai://auth-callback`).
- **RevenueCat** : ajouter une app **App Store** (bundle `com.journeypilot.ai`, clé In-App Purchase / clé API App Store Connect), créer le produit d'abonnement dans App Store Connect et l'attacher à l'entitlement `premium` et à l'offre courante.

## 4. Icône et écran de démarrage

```
python scripts/generate-ios-assets.py chemin/vers/icone-1024.png
```

Source attendue : **1024 × 1024 px, PNG, sans transparence, sans coins arrondis** (iOS les arrondit). Sans argument, le script réutilise `store-assets/play-icon-512.png` agrandi (provisoire).

## 5. Déboguer sur iPhone sans Mac

Console d'erreurs JavaScript intégrée (`src/lib/debug-console.ts`) :

- **Build de test** : définir `VITE_DEBUG_CONSOLE=1` dans le groupe Codemagic → un bouton 🐞 avec le nombre d'erreurs apparaît en bas à gauche dès le lancement.
- **Build normal sur iPhone** : toucher **7 fois le logo** en haut à gauche en moins de 3 s pour activer/désactiver.
- Le panneau liste les erreurs (non interceptées, promesses rejetées, `console.error`) avec la pile ; **Partager** / **Copier** envoie le rapport (plateforme, URL, appareil, erreurs) par message ou mail.
- Inactif sur Android et sur le web.
