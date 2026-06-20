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
