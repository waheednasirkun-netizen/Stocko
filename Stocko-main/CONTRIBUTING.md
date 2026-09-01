# Contributing to Restaurant Inventory Management System

Thank you for your interest in contributing! This document outlines how to get started.

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/restaurant-inventory-management.git
   cd restaurant-inventory-management
   ```
3. **Install** dependencies:
   ```bash
   npm install
   ```
4. **Configure** environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```
5. **Run** the dev server:
   ```bash
   npm run dev
   ```

## Branching Strategy

| Branch    | Purpose                                      |
|-----------|----------------------------------------------|
| `main`    | Production-ready code                        |
| `develop` | Integration branch for ongoing development   |
| `feature/*` | New features (branch from `develop`)       |
| `fix/*`   | Bug fixes (branch from `develop`)            |

### Workflow

1. Create a branch from `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```
2. Make your changes with clear, focused commits.
3. Ensure the build passes:
   ```bash
   npm run build
   ```
4. Push and open a **Pull Request** into `develop`.
5. After review and testing, changes are merged to `main` for release.

## Commit Messages

Use clear, imperative messages:

- `Add recipe cost calculation to Recipes page`
- `Fix stock OUT validation for zero quantity`
- `Update README with deployment instructions`

## Code Style

- Match existing patterns in the codebase (React functional components, `useApp()` context, `src/lib/api.js` for all Supabase calls).
- Keep components in `src/pages/` — one page per file, default export.
- Do not import `supabase` directly in components; use `api.js`.
- Do not commit `.env`, secrets, or `node_modules/`.

## Pull Requests

- Fill out the PR template completely.
- Link related issues (`Fixes #12`).
- Include screenshots for UI changes.
- Keep PRs focused — one feature or fix per PR when possible.

## Reporting Bugs

Use the **Bug Report** issue template and include:

- Steps to reproduce
- Expected vs actual behavior
- Browser/OS and console errors

## Feature Requests

Use the **Feature Request** issue template. Discuss large changes in an issue before opening a PR.

## Database Changes

- Add SQL to `supabase/schema.sql`.
- Document new tables/columns in the README.
- Note any RLS policy requirements.

## Questions?

Open a GitHub Discussion or issue with the `question` label.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
