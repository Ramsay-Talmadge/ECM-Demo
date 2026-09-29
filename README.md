# Records Hub: Public Records Request Demo

A browser prototype of the public records request (PRR) workflow inside an enterprise content management system: AI-suggested redactions, human review, an RCW exemption log, and an audit trail separating AI actions from human decisions.

It's a demo, not a production system. All records and people are fictional sample data held in memory. The "AI" is a deterministic rules-and-entities simulation standing in for a real model. Reloading the page (or **Reset demo data**) restores the starting state.

## Run it

No install or build step. Download the repo and open `index.html` in a modern browser.

## The core loop

1. **Request queue.** Requests arrive from the GovQA intake, each with a 5-business-day response date.
2. **AI scan.** Opening a request scans each responsive record and *suggests* redactions (names, SSNs, dates of birth, account numbers, health details, privileged advice, IP addresses), each with a confidence score and a suggested RCW exemption. Nothing is redacted automatically.
3. **Human review.** The reviewer marks each suggestion Redact or Keep visible, changes the exemption, or selects text to add a manual redaction (logged as a possible AI miss).
4. **Release.** Once nothing is pending, the reviewer approves the release. The released copy has redactions burned in, and the original record is preserved unchanged.
5. **Exemption log and delivery.** An exemption log is generated for the requester, and the package is marked delivered to GovQA.
6. **Audit.** Every AI suggestion and human decision is logged with actor, user and time. The AI & Audit view summarizes acceptance rate, rejections (possible false positives) and manual additions (possible false negatives).

## Roles

Switch users from the sidebar:

- **K. Alvarez, PRR Coordinator:** manages and releases requests. Can't open CJIS, health or IT-security records.
- **R. Okafor, Police Records:** reviews redactions on police records only. Can't release.
- **J. Tran, Parks staff:** read-only. Library, search and audit trail hide everything outside their permissions.

RCW citations are illustrative. Real exemption decisions are made by City staff.
