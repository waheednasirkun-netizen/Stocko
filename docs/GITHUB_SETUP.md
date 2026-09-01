# GitHub Setup Guide — Phase 1

Use this guide after pushing the repo to GitHub. Replace `YOUR_USERNAME` with your GitHub username.

---

## 1. Create the Repository

**GitHub.com → New repository**

| Field | Value |
|-------|-------|
| Name | `restaurant-inventory-management` |
| Description | Restaurant Inventory Management System with React + Vite + Supabase |
| Visibility | Private (recommended — see README FAQ) |
| Initialize | **Do not** add README, .gitignore, or license (already in repo) |

---

## 2. Push Local Code

```powershell
cd "C:\Users\user\Downloads\restock-main (2)\restock-main"

git init
git branch -M main
git add .
git commit -m "Initial commit - Restaurant Inventory Management System"
git remote add origin https://github.com/YOUR_USERNAME/restaurant-inventory-management.git
git push -u origin main
```

Create `develop` branch:

```powershell
git checkout -b develop
git push -u origin develop
```

---

## 3. Create Labels

**Settings → Labels** — create if missing:

| Label | Color | Description |
|-------|-------|-------------|
| `setup` | `#0E8A16` | Project setup tasks |
| `database` | `#1D76DB` | Database / Supabase |
| `high-priority` | `#B60205` | Urgent |
| `feature` | `#A2EEEF` | New feature |
| `recipes` | `#FEF2C0` | Recipes module |
| `pos` | `#FEF2C0` | POS module |
| `testing` | `#D4C5F9` | QA / testing |
| `quality-assurance` | `#D4C5F9` | QA |
| `documentation` | `#0075CA` | Docs |
| `deployment` | `#F9D0C4` | Deploy / DevOps |
| `devops` | `#F9D0C4` | DevOps |

---

## 4. Create Milestones

**Issues → Milestones → New milestone**

### Milestone 1: Foundation & Database (Week 1)
**Due:** 7 days from start  
**Description:** Set up Supabase, verify existing features connect to the database, and create initial documentation.

**Issues:** #1, #4 (partial), #5 (partial)

### Milestone 2: Core Features (Week 2–3)
**Due:** 21 days from start  
**Description:** Build Recipes and POS modules; continue feature testing.

**Issues:** #2, #3, #4 (continued)

### Milestone 3: Testing & Deployment (Week 4)
**Due:** 28 days from start  
**Description:** Complete QA across all features and deploy to production.

**Issues:** #4 (complete), #6

---

## 5. Create Issues

Copy each body below into **Issues → New issue**.

---

### Issue 1: Set up Supabase Database

**Title:** Set up Supabase Database  
**Labels:** `setup`, `database`, `high-priority`  
**Milestone:** Foundation & Database (Week 1)

```markdown
## Tasks
- [ ] Create Supabase account/project
- [ ] Create all tables with proper relationships
- [ ] Set up Row Level Security (RLS) policies
- [ ] Add environment variables to `.env`
- [ ] Test database connection

## Acceptance Criteria
- App loads without database errors
- Login works with a test user
- Stock IN transaction persists to Supabase

## Resources
- `supabase/schema.sql`
- `.env.example`
```

---

### Issue 2: Build Recipes Module

**Title:** Build Recipes Module  
**Labels:** `feature`, `recipes`  
**Milestone:** Core Features (Week 2–3)

```markdown
## Tasks
- [ ] Create Recipes page component
- [ ] Add to navigation
- [ ] CRUD operations (Create, Read, Update, Delete)
- [ ] Recipe cost calculation
- [ ] Add to mobile navigation
- [ ] Database schema for `recipes` and `recipe_ingredients`
- [ ] RLS policies

## Acceptance Criteria
- Recipes can be created with ingredients linked to inventory items
- Cost is calculated from ingredient prices
- Recipe appears in sidebar navigation
```

---

### Issue 3: Build POS Module

**Title:** Build POS Module  
**Labels:** `feature`, `pos`  
**Milestone:** Core Features (Week 2–3)

