# Sanskritika Mirza Academy Management — PRD

## Original problem statement
Build a modern, clean, responsive Music School Management Web Application for Sanskritika Mirza Academy of Indian / Western Classical & Contemporary Music, covering staff access, student records, attendance, analytics, fees, payments, receipts, and reminders.

## Architecture decisions
- React 19 frontend with React Router, Lucide icons, Recharts-ready workspace components, and responsive CSS.
- FastAPI backend on port 8001 with MongoDB through the existing MONGO_URL and DB_NAME environment variables.
- JWT staff session in an HTTP-only secure cookie, bcrypt password hashing, failed-login lockout, and seeded staff account.
- Payments are recorded internally; no online gateway is connected.

## User personas
- Academy owner/teacher: needs a calm overview of attendance, student growth, and money due.
- Academy staff: needs fast, low-friction daily attendance, registration, fee collection, and reminders.

## Core requirements (static)
- Staff login and protected academy workspace
- Dashboard with active student, attendance, outstanding fee, and collection metrics
- Student directory, search, Sunday batch filter, registration, profile, ledger, and renewal action
- Daily attendance by date/batch with present/absent actions
- Monthly dues with second-Sunday due date, status filters, payment recording, receipts, export, and WhatsApp reminder links
- Responsive layouts and descriptive data-testid attributes for user-facing flows

## Implemented (2026-08-15)
- Replaced starter screen with full warm editorial academy workspace and mobile navigation.
- Added staff login for staff@sanskritika.in and seeded 8 students, attendance rows, and current-month fees.
- Added dashboard, student registration/directory/profile, attendance, fees, payment collection, print/download receipt, ledger CSV export, renewal action, and WhatsApp reminders.
- Added MongoDB-backed auth, APIs, due-date engine, secure cookie, and five-failure lockout.
- Verified API login/me/students/fees and browser login, dashboard, registration modal, fee receipt, and profile flows.

## Prioritized backlog
- P0: Add actual photo upload/storage and student photo cropping.
- P1: Add CSV/PDF attendance report generation and date-range filters.
- P1: Add editable student records and batch capacity management.
- P2: Add richer monthly analytics and automated WhatsApp/SMS provider integration.

## P0/P1/P2 remaining tasks
- P0 remaining: none for the current working demo scope.
- P1: attendance CSV/PDF export, edit student form, and richer fee receipt branding.
- P2: photo storage, automated reminders, and multi-staff roles/permissions.
