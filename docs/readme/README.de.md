<div align="center">

<img src="../logo.png" width="88" alt="Xezina-Logo">

# Xezina

**Ihre Lesezeichen in jedem Browser – geordnet, durchsuchbar und gespeichert, wo *Sie* es wollen.**

[![Release](https://img.shields.io/github/v/release/mostafasadeghidev/xezina?color=5b5bf0&label=release)](https://github.com/mostafasadeghidev/xezina/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/mostafasadeghidev/xezina/ci.yml?label=tests)](https://github.com/mostafasadeghidev/xezina/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](../../LICENSE)
![Chrome · Edge · Firefox · Brave](https://img.shields.io/badge/browsers-Chrome%20·%20Edge%20·%20Firefox%20·%20Brave-555)

[English](../../README.md) · [فارسی](README.fa.md) · [کوردی](README.ckb.md) · [العربية](README.ar.md) · **Deutsch** · [Français](README.fr.md) · [Italiano](README.it.md) · [Português](README.pt.md)

[Website](https://mostafasadeghidev.github.io/xezina/) · [Download](https://github.com/mostafasadeghidev/xezina/releases/latest) · [Datenschutz](https://mostafasadeghidev.github.io/xezina/privacy.html)

<img src="../screenshots/library-dark.png" alt="Xezina-Bibliothek" width="900">

</div>

## Warum Xezina?

Sie speichern Hunderte Seiten, finden sie dann nicht wieder, und jeder Browser hat einen anderen Satz Lesezeichen.
Xezina löst beides:

- **Ein Satz Lesezeichen überall.** Chrome, Edge, Brave, Opera, Vivaldi und Firefox bleiben identisch.
- **Eine Bibliothek, die sich wirklich durchsuchen lässt.** Notizen, Tags, Vorschauen und Sofortsuche über alles.
- **Kein Konto, kein Server von uns.** Ihre Daten bleiben in Ihrer eigenen Cloud oder auf Ihrem eigenen Server.

## Funktionen

| | |
|---|---|
| 🔄 **Echte Zwei-Wege-Synchronisierung** | Änderungen, die gleichzeitig in verschiedenen Browsern vorgenommen werden, werden Feld für Feld zusammengeführt. Eine Umbenennung in einem Browser und eine Verschiebung in einem anderen bleiben beide erhalten. |
| ☁️ **Speicher Ihrer Wahl** | Google Drive, Dropbox, OneDrive, WebDAV/Nextcloud, S3/Cloudflare R2 oder ein privates GitHub-Repository. |
| 🔎 **Alles durchsuchen** | Titel, Adressen, Ihre Notizen, Tags, Ordnernamen und Seitenbeschreibungen. Toleriert Tippfehler und versteht persische/arabische Buchstabenvarianten. Nutzen Sie die Filter `#tag` und `site:example.com` oder tippen Sie `bm` + Leertaste in die Adressleiste. |
| 🔎 **Schnellsuche** | Überall in Xezina <kbd>Strg</kbd>+<kbd>K</kbd> drücken: eine schwebende Suche mit Live-Vorschlägen und Vorschau für jedes Ergebnis. |
| ⭐ **Funktioniert mit dem Browser-Stern** | Wie gewohnt mit dem Stern oder Strg+D speichern: Xezina ergänzt Screenshot und Seitenbeschreibung und lässt Sie Notizen hinzufügen. Oder <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> drücken. |
| 🏷️ **Kurze Titel bleiben kurz** | Behalten Sie in der Lesezeichenleiste einen Ein-Buchstaben-Titel (oder keinen); Xezina zeigt einen Anzeigenamen und den echten Seitentitel und findet das Lesezeichen über beide. |
| 📝 **Notizen & Tags** | Notieren Sie, warum Sie eine Seite gespeichert haben, und versehen Sie sie mit Tags. Notizen und Tags werden mit dem Lesezeichen synchronisiert. |
| 🖼️ **Vorschauen** | Das eigene Vorschaubild der Website oder ein Screenshot, der beim Besuch einer gespeicherten Seite aufgenommen wird. |
| 🧹 **Aufräumwerkzeuge** | Duplikate und defekte Links finden. Viele Lesezeichen auf einmal verschieben, taggen oder löschen – oder sie auf einen Ordner ziehen. |
| 🔐 **Ende-zu-Ende-Verschlüsselung** | Optional. Die Daten werden vor dem Hochladen in Ihrem Browser mit Ihrer Passphrase verschlüsselt (AES-256-GCM). |
| 🛟 **Sicherheitsnetz** | Automatische Sicherung vor jeder Synchronisierung, Wiederherstellung mit einem Klick und eine Rückfrage vor jeder Synchronisierung, die viele Lesezeichen löschen würde. |
| 🌍 **8 Sprachen** | English, فارسی, کوردی (سۆرانی), العربية, Deutsch, Français, Italiano, Português – mit vollständigem Rechts-nach-links-Layout. |

<div align="center">
<img src="../screenshots/details.png" alt="Notizen und Tags" width="440">
<img src="../screenshots/dashboard.png" alt="Dashboard" width="440">
</div>

## Speicheroptionen

| Speicher | Ideal für | Was Sie brauchen |
|---|---|---|
| **Google Drive** | alle | Anmelden – Dateien landen in einem versteckten App-Ordner |
| **Dropbox** | alle | Anmelden – Dateien landen in `Apps/Xezina` |
| **OneDrive** | alle | Anmelden – Dateien landen in `Apps/Xezina` |
| **WebDAV** | Nextcloud, ownCloud, Synology, QNAP, Ihren eigenen Server | Adresse, Benutzername, App-Passwort |
| **S3-kompatibel** | Cloudflare R2, ArvanCloud, AWS S3, MinIO, Backblaze B2 | Endpoint, Bucket, Zugriffsschlüssel |
| **GitHub** | Entwickler; vollständiger Versionsverlauf | ein Fine-grained Token (Xezina legt ein privates Repository an) |

## Installation

1. Laden Sie die neueste ZIP-Datei von den **[Releases](https://github.com/mostafasadeghidev/xezina/releases/latest)** herunter.
2. **Chrome, Edge, Brave, Opera, Vivaldi:** `xezina-*-chrome.zip` entpacken → `chrome://extensions` öffnen
   (`edge://extensions` in Edge) → **Entwicklermodus** (Developer mode) einschalten → **Entpackte Erweiterung laden** (Load unpacked) → den entpackten Ordner auswählen.
3. **Firefox:** Verwenden Sie `xezina-*-firefox.zip`. Eine signierte Version wird auf addons.mozilla.org veröffentlicht.

Lassen Sie den entpackten Ordner an seinem Platz: Der Browser lädt die Erweiterung von dort.

## Schnellstart

1. Öffnen Sie Xezina mit <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd> oder klicken Sie auf das Symbol in der Symbolleiste → die Raster-Schaltfläche.
2. Gehen Sie zu **Einstellungen → Synchronisierung**, wählen Sie einen Speicher und verbinden Sie ihn.
3. Installieren Sie Xezina in Ihren anderen Browsern und verbinden Sie sie mit **demselben Speicher**.
   Wenn Sie Verschlüsselung nutzen, geben Sie dieselbe Passphrase ein.
4. Fertig. Ihre Lesezeichen erscheinen in der Lesezeichenleiste und im Lesezeichenmenü jedes Browsers. Öffnen Sie die Xezina-Verwaltung
   nur, wenn Sie suchen, Notizen schreiben oder aufräumen möchten.

> [!TIP]
> Schalten Sie die browsereigene Lesezeichen-Synchronisierung (Chrome Sync für Lesezeichen, Favoriten-Synchronisierung in Edge) auf
> Geräten aus, auf denen Xezina synchronisiert, damit nicht zwei Systeme dieselben Lesezeichen bearbeiten.

> [!NOTE]
> Wenn sich ein Browser zum ersten Mal verbindet, werden Lesezeichen, die er bereits mit den anderen teilt (gleicher Ordner,
> gleiche Adresse), zugeordnet statt dupliziert. Soll ein Browser stattdessen **exakt** der Cloud-Kopie entsprechen,
> verwenden Sie einmalig **Einstellungen → Synchronisierung → Diesen Browser an die Cloud angleichen**. Vorher wird eine Sicherung erstellt.

## Häufige Fragen

<details>
<summary><b>Sieht Xezina meine Lesezeichen oder meinen Browserverlauf?</b></summary>

Nein. Es gibt keinen Xezina-Server. Alles geht direkt von Ihrem Browser zu dem Speicher, den Sie
gewählt haben. Seiten werden nur gelesen, wenn Sie Vorschauen erlauben, und nur Seiten, die Sie als Lesezeichen gespeichert haben.
</details>

<details>
<summary><b>Was passiert, wenn ich dasselbe Lesezeichen in zwei Browsern bearbeite?</b></summary>

Jedes Feld (Titel, Adresse, Ordner, Position, Notizen, Tags) wird separat zusammengeführt, und die
neueste Änderung an diesem Feld gewinnt. Unterschiedliche Änderungen am selben Lesezeichen bleiben alle erhalten.
</details>

<details>
<summary><b>Was, wenn bei einer Synchronisierung etwas schiefgeht?</b></summary>

Xezina erstellt vor jeder Synchronisierung, die Ihre Lesezeichen ändert, eine Sicherung. Jede der letzten 30
Sicherungen lässt sich unter **Einstellungen → Sicherungen & Daten** wiederherstellen. Eine Synchronisierung, die viele Lesezeichen löschen würde, wartet auf
Ihre Bestätigung.
</details>

<details>
<summary><b>Die Anmeldung bei Google Drive / Dropbox / OneDrive meldet, dass die App nicht eingerichtet ist.</b></summary>

Diese Dienste erfordern eine einmalige App-Registrierung durch denjenigen, der den Build veröffentlicht. Siehe
[docs/oauth-setup.md](../oauth-setup.md). WebDAV, S3 und GitHub funktionieren ohne.
</details>

<details>
<summary><b>Kann ich meine Lesezeichen exportieren?</b></summary>

Ja. Exportieren Sie nach Standard-HTML (in jeden Browser importierbar) oder JSON (mit Notizen und Tags), und
importieren Sie HTML-Dateien – unter **Einstellungen → Sicherungen & Daten**.
</details>

## So funktioniert die Synchronisierung

Jedes Lesezeichen ist ein Datensatz, dessen Felder jeweils einen Zeitstempel einer hybriden logischen Uhr (Hybrid Logical Clock) tragen. Jedes Gerät
lädt seine vollständige zusammengeführte Kopie als einzelne Datei (`devices/<id>.xz`) hoch und liest die Dateien der anderen Geräte.
Beim Zusammenführen wird für jedes Feld der neueste Wert übernommen, sodass das Ergebnis unabhängig von der Reihenfolge, in der die
Dateien eintreffen, gleich ist (ein zustandsbasiertes CRDT). Da jedes Gerät nur seine eigene Datei schreibt, funktioniert jeder einfache Dateispeicher,
und zwei Geräte können sich niemals gegenseitig überschreiben. Gelöschte Elemente werden als Tombstones aufbewahrt; ein Ordner, der auf einem Gerät gelöscht wird
und auf einem anderen ein neues Lesezeichen erhält, kehrt mit diesem Lesezeichen zurück. Die Reihenfolge innerhalb von Ordnern verwendet Fractional Indexing.

## Entwicklung

```bash
pnpm install
pnpm dev                 # Chrome with live reload  (pnpm dev:firefox for Firefox)
pnpm test                # unit tests + randomized multi-browser sync simulations
pnpm build && node scripts/e2e.mjs        # two real Edge profiles syncing over WebDAV
pnpm build && node scripts/screenshots.mjs  # regenerate docs/screenshots
pnpm zip && pnpm zip:firefox
```

| Ordner | Inhalt |
|---|---|
| `src/core` | Datenmodell, CRDT-Zusammenführung, Reihenfolge, Suche |
| `src/sync` | Lesen/Anwenden von Browser-Lesezeichen, Zuordnung beim ersten Kontakt, Verschlüsselung |
| `src/storage` | ein kleiner Adapter pro Speicheranbieter |
| `src/background` | Scheduler, Vorschauen, Link-Prüfung |
| `src/ui` | Verwaltung, Popup, Übersetzungen (`src/ui/i18n`) |
| `docs` | Website (GitHub Pages), Screenshots, übersetzte READMEs |

**Anmelde-Apps:** Google Drive, Dropbox, OneDrive und „Sign in with GitHub“ benötigen OAuth-Client-IDs,
die beim Build aus `.env` gelesen (siehe `.env.example`) oder von Nutzern unter
**Einstellungen → Erweitert** eingegeben werden. Schritt-für-Schritt-Anleitung: [docs/oauth-setup.md](../oauth-setup.md).

**Übersetzungen:** UI-Texte liegen in `src/ui/i18n/<lang>.ts`, Website-Texte in
`docs/i18n/<lang>.js`. Korrekturen von Muttersprachlern sind sehr willkommen.

## Lizenz

[MIT](../../LICENSE) © Mostafa Sadeghi