```markdown
## Tasks
- [ ] Create POS page component
- [ ] Shopping cart functionality
- [ ] Add to navigation
- [ ] Checkout process
- [ ] Reduce inventory on sale
- [ ] Sales tracking
- [ ] Database schema for `sales` and `sales_items`
- [ ] RLS policies

## Acceptance Criteria
- User can add items to cart and complete checkout
- Inventory decreases after a sale
- Sale record appears in sales history
```

---

### Issue 4: Test All Features

**Title:** Test All Features  
**Labels:** `testing`, `quality-assurance`  
**Milestone:** All three (split across phases)

```markdown
## Tasks
- [ ] Test Dashboard
- [ ] Test Inventory (CRUD, search, filter)
- [ ] Test Stock Movement
- [ ] Test Demands
- [ ] Test Fulfillment Center
- [ ] Test Item Templates
- [ ] Test Suppliers
- [ ] Test Procurement Requests
- [ ] Test Purchase Orders
- [ ] Test User Management
- [ ] Test Activity Log
- [ ] Test Reports
- [ ] Test Inventory Expenses
- [ ] Test Settings
- [ ] Test Login/Authentication
- [ ] Test Mobile Navigation
- [ ] Test Dark/Light Theme

## Notes
Document any bugs found as separate issues using the Bug Report template.
```

---

### Issue 5: Create Documentation

**Title:** Create Documentation  
**Labels:** `documentation`  
**Milestone:** Foundation & Database (Week 1)

```markdown
## Tasks
- [ ] Update README.md with complete docs
- [ ] Create CONTRIBUTING.md
- [ ] Create `.env.example`
- [ ] Create Supabase `schema.sql`
- [ ] Add API documentation

## Status
Several items completed in Phase 1 initial commit. Remaining:
- [ ] API documentation for `src/lib/api.js`
- [ ] Add screenshots to README
- [ ] Replace `YOUR_USERNAME` placeholders in docs
```

---

### Issue 6: Deployment

**Title:** Deployment  
**Labels:** `deployment`, `devops`  
**Milestone:** Testing & Deployment (Week 4)

```markdown
## Tasks
- [ ] Deploy to Vercel or Netlify
- [ ] Configure environment variables in hosting dashboard
- [ ] Test production build
- [ ] Set up custom domain (optional)

## Notes
- Run `npm run build` locally before deploying
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in hosting env vars
```

---

## 6. Project Board

**Repository → Projects → New project**

1. Choose **Board** layout
2. Name: `Restaurant Inventory — Phase 1`
3. Add columns:
   - **To Do**
   - **In Progress**
   - **In Review**
   - **Done**

4. **Add all 6 issues** to the board (they start in To Do)
5. As you work, drag issues across columns

### Automation (optional)

**Project → ⚙️ → Workflows:**

- When issue closed → move to **Done**
- When PR merged → move linked issue to **Done**

---

## 7. Branch Protection (main)

**Settings → Branches → Add branch protection rule**

| Setting | Value |
|---------|-------|
| Branch name pattern | `main` |
| Require pull request before merging | ✅ |
| Required approvals | 1 |
| Require status checks to pass | ✅ (after CI is added) |
| Require branches to be up to date | ✅ |
| Do not allow bypassing | ✅ |

Repeat a lighter rule for `develop` (require PR, optional reviews).

---

## 8. Install GitHub CLI (optional)

For scripting issues/milestones from terminal:

```powershell
winget install GitHub.cli
gh auth login
```

Then create issues in bulk:

```powershell
gh issue create --title "Set up Supabase Database" --label "setup,database,high-priority" --body-file .github/issues/01-supabase.md
```

---

## Quick Reference — Milestone → Issues

| Milestone | Issues |
|-----------|--------|
| Foundation & Database (Week 1) | #1, #5, #4 (DB connection) |
| Core Features (Week 2–3) | #2, #3, #4 (continued) |
| Testing & Deployment (Week 4) | #4 (complete), #6 |
