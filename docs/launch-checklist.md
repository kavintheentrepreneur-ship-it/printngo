# Printngo Pre-Flight & Go-Live Launch Checklist

Before opening the Printngo kiosk to the public, complete and verify every item below.

---

## 1. Secrets & Credentials Verification
- [ ] No hard-coded API keys, UPI secrets, or credentials exist in the Git repository.
- [ ] `.env` file created from `.env.example` with production values.
- [ ] `DEFAULT_KIOSK_SECRET` replaced with a 32+ character random alphanumeric secret.
- [ ] `STAFF_JWT_SECRET` and `STAFF_PIN_HASH` replaced with production values.
- [ ] Real Razorpay API Keys set:
  - `RAZORPAY_KEY_ID` (starts with `rzp_live_...`)
  - `RAZORPAY_KEY_SECRET`
  - `RAZORPAY_WEBHOOK_SECRET`
- [ ] Production UPI ID and Payee Name configured:
  - `UPI_ID=yourshop@bank`
  - `PAYEE_NAME="Your Official Business Name"`

---

## 2. Pricing & Rate Verification
- [ ] Replaced test placeholder prices with verified merchant rates via `PUT /api/v1/staff/pricing`:
  - A4 B&W rate
  - A4 Color rate
  - A3 B&W & Color rate
  - A5 / Letter / Legal rates
  - Minimum order guarantee amount
- [ ] Confirmed that all price calculations strictly use integer **paise**.

---

## 3. Physical Hardware & Kiosk Display
- [ ] Laptop AC power adapter plugged in securely.
- [ ] OS sleep, standby, screensaver, and lid-close sleep disabled (`powercfg` script run).
- [ ] Chrome/Chromium Kiosk mode launcher starts on boot into `http://localhost:3001/kiosk`.
- [ ] Office printer connected via USB or static network IP.
- [ ] Paper trays stocked:
  - Tray 1: Fresh A4 75-80 GSM paper.
  - Tray 2: Fresh A3 / Legal paper (if offered).
- [ ] Toner and ink cartridges have at least 30% reserve remaining.

---

## 4. End-to-End Test Run Checklist
- [ ] Scan kiosk QR code on iPhone (Safari) and Android (Chrome) at 360px and 390px.
- [ ] Upload 10-page PDF: verify progress bar and page count display.
- [ ] Select 2-pages-per-sheet duplex color: verify live price breakdown.
- [ ] Adjust copies stepper (1 to 5): verify price updates without page reload.
- [ ] Tap "Proceed to print": verify price is immutably locked.
- [ ] Initiate test payment:
  - Verify UPI link opens banking app with correct recipient and amount.
  - Webhook confirms payment.
- [ ] Verify green "Thank You!" screen appears with 6-character reference code.
- [ ] Verify physical printer prints job accurately.
- [ ] Verify kiosk resets to a clean new QR code for the next customer.
- [ ] Test 5-tap logo staff console: verify Pause and Resume functions.

---

## 5. Security & Maintenance Operations
- [ ] Verify 7-day scheduled file purge worker is active.
- [ ] Ensure customer upload folder has strict filesystem permissions.
- [ ] Verify rate limiting is active on public endpoints.
