# H&H SPACES

A simple browser-based construction site tracker for:

- Labour wages
- Material expenses
- Client payments
- Company capital
- Work progress
- Pending payment bills
- Daily updates
- Multiple sites and clients

## How to Use

Open `index.html` in a browser. The system saves data in that browser using local storage.

Use `Company Capital` to add owner/company money first. Use `Sites & Clients` to add at least one site. After that, you can add wages, materials, payments, bills, progress, and daily updates for each site.

The dashboard shows:

- Cash in hand
- Company capital
- Client payments received
- Payment used
- Pending payment bills
- Client balance

## Use on Phone With GitHub Pages

1. Create a new GitHub repository.
2. Upload these files to the repository:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `.nojekyll`
   - `README.md`
3. On GitHub, open the repository settings.
4. Go to `Pages`.
5. Under `Build and deployment`, choose:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
6. Save.
7. GitHub will give you a website link like:
   `https://your-username.github.io/your-repository-name/`
8. Open that link on your phone.

## Supabase Cloud Sync

1. Create a Supabase project.
2. Open Supabase SQL Editor.
3. Paste and run the SQL from `supabase-schema.sql`.
4. In Supabase, go to `Project Settings` > `Data API`.
5. Copy:
   - Project URL
   - anon public key
6. Open the H&H SPACES app.
7. Login.
8. Click `Cloud Sync`.
9. Paste the Project URL and anon public key.
10. Click `Save Connection`.
11. Click `Save To Cloud` once from the device that already has your data.
12. On another phone/computer, use the same Cloud Sync details and click `Load From Cloud`.

## Notes

- `Export CSV` downloads all saved records.
- `Print Report` prints the current dashboard/report view.
- `Clear Data` removes saved data from the current browser only.
- Without Supabase setup, data is local to the browser and device where it is entered.
- With Supabase setup, the app can sync the same saved data between phone and computer.
