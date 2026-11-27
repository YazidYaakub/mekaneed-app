# Mekaneed quotation review demo

This ENT600 web demo implements quotation review, optional comparison, a clarification revision, saving and export using fictional RM450 and RM550 front brake pad quotations. The sample queue and saved reports are stored in each visitor’s browser.

## Run it

From the repository root, with Node.js 22 or newer installed:

```sh
node serve.mjs
```

Open [the demo](http://127.0.0.1:4173). If port 4173 is in use, add another port number at the end of the command and open the address printed by the server.

## Deploy to Vercel

Import this repository in Vercel with the repository root as the root directory. The settings in `vercel.json` publish the five browser assets in `dist/`. The demo needs no environment variables or backend services.

Run `node build.mjs` to generate the static output locally. The build omits the tests and the local server.

## Try the staff queue

Choose a sample and select **Send to staff queue**. Open it to start the staff check. A readable quote can move to owner confirmation, including when a warranty or another secondary detail is unreadable. If the work or total is unreadable, provide the clearer sample and check that copy. Once the owner confirms the vehicle details, the case returns to the queue as **Review ready**.

The staff queue, confirmed vehicle details, checked workshop reply and case history are saved in the current browser for sample testing. Use **Open staff queue** after a reload to resume a case.

## Record a sample delivery

Open a queued case marked **Review ready**, choose **Record delivery**, and enter the staff handling time in whole minutes. This records the report open at the time, the delivery date and the time from intake to first delivery. The queue moves the case to **Delivered**.

Reopen a delivered case and select **Delivery records** to view or export the recorded report. Applying a checked workshop reply after the first delivery returns the case to **Review ready**. The revised delivery retains its own report and turnaround measured from when the reply was applied.

## Try the end-to-end sample pilot

1. **Workshop identity.** During the staff check, choose one of the independent directory examples. The sample report shows the result, source and date. It covers identity and contact details.
2. **Pilot records.** Open the case’s **Pilot records** to record a simulated RM14.90 offer, payment, decline or refund. The staff queue counts cases once and displays recorded deliveries and average staff minutes per delivered case.
3. **Service examples.** From the review, open **View service examples** to see the illustrative RM69.90 expert offer. The Kota Kinabalu workshop candidate is fictional. A queued case can record or withdraw sample permission for the named recipient and disclosed fields. A sample referral needs that permission and a recorded, attributable, completed paid job worth at least RM300.
4. **Local demo data.** Open **Local demo data** on the first screen to clear the sample cases and saved review from the current browser. All amounts and example partners in this preview are fictional.

The live pilot depends on qualified participant testing, approved coverage, assigned staff and access roles, secure intake, a retention rule, payment and refund terms, and confirmed delivery capacity. Qualified mechanic and eligible workshop agreements are required for live optional services. OCR, pricing ranges, family access and QuoteLink are listed under later decisions in the PRD.

## Try the three sample cases

| Sample | Expected result |
| --- | --- |
| Readable quotation | One RM450 amount for front pads and labour. Missing details are marked **Not stated**. |
| Warranty is blurred | A partial review keeps RM450 and marks warranty as **Unreadable**. |
| Copy is too blurred | A clearer copy is requested before the review. The clearer sample returns to staff verification. |

From a quotation review, select **Add a second quotation**. Confirm the vehicle and proposed repair to compare the two totals, the work and charges, the warranty terms and both original quotations. Brake cleaning is listed only in Quote B. The comparison keeps both quotes in their original order and asks you to clarify scope before comparing prices.

## Revise a review after a workshop reply

From a regular or partial review, select **Add workshop reply**. Check the reply against Quote A and select **Apply clarification**. The demo accepts one reply per case and shows the previous and revised values. The RM450 total and original wording remain visible. A comparison uses the updated details for Quote A and shows the reply separately.

## Save or export a review

Select **Save review** on the review or comparison to keep a snapshot in this browser. After a reload, **Open saved review** appears next to **Continue to staff check** on the first screen. The browser keeps one saved review. **Replace saved review** updates that snapshot when the current review differs.

**Export review** downloads a plain-text copy with the vehicle, quoted work and price, unresolved details, questions and original quotation wording. A revision includes the workshop reply and what changed. Exporting from the comparison includes both quotes. You can also export the saved snapshot.

## Run the tests

```sh
node --test *.test.mjs
```
