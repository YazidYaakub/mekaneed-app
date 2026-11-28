# Mekaneed

**Understand a workshop quotation before approving a repair.**

[![Live app on Vercel](https://img.shields.io/badge/Live_app-Vercel-black?logo=vercel)](https://mekaneed-app.vercel.app/)
[![Pull request checks](https://github.com/YazidYaakub/mekaneed-app/actions/workflows/pull-request.yml/badge.svg?event=pull_request)](https://github.com/YazidYaakub/mekaneed-app/actions/workflows/pull-request.yml)
[![Release and deploy](https://github.com/YazidYaakub/mekaneed-app/actions/workflows/release.yml/badge.svg?branch=main)](https://github.com/YazidYaakub/mekaneed-app/actions/workflows/release.yml)
[![Latest release](https://img.shields.io/github/v/release/YazidYaakub/mekaneed-app)](https://github.com/YazidYaakub/mekaneed-app/releases/latest)
[![Apache 2.0 license](https://img.shields.io/github/license/YazidYaakub/mekaneed-app)](LICENSE)

Mekaneed is an ENT600 web app for Malaysian car owners. It shows the quoted work and charges, flags details that need clarification, and suggests questions to ask the workshop. You can also compare two quotations for the same vehicle and repair.

## Review your own quotation

Open [Mekaneed](https://mekaneed-app.vercel.app/) and choose **Enter a quotation**. Paste or transcribe the relevant wording, enter the proposed work and stated total, and confirm the vehicle details. You can attach a JPG, PNG, WebP or PDF up to 10 MB as a reference. If you enter every itemised charge, Mekaneed can check the sum against the stated total.

The review distinguishes omitted and unreadable details and gives you questions to copy. You can enter a second quotation, add one workshop reply, and save or export the review. This flow uses your transcription. A qualified mechanic can assess the vehicle if the repair recommendation is unclear.

Quotation text and attachments stay in the browser. Attachments are held in the open tab. **Save review** deliberately keeps a text snapshot in this browser. **Manage local data** clears that snapshot and sample cases. Exported copies stay wherever you download them.

## Try the demo

Open the [live demo](https://mekaneed-app.vercel.app/), choose a sample, and select **Continue to staff check**. Check the original quotation, then confirm the vehicle details to see the review.

| Sample | What you’ll see |
| --- | --- |
| **Readable quotation** | RM450 for front brake pads and labour in one amount. Omitted details are marked **Not stated**. |
| **Warranty is blurred** | A partial review keeps the RM450 total and marks the warranty **Unreadable**. |
| **Copy is too blurred** | The case asks for a clearer copy before a review can be prepared. The replacement goes back through the staff check. |

Open **View original quotation** on the review to check the workshop’s wording. The review puts the questions to ask before the optional comparison. Select **Try another sample** at the bottom to start again with the default vehicle details.

From a regular or partial review, you can also do the following.

- **Compare quotations.** Select **Add a second quotation** and confirm the vehicle and repair. The RM450 and RM550 samples show differences in parts, labour and warranty. Brake cleaning is listed only in the RM550 quotation.
- **Apply a clarification.** Select **Add workshop reply** and check the reply against Quote A. The revised review shows what changed and keeps the original wording and RM450 total.
- **Keep the review.** **Save review** keeps one snapshot in this browser. Use **Open saved review** after reloading, or **Export review** to download a text copy with the source quotations and workshop questions.

The sample quotations, offers and workshop partners are fictional. Sample staff cases stay in the current browser.

## Explore the staff workflow

1. Choose a sample and select **Send to staff queue**. Open the case and check the quotation. The optional directory check records an example identity result, source and date.
2. Confirm the vehicle details. The case becomes **Review ready**. If the work or total is unreadable, staff check the replacement before the owner confirms.
3. Select **Record delivery** and enter staff handling time in whole minutes. The queue marks the case **Delivered** and keeps the report, delivery date and turnaround.
4. Reopen **Delivery records** to view or export the delivered report. A checked workshop reply can lead to a revised delivery with its own report and timing.

**Pilot records** lets staff log a sample RM14.90 offer, payment, decline or refund. The queue summarises delivery counts and average staff time. **View service examples** shows the sample RM69.90 mechanic review and a fictional Kota Kinabalu workshop match. A sample referral requires permission for the named workshop and a recorded, completed paid job worth at least RM300.

A live pilot requires participant testing, secure quotation intake, assigned staff and access roles, a retention rule, agreed payment and refund terms, and confirmed delivery capacity. Live optional services also require qualified reviewers and eligible workshop agreements.

## Run locally

From the repository root with Node.js 22 or newer installed:

```sh
node serve.mjs
```

Open [localhost on port 4173](http://127.0.0.1:4173/). To use another port, pass it after the command, for example `node serve.mjs 4174`.

```sh
node --test *.test.mjs
node build.mjs
```

The build writes the browser assets to `dist/`.

## Pull requests, releases and deployment

Open a pull request to `main` for each feature. Record the review findings in the PR, then squash merge once **Test and build** passes. GitHub Actions tests the merged commit, publishes a release tagged `v0.1.<run number>`, and deploys that commit to Vercel. It verifies the live files and the `release.json` marker. If a newer commit is already live, the workflow keeps it in production.

The deployment uses `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` as GitHub repository variables and `VERCEL_TOKEN` as a secret in the **production** environment. Enter the team-scoped token directly in GitHub. Git-triggered deployments in Vercel are disabled so GitHub Actions can publish the release before deploying.

## License

[Apache License 2.0](LICENSE)
