# Setting up the sign-in apps

Xezina talks to Google Drive, Dropbox and OneDrive with the user's own account through OAuth.
Each provider needs one "app" registration, done **once by whoever publishes the build**
(not by every user). Client ids are not secrets; they are compiled in from `.env`:

```bash
cp .env.example .env   # then fill in the ids and rebuild
```

Users can also paste their own ids under **Settings → Advanced**, which shows the exact
redirect address to register. Extension redirect addresses look like:

- Chrome / Edge / Brave: `https://fpihconfdbhongoogejkdhcjlafgfhbg.chromiumapp.org/`
- Firefox: `https://cf008288d841bdda5652bd4ecfc577d39bf05031.extensions.allizom.org/`

The Chromium id is fixed by the public key in `keys/public.txt` (the `key` field of the
manifest), so every install of this build, packed or unpacked, has the same id and address.
Builds from a fork with its own key get their own id; Settings → Advanced always shows the
address in use.

No personal identity verification is needed for any of these.

## Google Drive

1. <https://console.cloud.google.com/> → new project → *APIs & Services* → enable **Google Drive API**.
2. *OAuth consent screen* (Google Auth Platform → Branding/Audience): External; app name
   "Xezina"; home page `https://mostafasadeghidev.github.io/xezina/`; privacy policy
   `https://mostafasadeghidev.github.io/xezina/privacy.html`.
3. *Data access* → add scope `https://www.googleapis.com/auth/drive.file` (non-sensitive).
   Xezina keeps its data in a visible "Xezina" folder and only sees files it created.
4. *Audience* → **Publish app** (In production). With only non-sensitive scopes, Google does not
   require a review, and there is no 100-user limit or 7-day token expiry.
5. *Clients* → Create client → **Web application** → add the redirect addresses above as
   *Authorized redirect URIs* → copy the client id to `WXT_GDRIVE_CLIENT_ID`.

Xezina uses the token flow (no client secret). The access token lasts one hour and is renewed
silently.

## Dropbox

1. <https://www.dropbox.com/developers/apps> → *Create app* → **Scoped access** → **App folder** →
   name "Xezina" (users then find their data in `Apps/Xezina`).
2. *Permissions*: `files.content.read`, `files.content.write` → Submit.
3. *Settings → OAuth 2 → Redirect URIs*: add the redirect addresses.
4. Copy the **App key** to `WXT_DROPBOX_CLIENT_ID`.
5. Up to 50 users can connect in development status; click **Apply for production** (free,
   reviews the app, not you) to remove the limit.

## OneDrive (Microsoft)

1. <https://entra.microsoft.com/> (a personal Microsoft account works) → *App registrations* →
   New registration → "Xezina" (the OneDrive folder becomes `Apps/Xezina`) → *Accounts in any organizational directory and personal
   Microsoft accounts*.
2. *Authentication* → Add a platform → **Single-page application** → add the redirect addresses.
3. *API permissions* → Microsoft Graph → delegated → `Files.ReadWrite.AppFolder`, `offline_access`.
4. Copy the **Application (client) id** to `WXT_ONEDRIVE_CLIENT_ID`.

Without publisher verification the consent screen labels the app "unverified"; it still works for
everyone.

## GitHub (optional "Sign in with GitHub")

Users can always use a fine-grained token instead. For one-click sign-in:

1. <https://github.com/settings/developers> → *New OAuth App* → homepage
   `https://mostafasadeghidev.github.io/xezina/`, callback the same URL.
2. Tick **Enable Device Flow**.
3. Copy the client id to `WXT_GITHUB_CLIENT_ID`.

Xezina then creates a private `xezina` repository in the user's account (or `xezina-data`
when that name is already taken by another repository).
