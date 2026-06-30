# H&H SPACES

A simple browser-based construction site tracker for:

- Labour wages
- Material expenses
- Client payments
- Customer bills
- Rate list
- Company capital
- Expense tracker
- Measurement book
- BOQ management
- Work progress
- Site diary
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

Use the search box at the top of the app to find any saved site, client, labour, phone number, bill number, material, payment, amount, work target, progress note, or daily update.

Use `Rate List` to save standard work/material rates. Use `Customer Bills` to make client bills using quantity, unit, rate, discount, tax/GST, and total amount.

The app also includes Expense Tracker, Measurement Book, BOQ variance, Site Diary, stock/payment notifications, dark/light mode, exports, reports, offline local storage, and Supabase cloud sync.

After a successful login, the app remembers that browser/device. Use `Lock App` to log out and remove the remembered login from that device.

## Use on Phone With GitHub Pages

1. Create a new GitHub repository.
2. Upload these files to the repository:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `manifest.webmanifest`
   - `service-worker.js`
   - `icons/icon.svg`
   - `.nojekyll`
   - `README.md`
   - `supabase-schema.sql`
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
9. On iPhone Safari, tap `Share` > `Add to Home Screen`.

This gives the app a home-screen icon and standalone app window. It keeps the browser version free while still supporting the main features: local storage, Supabase sync, billing, reports, search, tools, settings, and offline app shell caching.

## Free iPhone Feature Limits

The free GitHub Pages app can include almost all Site Tracker features. A real native iPhone app without Apple Developer account is not allowed by Apple.

Supported in the free web app:

- Home-screen app icon
- Login remembered on device
- Local storage
- Supabase sync between laptop and phone
- Sites, labour, materials, expenses, payments, bills, BOQ, measurements, tools, settings
- PDF/print/share options where Safari allows it
- Offline opening after first load

Limited compared with a paid native iOS app:

- Native App Store/TestFlight install
- Full native push notifications
- Deep background backup while the app is closed
- Some iPhone file/download behavior depends on Safari

## Supabase Cloud Sync

1. Create a Supabase project.
2. Open Supabase SQL Editor.
3. Paste and run the SQL from `supabase-schema.sql`.
4. This app is already pre-filled with the current project:
   - `https://yvocwptxawxmloacpdrt.supabase.co`
   - publishable key ending with `2fmj`
5. If you use a different Supabase project later, go to `Project Settings` > `Data API` and copy:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - Do not use `SUPABASE_SECRET_KEY` in this browser app.
6. Open the H&H SPACES app.
7. Login.
8. Click `Cloud Sync`.
9. Click `Save Connection`.
10. Click `Save To Cloud` once from the device that already has your data.
11. On another phone/computer, open Cloud Sync and click `Load From Cloud`.

## Notes

- `Export CSV` downloads all saved records.
- `Print Report` prints the current dashboard/report view.
- `Clear Data` removes saved data from the current browser only.
- Without Supabase setup, data is local to the browser and device where it is entered.
- With Supabase setup, the app can sync the same saved data between phone and computer.
