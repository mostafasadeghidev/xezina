<div align="center">

<img src="../logo.png" width="88" alt="Logo de Xezina">

# Xezina

**Vos favoris, dans tous vos navigateurs — organisés, consultables et stockés là où *vous* le décidez.**

[![Release](https://img.shields.io/github/v/release/mostafasadeghidev/xezina?color=5b5bf0&label=release)](https://github.com/mostafasadeghidev/xezina/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/mostafasadeghidev/xezina/ci.yml?label=tests)](https://github.com/mostafasadeghidev/xezina/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](../../LICENSE)
![Chrome · Edge · Firefox · Brave](https://img.shields.io/badge/browsers-Chrome%20·%20Edge%20·%20Firefox%20·%20Brave-555)

[English](../../README.md) · [فارسی](README.fa.md) · [کوردی](README.ckb.md) · [العربية](README.ar.md) · [Deutsch](README.de.md) · **Français** · [Italiano](README.it.md) · [Português](README.pt.md)

[Site web](https://mostafasadeghidev.github.io/xezina/) · [Télécharger](https://github.com/mostafasadeghidev/xezina/releases/latest) · [Confidentialité](https://mostafasadeghidev.github.io/xezina/privacy.html)

<img src="../screenshots/library-dark.png" alt="Bibliothèque Xezina" width="900">

</div>

## Pourquoi Xezina ?

Vous enregistrez des centaines de pages, puis vous ne les retrouvez plus, et chaque navigateur a sa propre collection.
Xezina règle les deux problèmes :

- **Une seule collection de favoris, partout.** Chrome, Edge, Brave, Opera, Vivaldi et Firefox restent identiques.
- **Une bibliothèque où l’on trouve vraiment ce que l’on cherche.** Notes, tags, aperçus et recherche instantanée sur tout le contenu.
- **Aucun compte, aucun serveur à nous.** Vos données restent dans votre propre cloud ou sur votre propre serveur.

## Fonctionnalités

| | |
|---|---|
| 🔄 **Vraie synchronisation bidirectionnelle** | Les modifications faites en même temps dans différents navigateurs sont fusionnées champ par champ. Un renommage dans un navigateur et un déplacement dans un autre sont tous deux conservés. |
| ☁️ **Le stockage de votre choix** | Google Drive, Dropbox, OneDrive, WebDAV/Nextcloud, S3/Cloudflare R2, ou un dépôt GitHub privé. |
| 🔎 **Recherchez dans tout** | Titres, adresses, vos notes, tags, noms de dossiers et descriptions de pages. Tolère les fautes de frappe et reconnaît les variantes de lettres persanes/arabes. Utilisez les filtres `#tag` et `site:example.com`, ou tapez `bm` + espace dans la barre d’adresse. |
| 🔎 **Recherche rapide** | Appuyez sur <kbd>Ctrl</kbd>+<kbd>K</kbd> n’importe où dans Xezina : une recherche flottante avec suggestions en direct et aperçu de chaque résultat. |
| ⭐ **Compatible avec l’étoile du navigateur** | Ajoutez un favori avec l’étoile ou Ctrl+D comme d’habitude : Xezina ajoute une capture et la description de la page, puis vous propose d’ajouter des notes. Ou appuyez sur <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>. |
| 🏷️ **Les titres courts restent courts** | Gardez un titre d’une lettre (ou aucun) dans la barre de favoris ; Xezina affiche un nom personnalisé et le vrai titre de la page, et retrouve le favori par les deux. |
| 📝 **Notes et tags** | Notez pourquoi vous avez enregistré une page et ajoutez-lui des tags. Les notes et les tags se synchronisent avec le favori. |
| 🖼️ **Aperçus** | L’image d’aperçu du site lui-même, ou une capture d’écran prise lorsque vous visitez une page en favori. |
| 🧹 **Outils de nettoyage** | Repérez les doublons et les liens morts. Déplacez, taguez ou supprimez de nombreux favoris d’un coup, ou faites-les glisser sur un dossier. |
| 🔐 **Chiffrement de bout en bout** | Facultatif. Les données sont chiffrées dans votre navigateur avec votre phrase secrète (AES-256-GCM) avant d’être envoyées. |
| 🛟 **Filet de sécurité** | Sauvegarde automatique avant chaque synchronisation, restauration en un clic, et confirmation avant toute synchronisation qui supprimerait de nombreux favoris. |
| 🌍 **8 langues** | English, فارسی, کوردی (سۆرانی), العربية, Deutsch, Français, Italiano, Português — avec une mise en page entièrement de droite à gauche. |

<div align="center">
<img src="../screenshots/details.png" alt="Notes et tags" width="440">
<img src="../screenshots/dashboard.png" alt="Tableau de bord" width="440">
</div>

## Options de stockage

| Stockage | Idéal pour | Ce qu’il vous faut |
|---|---|---|
| **Google Drive** | tout le monde | se connecter — les fichiers vont dans un dossier d’application caché |
| **Dropbox** | tout le monde | se connecter — les fichiers vont dans `Apps/Xezina` |
| **OneDrive** | tout le monde | se connecter — les fichiers vont dans `Apps/Xezina` |
| **WebDAV** | Nextcloud, ownCloud, Synology, QNAP, votre propre serveur | adresse, nom d’utilisateur, mot de passe d’application |
| **Compatible S3** | Cloudflare R2, ArvanCloud, AWS S3, MinIO, Backblaze B2 | endpoint, bucket, clés d’accès |
| **GitHub** | développeurs ; historique complet des versions | un jeton à granularité fine (Xezina crée un dépôt privé) |

## Installation

1. Téléchargez le dernier zip depuis les **[Releases](https://github.com/mostafasadeghidev/xezina/releases/latest)**.
2. **Chrome, Edge, Brave, Opera, Vivaldi :** décompressez `xezina-*-chrome.zip` → ouvrez `chrome://extensions`
   (`edge://extensions` dans Edge) → activez le **Developer mode** (mode développeur) → **Load unpacked** (charger l’extension non empaquetée) → choisissez le dossier décompressé.
3. **Firefox :** utilisez `xezina-*-firefox.zip`. Une version signée sera publiée sur addons.mozilla.org.

Ne déplacez pas le dossier décompressé : le navigateur charge l’extension à partir de celui-ci.

## Prise en main

1. Ouvrez Xezina avec <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd>, ou cliquez sur l’icône de la barre d’outils → le bouton grille.
2. Allez dans **Paramètres → Synchronisation**, choisissez un stockage et connectez-vous.
3. Installez Xezina dans vos autres navigateurs et connectez-les **au même stockage**.
   Si vous utilisez le chiffrement, saisissez la même phrase secrète.
4. C’est fait. Vos favoris apparaissent dans la barre et le menu des favoris de chaque navigateur. N’ouvrez le
   gestionnaire Xezina que lorsque vous voulez chercher, écrire des notes ou faire du rangement.

> [!TIP]
> Désactivez la synchronisation des favoris propre au navigateur (Chrome Sync pour les favoris, synchronisation des favoris d’Edge)
> sur les appareils où Xezina synchronise, afin que deux systèmes ne modifient pas les mêmes favoris.

> [!NOTE]
> La première fois qu’un navigateur se connecte, les favoris qu’il partage déjà avec les autres (même dossier,
> même adresse) sont associés plutôt que dupliqués. Pour qu’un navigateur corresponde **exactement** à la copie
> du cloud, utilisez une fois **Paramètres → Synchronisation → Aligner ce navigateur sur le cloud**. Une sauvegarde est faite au préalable.

## FAQ

<details>
<summary><b>Xezina voit-il mes favoris ou ma navigation ?</b></summary>

Non. Il n’existe aucun serveur Xezina. Tout part directement de votre navigateur vers le stockage que vous
avez choisi. Les pages ne sont lues que si vous autorisez les aperçus, et uniquement les pages que vous avez mises en favori.
</details>

<details>
<summary><b>Que se passe-t-il si je modifie le même favori dans deux navigateurs ?</b></summary>

Chaque champ (titre, adresse, dossier, position, notes, tags) est fusionné séparément, et la modification
la plus récente de ce champ l’emporte. Des modifications différentes d’un même favori sont toutes conservées.
</details>

<details>
<summary><b>Et si une synchronisation tourne mal ?</b></summary>

Xezina fait une sauvegarde avant chaque synchronisation qui modifie vos favoris. Restaurez l’une des 30 dernières
sauvegardes dans **Paramètres → Sauvegardes et données**. Une synchronisation qui supprimerait de nombreux favoris attend
votre confirmation.
</details>

<details>
<summary><b>La connexion à Google Drive / Dropbox / OneDrive indique que l’application n’est pas configurée.</b></summary>

Ces services nécessitent un enregistrement unique de l’application par la personne qui publie le build. Voir
[docs/oauth-setup.md](../oauth-setup.md). WebDAV, S3 et GitHub fonctionnent sans cela.
</details>

<details>
<summary><b>Puis-je exporter mes favoris ?</b></summary>

Oui. Exportez au format HTML standard (importable dans n’importe quel navigateur) ou JSON (avec notes et tags), et
importez des fichiers HTML, dans **Paramètres → Sauvegardes et données**.
</details>

## Fonctionnement de la synchronisation

Chaque favori est un enregistrement dont chaque champ porte un horodatage d’horloge logique hybride. Chaque appareil
envoie sa copie fusionnée complète sous forme d’un fichier unique (`devices/<id>.xz`) et lit les fichiers des autres
appareils. La fusion retient la valeur la plus récente de chaque champ, si bien que le résultat est le même quel que soit
l’ordre d’arrivée des fichiers (un CRDT basé sur l’état). Comme chaque appareil n’écrit que son propre fichier, n’importe quel
stockage de fichiers simple convient, et deux appareils ne peuvent jamais s’écraser mutuellement. Les éléments supprimés sont conservés sous forme
de « tombstones » ; un dossier supprimé sur un appareil qui reçoit un nouveau favori sur un autre réapparaît avec
ce favori. L’ordre à l’intérieur des dossiers repose sur une indexation fractionnaire.

## Développement

```bash
pnpm install
pnpm dev                 # Chrome with live reload  (pnpm dev:firefox for Firefox)
pnpm test                # unit tests + randomized multi-browser sync simulations
pnpm build && node scripts/e2e.mjs        # two real Edge profiles syncing over WebDAV
pnpm build && node scripts/screenshots.mjs  # regenerate docs/screenshots
pnpm zip && pnpm zip:firefox
```

| Dossier | Contenu |
|---|---|
| `src/core` | modèle de données, fusion CRDT, ordonnancement, recherche |
| `src/sync` | lecture/application des favoris du navigateur, association au premier contact, chiffrement |
| `src/storage` | un petit adaptateur par fournisseur de stockage |
| `src/background` | planificateur, aperçus, vérificateur de liens |
| `src/ui` | gestionnaire, popup, traductions (`src/ui/i18n`) |
| `docs` | site web (GitHub Pages), captures d’écran, README traduits |

**Applications de connexion :** Google Drive, Dropbox, OneDrive et « Sign in with GitHub » nécessitent des identifiants client OAuth,
lus au moment du build depuis `.env` (voir `.env.example`) ou saisis par les utilisateurs dans
**Paramètres → Avancé**. Guide pas à pas : [docs/oauth-setup.md](../oauth-setup.md).

**Traductions :** les textes de l’interface se trouvent dans `src/ui/i18n/<lang>.ts`, ceux du site web dans
`docs/i18n/<lang>.js`. Les corrections de locuteurs natifs sont les bienvenues.

## Licence

[MIT](../../LICENSE) © Mostafa Sadeghi
