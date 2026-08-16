# Sanskritika Mirza Academy Management — PRD

## Original problem statement
Full-stack music school management platform for Sanskritika Mirza Academy with public applicant flow, admin approval/onboarding, teacher management and attendance portal, student portal (self-view of profile/fees/attendance), fee ledger with second-Sunday due-date logic, offline payment recording, and WhatsApp reminder links. Original stack (Next.js/Prisma) approved to be replaced with the workspace's React + FastAPI + MongoDB stack.

## Architecture decisions
- React 19 (CRACO) + React Router 7 + Sonner toasts + Lucide icons + Google Fonts (Playfair Display / DM Sans).
- FastAPI on port 8001, single-cookie JWT (8 hr), bcrypt hashed passwords, brute-force lockout, MongoDB via Motor.
- Three roles enforced server-side: `admin`, `teacher`, `student`. Frontend routes are guarded but source of truth is backend RBAC.
- Public routes: `/`, `/apply`, `/track`. Portal routes: `/admin/*`, `/teacher/*`, `/student/*`.
- Payments recorded offline only (Cash/UPI/Card/Bank Transfer). WhatsApp reminders via `wa.me` link generator.
- Seed reset via `SEED_VERSION` marker so schema changes safely refresh demo data.

## User personas
- **Admin**: reviews applications, onboards students (roll + batch + fee + temp password), manages teachers and batches, marks attendance, collects fees.
- **Teacher**: views only their assigned batches, roster, marks attendance for their sessions.
- **Student**: views own profile, batch/teacher, attendance history, fee ledger; can change password.
- **Public applicant**: submits form, receives tracking ID, tracks admission status.

## Core requirements (static)
- Public application submission with tracking ID + status lookup.
- Admin console: dashboard analytics, application approve/reject workflow, student directory + profile + renewal, teacher CRUD + activation, batch CRUD, attendance sheet, fee ledger (generate monthly / collect / receipt / export / reminder).
- Teacher portal: assigned batches, per-batch roster, attendance marking by date.
- Student portal: personal dashboard, teacher/batch info, fee ledger, attendance history, forced/optional password change.
- Second-Sunday monthly due-date; PAID/PARTIAL/DUE/OVERDUE statuses.
- All interactive elements have `data-testid`.

## Implemented (2026-02)
- Backend rewritten with full RBAC: users/applications/teachers/batches/students/attendance/fees + role guards + fresh seed (admin + 2 teachers + 4 batches + 8 approved students + 2 pending + 1 rejected app).
- Public landing / apply / track pages with tracking ID display.
- Login page routes to correct portal by role. Cookie session survives reloads.
- Admin console covers all six modules with modals for approve/reject/add teacher/add batch/collect fee/receipt.
- Teacher portal shows only assigned batches, with per-batch attendance marking.
- Student portal shows profile, assigned teacher, ledger, attendance, and password change (auto-open on first login).
- CSV export of fee ledger, print/download receipt, wa.me link generator populated with guardian phone.

## Prioritized backlog
- P1: CSV/PDF attendance reports and date-range filters.
- P1: Batch edit/deactivate + student batch reassignment UI (backend already supports).
- P1: Photo upload/storage for students (via object storage integration).
- P2: Real WhatsApp/SMS integration (Twilio) once the user chooses a provider.
- P2: Configurable fee structures per instrument or plan.
- P2: Multi-month automatic fee generation cron.

## P0/P1/P2 remaining
- P0 remaining: none for the requested scope; awaiting test agent verification.
- P1: attendance exports, teacher edit UI, photo upload.
- P2: SMS reminders, richer analytics, automated fee cron.
