<div align="center">

<img src="../logo.png" width="88" alt="Logo di Xezina">

# Xezina

**I tuoi segnalibri, in ogni browser — organizzati, ricercabili e salvati dove decidi *tu*.**

[![Release](https://img.shields.io/github/v/release/mostafasadeghidev/xezina?color=5b5bf0&label=release)](https://github.com/mostafasadeghidev/xezina/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/mostafasadeghidev/xezina/ci.yml?label=tests)](https://github.com/mostafasadeghidev/xezina/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](../../LICENSE)
![Chrome · Edge · Firefox · Brave](https://img.shields.io/badge/browsers-Chrome%20·%20Edge%20·%20Firefox%20·%20Brave-555)

[English](../../README.md) · [فارسی](README.fa.md) · [کوردی](README.ckb.md) · [العربية](README.ar.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · **Italiano** · [Português](README.pt.md)

[Sito web](https://mostafasadeghidev.github.io/xezina/) · [Download](https://github.com/mostafasadeghidev/xezina/releases/latest) · [Privacy](https://mostafasadeghidev.github.io/xezina/privacy.html)

<img src="../screenshots/library-dark.png" alt="Libreria di Xezina" width="900">

</div>

## Perché Xezina?

Salvi centinaia di pagine, poi non riesci a ritrovarle, e ogni browser ha una raccolta diversa.
Xezina risolve entrambi i problemi:

- **Un’unica raccolta di segnalibri, ovunque.** Chrome, Edge, Brave, Opera, Vivaldi e Firefox restano identici.
- **Una libreria in cui cercare davvero.** Note, tag, anteprime e ricerca istantanea su tutto.
- **Nessun account, nessun server nostro.** I tuoi dati restano nel tuo cloud o sul tuo server.

## Funzionalità

| | |
|---|---|
| 🔄 **Vera sincronizzazione bidirezionale** | Le modifiche fatte contemporaneamente in browser diversi vengono unite campo per campo. Una rinomina in un browser e uno spostamento in un altro vengono mantenuti entrambi. |
| ☁️ **Lo spazio di archiviazione che preferisci** | Google Drive, Dropbox, OneDrive, WebDAV/Nextcloud, S3/Cloudflare R2 o un repository GitHub privato. |
| 🔎 **Cerca in tutto** | Titoli, indirizzi, le tue note, tag, nomi delle cartelle e descrizioni delle pagine. Tollera gli errori di battitura e riconosce le varianti delle lettere persiane/arabe. Usa i filtri `#tag` e `site:example.com`, oppure digita `bm` + spazio nella barra degli indirizzi. |
| 🔎 **Ricerca rapida** | Premi <kbd>Ctrl</kbd>+<kbd>K</kbd> ovunque in Xezina: una ricerca fluttuante con suggerimenti in tempo reale e anteprima di ogni risultato. |
| ⭐ **Funziona con la stella del browser** | Salva con la stella o Ctrl+D come sempre: Xezina aggiunge uno screenshot e la descrizione della pagina, poi ti fa aggiungere note. Oppure premi <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>. |
| 🏷️ **I titoli brevi restano brevi** | Tieni un titolo di una lettera (o vuoto) nella barra dei segnalibri; Xezina mostra un nome visualizzato e il vero titolo della pagina, e lo trova con entrambi. |
| 📝 **Note e tag** | Scrivi perché hai salvato una pagina e aggiungi dei tag. Note e tag si sincronizzano insieme al segnalibro. |
| 🖼️ **Anteprime** | L’immagine di anteprima del sito stesso, oppure uno screenshot acquisito quando visiti una pagina salvata nei segnalibri. |
| 🧹 **Strumenti di pulizia** | Trova duplicati e link non funzionanti. Sposta, tagga o elimina molti segnalibri in una volta, oppure trascinali su una cartella. |
| 🔐 **Crittografia end-to-end** | Facoltativa. I dati vengono cifrati nel tuo browser con la tua passphrase (AES-256-GCM) prima del caricamento. |
| 🛟 **Rete di sicurezza** | Backup automatico prima di ogni sincronizzazione, ripristino con un clic e una conferma prima di qualsiasi sincronizzazione che eliminerebbe molti segnalibri. |
| 🌍 **8 lingue** | English, فارسی, کوردی (سۆرانی), العربية, Deutsch, Français, Italiano, Português — con layout completo da destra a sinistra. |

<div align="center">
<img src="../screenshots/details.png" alt="Note e tag" width="440">
<img src="../screenshots/dashboard.png" alt="Dashboard" width="440">
</div>

## Opzioni di archiviazione

| Archiviazione | Ideale per | Cosa ti serve |
|---|---|---|
| **Google Drive** | tutti | accedi — i file vanno in una cartella dell’app nascosta |
| **Dropbox** | tutti | accedi — i file vanno in `Apps/Xezina` |
| **OneDrive** | tutti | accedi — i file vanno in `Apps/Xezina` |
| **WebDAV** | Nextcloud, ownCloud, Synology, QNAP, il tuo server | indirizzo, nome utente, password per app |
| **Compatibile S3** | Cloudflare R2, ArvanCloud, AWS S3, MinIO, Backblaze B2 | endpoint, bucket, chiavi di accesso |
| **GitHub** | sviluppatori; cronologia completa delle versioni | un token a granularità fine (Xezina crea un repository privato) |

## Installazione

1. Scarica lo zip più recente dalle **[Releases](https://github.com/mostafasadeghidev/xezina/releases/latest)**.
2. **Chrome, Edge, Brave, Opera, Vivaldi:** estrai `xezina-*-chrome.zip` → apri `chrome://extensions`
   (`edge://extensions` in Edge) → attiva la **Developer mode** (modalità sviluppatore) → **Load unpacked** (carica estensione non pacchettizzata) → scegli la cartella estratta.
3. **Firefox:** usa `xezina-*-firefox.zip`. Una versione firmata sarà pubblicata su addons.mozilla.org.

Non spostare la cartella estratta: il browser carica l’estensione da lì.

## Guida rapida

1. Apri Xezina con <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd>, oppure fai clic sull’icona nella barra degli strumenti → il pulsante a griglia.
2. Vai in **Impostazioni → Sincronizzazione**, scegli un’archiviazione e collegati.
3. Installa Xezina negli altri browser e collegali **alla stessa archiviazione**.
   Se usi la crittografia, inserisci la stessa passphrase.
4. Fatto. I tuoi segnalibri compaiono nella barra e nel menu dei segnalibri di ogni browser. Apri il gestore
   di Xezina solo quando vuoi cercare, scrivere note o fare ordine.

> [!TIP]
> Disattiva la sincronizzazione dei segnalibri integrata nel browser (Chrome Sync per i segnalibri, sincronizzazione dei preferiti di Edge)
> sui dispositivi in cui sincronizza Xezina, così due sistemi non modificano gli stessi segnalibri.

> [!NOTE]
> La prima volta che un browser si collega, i segnalibri che ha già in comune con gli altri (stessa cartella,
> stesso indirizzo) vengono abbinati anziché duplicati. Per far corrispondere un browser **esattamente** alla copia
> nel cloud, usa una volta **Impostazioni → Sincronizzazione → Allinea questo browser al cloud**. Prima viene creato un backup.

## FAQ

<details>
<summary><b>Xezina vede i miei segnalibri o la mia navigazione?</b></summary>

No. Non esiste alcun server Xezina. Tutto va direttamente dal tuo browser all’archiviazione che hai
scelto. Le pagine vengono lette solo se consenti le anteprime, e solo le pagine che hai salvato nei segnalibri.
</details>

<details>
<summary><b>Cosa succede se modifico lo stesso segnalibro in due browser?</b></summary>

Ogni campo (titolo, indirizzo, cartella, posizione, note, tag) viene unito separatamente, e prevale la modifica
più recente a quel campo. Modifiche diverse allo stesso segnalibro vengono mantenute tutte.
</details>

<details>
<summary><b>E se una sincronizzazione va storta?</b></summary>

Xezina crea un backup prima di ogni sincronizzazione che modifica i tuoi segnalibri. Ripristina uno qualsiasi degli ultimi 30
backup in **Impostazioni → Backup e dati**. Una sincronizzazione che eliminerebbe molti segnalibri attende
la tua conferma.
</details>

<details>
<summary><b>L’accesso a Google Drive / Dropbox / OneDrive dice che l’app non è configurata.</b></summary>

Questi servizi richiedono una registrazione una tantum dell’app da parte di chi pubblica la build. Vedi
[docs/oauth-setup.md](../oauth-setup.md). WebDAV, S3 e GitHub funzionano senza.
</details>

<details>
<summary><b>Posso esportare i miei segnalibri?</b></summary>

Sì. Esporta in HTML standard (importabile da qualsiasi browser) o JSON (con note e tag), e
importa file HTML, in **Impostazioni → Backup e dati**.
</details>

## Come funziona la sincronizzazione

Ogni segnalibro è un record i cui campi portano ciascuno un timestamp di orologio logico ibrido. Ogni dispositivo
carica la sua copia unita completa come un singolo file (`devices/<id>.xz`) e legge i file degli altri
dispositivi. L’unione prende il valore più recente di ogni campo, quindi il risultato è lo stesso in qualunque ordine
arrivino i file (un CRDT basato sullo stato). Poiché ogni dispositivo scrive solo il proprio file, funziona qualsiasi
archiviazione di file semplice, e due dispositivi non possono mai sovrascriversi a vicenda. Gli elementi eliminati vengono conservati come
«tombstone»; una cartella eliminata su un dispositivo che riceve un nuovo segnalibro su un altro ricompare con
quel segnalibro. L’ordine all’interno delle cartelle usa l’indicizzazione frazionaria.

## Sviluppo

```bash
pnpm install
pnpm dev                 # Chrome with live reload  (pnpm dev:firefox for Firefox)
pnpm test                # unit tests + randomized multi-browser sync simulations
pnpm build && node scripts/e2e.mjs        # two real Edge profiles syncing over WebDAV
pnpm build && node scripts/screenshots.mjs  # regenerate docs/screenshots
pnpm zip && pnpm zip:firefox
```

| Cartella | Contenuto |
|---|---|
| `src/core` | modello dati, unione CRDT, ordinamento, ricerca |
| `src/sync` | lettura/applicazione dei segnalibri del browser, abbinamento al primo contatto, crittografia |
| `src/storage` | un piccolo adattatore per ogni provider di archiviazione |
| `src/background` | pianificatore, anteprime, verifica dei link |
| `src/ui` | gestore, popup, traduzioni (`src/ui/i18n`) |
| `docs` | sito web (GitHub Pages), screenshot, README tradotti |

**App di accesso:** Google Drive, Dropbox, OneDrive e «Sign in with GitHub» richiedono client ID OAuth,
letti in fase di build da `.env` (vedi `.env.example`) oppure inseriti dagli utenti in
**Impostazioni → Avanzate**. Guida passo passo: [docs/oauth-setup.md](../oauth-setup.md).

**Traduzioni:** i testi dell’interfaccia si trovano in `src/ui/i18n/<lang>.ts`, quelli del sito web in
`docs/i18n/<lang>.js`. Le correzioni da parte di madrelingua sono molto gradite.

## Licenza

[MIT](../../LICENSE) © Mostafa Sadeghi
