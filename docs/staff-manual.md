# Printngo Kiosk - Staff Operations & Daily Manual

Welcome to the daily staff operations guide for Printngo. This manual explains how to oversee the self-service kiosk, verify payments, assist customers, process refunds, and perform maintenance.

---

## 1. Opening & Morning Checklist

1. **Power & Hardware**:
   - Turn on the kiosk laptop.
   - Verify the printer is powered on, has no flashing error lights, and has adequate paper in Tray 1 (A4) and Tray 2 (A3/Legal).
   - Check ink / toner levels on the printer display panel.
2. **Kiosk Screen**:
   - The laptop automatically boots into Chromium Kiosk Mode.
   - Confirm the screen shows:
     - The **Printngo Logo**.
     - A large **QR code** in the center.
     - The text **"Scan to print"**.
     - An active countdown timer (15 minutes).
     - The green **Online & Live** badge.
3. **Print Agent**:
   - Ensure the background print daemon is running (`pnpm --filter @printngo/print-agent start`).

---

## 2. Accessing the Hidden Staff Console

To access administrative functions directly on the kiosk laptop without leaving fullscreen mode:
1. Tap or click the **Printngo Logo** on the top-left **5 times rapidly**.
2. A security modal will pop up asking for the **Staff Security PIN**.
3. Enter PIN: **`1234`** (or your manager-assigned PIN) and tap **Verify PIN**.

### Features in the Staff Console:
- **Pause Kiosk**: Puts a large red banner on the screen warning users that the kiosk is under maintenance. New customers cannot print while paused.
- **Resume Kiosk**: Restores live self-service immediately.
- **Force New QR**: Generates an immediate fresh session and resets the screen.
- **Manual Payment Confirmation**: For `manual_upi` mode (see Section 3).
- **Recent Jobs & Reprint**: View today's jobs and trigger reprints (see Section 4).

---

## 3. Manual UPI Payment Confirmation

When the kiosk operates in `manual_upi` mode:
1. Customer selects their print options on their phone and pays to Printngo's UPI ID (`printngo@okhdfcbank`).
2. The transaction note contains the customer's **6-character reference code** (e.g. `7X9PNG`).
3. Check your shop's bank notification or soundbox alert:
   - Match the **Amount** exactly.
   - Match the **Order REF Code**.
4. Open the Staff Console on the kiosk:
   - Enter the **REF Code** into the confirmation box.
   - Enter the exact **Amount** in rupees (e.g. `4.00`).
   - Tap **Confirm Payment**.
5. Once confirmed, the customer's phone immediately shows the green **Thank You** screen and the kiosk printer automatically begins printing!

> [!CAUTION]
> Never confirm a payment if the amount in the bank alert is less than the job price. The system will reject amount mismatches to prevent revenue loss.

---

## 4. Reprints & Paper Jam Handling

If a customer's document was damaged, jammed in the printer, or ran out of ink mid-job:
1. Fix the physical issue (clear paper jam or reload paper tray).
2. Open the **Staff Console** (5 taps on logo).
3. Scroll down to **Recent Kiosk Jobs**.
4. Locate the customer's **Reference Code**.
5. Tap **Reprint**. The print agent will re-render and print the document automatically.

---

## 5. Customer Refunds

If a customer paid for a job, but the printer hardware experienced an unrecoverable failure and a reprint is impossible:
1. The job will appear with status `failed` or `cancelled`.
2. Staff initiates a refund:
   - API: `POST /api/v1/staff/jobs/:id/refund`
3. The system transitions the job from `refund_pending` to `refunded` once gateway authorization completes.
4. Record the customer's UPI transaction ID for auditing.

---

## 6. Updating Pricing Rules

Pricing can be updated live without code changes or server restarts:
- Staff can call `PUT /api/v1/staff/pricing` with updated base rates.
- The system automatically increments the pricing version number, updates future draft calculations, and logs an audit trail event.
- Existing jobs already in `awaiting_payment` keep their locked price.
