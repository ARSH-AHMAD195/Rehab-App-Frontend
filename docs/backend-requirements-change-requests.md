# Backend requirements: patient login and doctor visibility

Source: *Fit for Surgery: Client Change Requests* (9 Nov 2026) and the decisions on it (10 Nov 2026). Repo: `ARSH-AHMAD195/Rehab-App-Backend`.

The frontend on `om/feature/change-requests` is built against the routes below. Until the backend has them, the new screens will show errors; nothing else breaks. This replaces the earlier SMS plan: there is no SMS, no Firebase Phone provider and no Blaze plan.

The medical profile fields, investigations, triage and caseload are on the backend branch `om/feature/clinical-infra` (not yet committed).

## 1. Every doctor sees every patient

Any active doctor can open, edit and log against any patient, in all three APIs. The link between a doctor and a patient (`doctorIds`) stays, but now means "my patient": it decides whose alert inbox gets that patient's alerts and what "My patients" shows.

| Route | Change |
|---|---|
| `GET /patients?scope=all\|mine` (doctor) | `all` (the default) lists every patient. `mine` lists linked patients only. |
| `GET /doctor/caseload?scope=all\|mine` (Health) | Same `scope` as above, same default. |
| `PUT /patients/:id/doctors/me` (doctor) | Links the signed-in doctor to the patient. Idempotent. Returns `Patient`. |
| `DELETE /patients/:id/doctors/me` (doctor) | Unlinks them. Refuse with `409 LAST_DOCTOR` if no doctor would be left. Returns `Patient`. |
| `GET /doctor/alerts` (Health) | Unchanged: the inbox lists alerts for linked patients. With `?patientId=` it must work for any patient. |
| Patient, medical profile, investigations, triage, vitals, exercise routes | Drop the "linked doctor" check for doctors. Keep it for patients (own record only). |

Registering a patient still links the doctor who registers them. Admin `PUT /patients/:id/doctors` stays.

## 2. Patient login: phone + password, and a code from the doctor

Doctors and admins keep email + password. Patients sign in with their **mobile number**, in one of two ways:

1. **Phone + password**, for everyday use.
2. **Phone + a 6-digit code from their doctor**, for the first sign-in and when they've forgotten their password. After a code sign-in the patient must set a new password before using the app.

### Firebase account for a patient

Firebase passwords need an email, so every patient's Firebase account uses a **login alias** as its email:

```
p<phone digits without the +>@<PATIENT_LOGIN_EMAIL_DOMAIN>
e.g. +919876543210 → p919876543210@patients.fitforsurgery.app
```

- The frontend builds the same alias (`src/lib/phoneLogin.ts`); the domain comes from `VITE_PATIENT_LOGIN_EMAIL_DOMAIN`, default `patients.fitforsurgery.app`. Both sides must use the same value.
- Create the account with `emailVerified: true`, and no password (a random one) until the patient sets theirs.
- A patient's real email, if given, is contact information only. It is not the Firebase login.
- When a patient's phone changes, update the alias email in Firebase too.

### Routes

| Route | Who | Request | Response |
|---|---|---|---|
| `POST /patients` | doctor, admin | `phone` **required**, `email` optional | as today; `invitation` is `'NONE'` when no email is sent |
| `POST /auth/login-codes/requests` | public, strict rate limit | `{ phone }` | `202 {}` always, even for unknown numbers, so it can't be used to find patients |
| `POST /auth/login-codes/verify` | public, strict rate limit | `{ phone, code }` | `{ customToken }` (Firebase custom token for that patient) |
| `GET /doctor/login-requests` | doctor | | `{ data: LoginCodeRequest[] }`, newest first, pending only |
| `POST /patients/:id/login-code` | doctor | | `{ code, expiresAt }`. Clears that patient's pending requests. Audited (who, when). |
| `POST /auth/me/password-set` | patient | | `204`. Clears `mustSetPassword`. |
| `GET /auth/me` | all | | adds `mustSetPassword: boolean` |

```ts
interface LoginCodeRequest { id: string; patient: { id: string; name: string }; phone: string; requestedAt: string }
```

- **Codes:** 6 digits, stored hashed, valid for 10 minutes, single use, 5 wrong tries then locked. One live code per patient; a new code replaces the old one.
- **Verify errors** (`code` in the error body): `LOGIN_CODE_INVALID` (401), `LOGIN_CODE_EXPIRED` (401), `LOGIN_CODE_LOCKED` (429).
- **`mustSetPassword`:** true for a new patient, and set true again whenever a code is issued. The frontend calls Firebase `updatePassword` and then `POST /auth/me/password-set`.
- **Email verification:** all three APIs must not refuse a patient whose token email is a login alias (it is created verified, so the existing check passes as long as `emailVerified: true` is set).

## 3. Open questions (not blocking the frontend)

- Triage history: calculated on read for now. If the clinic needs a versioned history, add `ruleVersion` to the triage response first.
- Login requests: every doctor sees all pending requests, linked or not. Restrict to linked doctors if that's too noisy.
