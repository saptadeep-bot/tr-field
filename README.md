# Turn & River Field

The field app for the Turn & River team: today's visits and follow-ups, the pipeline, clients, quotes priced from the cloth reckoner, orders with 50/30/20 payments, and the measurement form with every change recorded.

It's a web app that installs on the home screen of iPhone and Android phones. Data lives in Supabase. Each person signs in with their own email and password, and the database decides what they can see:

| Role | Sees |
|---|---|
| Owner | Everything, including ex-mill cloth rates and order costs |
| Client coordinator | Every client, contact details and prices. No costs |
| Sales & styling | Only clients assigned to them, or that they've been sent to visit. Prices. No costs |
| Workroom | Open orders, cloth, measurement forms and fitting dates. No prices, phone numbers or addresses |

## How it's hosted

- **App:** Cloudflare Pages builds this repository on every push to `main`.
  - Build command: `npm run build`
  - Output folder: `dist`
- **Data:** Supabase project `tkgollbusscruzmedmdb`.
  - `supabase/01_setup.sql` creates the tables, access rules and photo store. Run it once.
  - The data import (`02_import.sql`) is made separately and is never committed here, because it holds client details.
- **Keys:** `src/config.js` holds the publishable key, which is safe in the app. The secret key never goes in this repository.

## Adding someone to the team

1. In Supabase, go to Authentication → Users → Add user → Create new user.
2. Enter their email and a starting password, tick **Auto Confirm User**, and create the user.
3. In the app, open More → Team and access. They appear as switched off. Tap their name, then pick their role and city and switch them on.
4. Send them the app link and their sign-in details. They can change the password under More → Account.

To remove someone's access, switch them off in the same place.

## Working on it

```
npm install
npm run dev             # local, against the live database
npm run build           # the live app, into dist/
npm run build:preview   # the one-file sample-data preview
```

`supabase/test/` holds the security tests: `10_rls_test.sql` signs in as each role and checks what they can and can't do. To run them you need a local Postgres with `00_stub_supabase.sql` loaded first.
