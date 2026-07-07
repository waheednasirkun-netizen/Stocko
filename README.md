# Restaurant Inventory Management System

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)
![Chart.js](https://img.shields.io/badge/Chart.js-4-FF6384?logo=chartdotjs&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

A full-featured **Restaurant Inventory Management System** built with **React**, **Vite**, and **Supabase**. Track stock levels, manage demands and fulfillment, handle procurement, monitor expenses, and generate reports — all from a responsive web app with role-based access control.

> Inventory levels are **computed from transactions** (never stored separately), ensuring a single source of truth.

---

## Screenshots

| Dashboard | Inventory | Stock Movement |
|-----------|-----------|----------------|
| _Add screenshot_ | _Add screenshot_ | _Add screenshot_ |

| Demands | Reports | Mobile View |
|---------|---------|-------------|
| _Add screenshot_ | _Add screenshot_ | _Add screenshot_ |

---

## Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Dashboard** | Overview stats, low-stock alerts, recent activity |
| 2 | **Inventory** | Real-time stock levels derived from transactions |
| 3 | **Stock Movement** | Record Stock IN, Stock OUT, and Wastage |
| 4 | **Demands** | Kitchen/department requests with approval workflow |
| 5 | **Fulfillment Center** | Approve, reject, and fulfill demand requests |
| 6 | **Item Templates** | Reusable item presets for faster data entry |
| 7 | **Suppliers** | Manage supplier contacts and status |
| 8 | **Procurement Requests** | Internal purchase requests with priority levels |
| 9 | **Purchase Orders** | Track PO status from ordered to received |
| 10 | **User Management** | CRUD users with role-based permissions |
| 11 | **Activity Log** | Audit trail of all system actions |
| 12 | **Reports** | Analytics, spend summaries, top-moving items |
| 13 | **Inventory Expenses** | Financial records with payment tracking |
| 14 | **Settings** | Dark/light theme, custom units, system controls |

**Also included:** Login authentication, mobile bottom navigation, keyboard shortcuts, toast notifications, and confirm dialogs.

---

## Tech Stack

- **Frontend:** React 18, Vite 5
- **Backend:** Supabase (PostgreSQL + REST API)
- **Charts:** Chart.js + react-chartjs-2
- **Styling:** Inline styles + CSS (no UI framework)
- **State:** React Context (`AppContext`)

---

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [npm](https://www.npmjs.com/) 9+
- A [Supabase](https://supabase.com/) project

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/restaurant-inventory-management.git
cd restaurant-inventory-management
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Get these from **Supabase Dashboard → Project Settings → API**.

### 4. Set up the database

Run the schema in the Supabase SQL Editor:

```bash
# File: supabase/schema.sql
```

Or copy/paste the SQL from [`supabase/schema.sql`](supabase/schema.sql).

### 5. Add demo users (optional)

Insert users into the `users` table:

| Email | Password | Role |
|-------|----------|------|
| admin@restaurant.com | admin123 | Admin |
| manager@restaurant.com | mgr123 | Manager |
| store@restaurant.com | store123 | Store Keeper |

### 6. Run the app

```bash
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public API key |

> **Never commit `.env` to Git.** Use `.env.example` as a template.

---

## Database Setup

### Tables

The app uses these Supabase tables:

- `branches`, `users`, `user_branch_mappings`
- `transactions` (source of truth for inventory)
- `demands`, `item_templates`, `suppliers`
- `financial_transactions`, `procurement_requests`
- `purchase_orders`, `purchase_order_items`
- `activity_logs`

Full schema: [`supabase/schema.sql`](supabase/schema.sql)

### Row Level Security (RLS)

For development, RLS can be disabled per table. Before production:

1. Enable RLS on all tables.
2. Add policies scoped by `branch_id` and user role.
3. Migrate from plain-text passwords to Supabase Auth (recommended).

### Inventory computation

Inventory is **never stored** in a separate table. The `computeInventory()` function in `src/lib/computeInventory.js` walks the `transactions` table chronologically to derive current stock levels.

---

## Running the App

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server at `localhost:5173` |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build locally |

---

## Project Structure

```
restaurant-inventory-management/
├── .env.example                  ← Environment variable template
├── .github/
│   ├── ISSUE_TEMPLATE/           ← Bug report & feature request templates
│   └── pull_request_template.md
├── supabase/
│   └── schema.sql                ← Database schema
├── CONTRIBUTING.md
├── LICENSE
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx                  ← Entry point
    ├── App.jsx                   ← Layout shell + page routing
    ├── index.css                 ← Global styles
    ├── context/
    │   └── AppContext.jsx        ← Global state + Supabase data loading
    ├── lib/
    │   ├── supabase.js           ← Supabase client
    │   ├── api.js                ← All DB operations
    │   ├── computeInventory.js   ← Inventory derivation
    │   └── constants.js          ← Roles, permissions, themes
    ├── components/
    │   ├── ui/index.jsx          ← Icons, Button, Modal, Toast, Card
    │   └── layout/
    │       ├── Sidebar.jsx
    │       └── Header.jsx
    └── pages/
        ├── Login.jsx
        ├── Dashboard.jsx
        ├── Inventory.jsx
        ├── StockMovement.jsx
        ├── Demands.jsx
        ├── FulfillmentCenter.jsx
        ├── ItemTemplates.jsx
        ├── Suppliers.jsx
        ├── ProcurementRequests.jsx
        ├── PurchaseOrders.jsx
        ├── UserManagement.jsx
        ├── ActivityLog.jsx
        ├── Reports.jsx
        ├── InventoryExpenses.jsx
        └── SettingsPage.jsx
```

---

## Key Design Decisions

### API layer (`src/lib/api.js`)
All Supabase calls live in one file. Components never import the Supabase client directly.

### Optimistic UI (`AppContext`)
On login, `loadAllData()` fetches all tables in parallel. Writes update Supabase then local state for a snappy experience.

### Role-based permissions (`src/lib/constants.js`)
The `userCan()` helper gates features by role (Admin, Manager, Store Keeper, etc.).

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branching strategy, code style, and PR guidelines.

1. Fork the repo
2. Create a feature branch from `develop`
3. Commit your changes
4. Open a Pull Request

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| White screen | Check browser console; usually a missing Supabase table |
| Login fails | Ensure `users` table has matching email + password + `status='Active'` |
| Column does not exist | Run `supabase/schema.sql` in SQL Editor |
| Inventory shows 0 | Record at least one Stock IN via Stock Movement |
| No branch assigned | Add a row to `user_branch_mappings` linking user to branch |

---

## Roadmap

- [ ] Recipes module with cost calculation
- [ ] POS module with cart and sales tracking
- [ ] Supabase Auth migration
- [ ] CI/CD pipeline
- [ ] Production deployment (Vercel/Netlify)

Track progress on the [GitHub Project board](https://github.com/YOUR_USERNAME/restaurant-inventory-management/projects).

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Acknowledgments

Originally converted from a single HTML file to a full React + Vite + Supabase application.
