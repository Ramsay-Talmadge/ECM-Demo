// Records Hub: public records request demo.
// Front-end prototype with in-memory sample data. The "AI" is a deterministic
// rules + entity simulation standing in for a real model.

// ---------------------------------------------------------------------------
// Dates (sample data is relative to today so the demo never goes stale)
// ---------------------------------------------------------------------------

const TODAY = startOfDay(new Date());

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysAgo(n, hour = 9, minute = 0) {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute);
  return d;
}

function addBusinessDays(date, days) {
  const d = startOfDay(date);
  while (days > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) days--;
  }
  return d;
}

// Business days from today to date (weekends excluded); negative once past due.
function daysUntil(date) {
  const target = startOfDay(date);
  const step = target >= TODAY ? 1 : -1;
  const d = new Date(TODAY);
  let count = 0;
  while (d.getTime() !== target.getTime()) {
    d.setDate(d.getDate() + step);
    if (d.getDay() !== 0 && d.getDay() !== 6) count += step;
  }
  return count;
}

function fmtDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(date) {
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Washington public records exemptions (RCW 42.56 and related)
// ---------------------------------------------------------------------------

const RCW = {
  '42.56.230': 'Personal information: financial account and card numbers, other personal identifiers',
  '42.56.240': 'Investigative and law enforcement: victim and witness identity, contact details',
  '42.56.250': 'Employment records: employee SSN, home address, personal contact details',
  '42.56.290': 'Controversy / attorney work product (with RCW 5.60.060 privilege)',
  '42.56.330': 'Public utility customer information',
  '42.56.420': 'Security: IT infrastructure details that would aid an attack',
  '70.02': 'Health care information (RCW 70.02)'
};

// ---------------------------------------------------------------------------
// Roles & permissions (demo stand-ins for Entra ID groups)
// ---------------------------------------------------------------------------

const ROLES = {
  coordinator: {
    user: 'K. Alvarez', title: 'PRR Coordinator · City Clerk', manage: true, review: true,
    hint: 'Manages requests and releases. Reviews non-restricted records; police (CJIS), health and IT-security records need a department specialist.'
  },
  police: {
    user: 'R. Okafor', title: 'Records Specialist · Police', manage: false, review: true,
    hint: 'Can open CJIS records and review redactions on police records only. The Clerk releases.'
  },
  viewer: {
    user: 'J. Tran', title: 'Staff · Parks & Recreation', manage: false, review: false, dept: 'Parks & Recreation',
    hint: 'Read-only. Sees public records plus internal Parks records. Search hides everything else.'
  }
};

let roleKey = 'coordinator';
const role = () => ROLES[roleKey];
const CURRENT_USER = ROLES.coordinator.user;

function canView(rec) {
  const restricted = rec.sensitivity.startsWith('Restricted');
  if (roleKey === 'coordinator') return !restricted;
  if (roleKey === 'police') return rec.dept === 'Police' || rec.sensitivity === 'Public' || rec.sensitivity === 'Internal';
  return rec.sensitivity === 'Public' || (rec.dept === role().dept && !restricted);
}

function canReview(rec) {
  if (!role().review || !canView(rec) || rec.partitioned) return false;
  return roleKey === 'police' ? rec.dept === 'Police' : true;
}

// ---------------------------------------------------------------------------
// Records library
// entities = what the (simulated) AI model recognizes beyond pattern rules:
// names, medical details, privileged advice.
// ---------------------------------------------------------------------------

const records = [
  {
    id: 'REC-1001', title: 'Contract PW-2026-031: Bear Creek Trail culvert replacement', dept: 'Public Works', type: 'Contract',
    date: daysAgo(64), sensitivity: 'Internal', retention: '6 yrs after completion',
    body: [
      'Contractor: Cascade Civil Works LLC, 4410 148th Ave NE, Redmond, WA 98052',
      'Contract amount: $412,650.00, not to exceed. Substantial completion within 90 days of NTP.',
      'Contractor contact: Dana Whitfield, Project Manager, (425) 555-0142, dana.whitfield@cascadecivil.com',
      'City project manager: Sam Ortiz, sortiz@redmond.gov, (425) 556-2800',
      'Payment remittance: Account #8834120967, routing 125000024',
      'Performance bond No. PB-77120 and certificate of insurance on file with the City Clerk.'
    ],
    entities: []
  },
  {
    id: 'REC-1002', title: 'Council agenda memo: culvert emergency authorization', dept: 'City Clerk', type: 'Council Memo',
    date: daysAgo(58), sensitivity: 'Internal', retention: 'Permanent (archival)',
    body: [
      'To: Mayor and City Council. From: Public Works Director.',
      'Recommended action: ratify emergency authorization for the Bear Creek Trail culvert replacement.',
      'Fiscal impact: $412,650 from the Stormwater Capital Fund.',
      'Legal review: The City Attorney advises the City\'s exposure in the 2024 easement dispute is limited if work stays inside the existing easement.',
      'Attachments: vicinity map, contractor bid tabulation.'
    ],
    entities: [
      { text: 'The City Attorney advises the City\'s exposure in the 2024 easement dispute is limited if work stays inside the existing easement', type: 'Privileged legal advice', rcw: '42.56.290', conf: 0.88 }
    ]
  },
  {
    id: 'REC-1003', title: 'Email: culvert failure inspection notes', dept: 'Public Works', type: 'Email',
    date: daysAgo(61), sensitivity: 'Internal', retention: '2 yrs',
    body: [
      'From: sortiz@redmond.gov  To: pw-stormwater@redmond.gov',
      'Resident report received from Linda Moreau, 8123 NE 116th St, cell (425) 555-0199, about trail flooding.',
      'Inspection found the 36-inch CMP culvert rusted through at the outlet; trail section closed.',
      'Recommend emergency replacement; Cascade Civil can mobilize next week.'
    ],
    entities: [
      { text: 'Linda Moreau', type: 'Private citizen name', rcw: '42.56.230', conf: 0.71 },
      { text: '8123 NE 116th St', type: 'Home address', rcw: '42.56.230', conf: 0.84 }
    ]
  },
  {
    id: 'REC-1004', title: 'Police incident report RPD-26-004417: vehicle prowl', dept: 'Police', type: 'Incident Report',
    date: daysAgo(19), sensitivity: 'Restricted (CJIS)', retention: '6 yrs',
    body: [
      'Incident: Vehicle prowl, Downtown Park lot, 16101 Redmond Way. Reported 18:42.',
      'Victim: Priya Raman, DOB 03/14/1991, (206) 555-0178',
      'Witness: Marcus Hale, (425) 555-0133, marcus.hale@gmail.com',
      'Suspect vehicle: grey Honda Civic, WA plate BZK4471, last seen northbound on 161st Ave NE.',
      'Reporting officer: Ofc. T. Nguyen #3317.',
      'Narrative: Rear passenger window smashed; laptop bag and wallet taken. No injuries.'
    ],
    entities: [
      { text: 'Priya Raman', type: 'Crime victim name', rcw: '42.56.240', conf: 0.97 },
      { text: 'Marcus Hale', type: 'Witness name', rcw: '42.56.240', conf: 0.93 }
    ]
  },
  {
    id: 'REC-1005', title: 'Case file RPD-26-003902: burglary (active investigation)', dept: 'Police', type: 'Case File',
    date: daysAgo(33), sensitivity: 'Restricted (CJIS)', retention: 'Until case closed + 6 yrs', partitioned: true,
    body: [
      'ACTIVE INVESTIGATION: partitioned case file, access limited to assigned detectives.',
      'Lead detective: Det. R. Castillo #2861.',
      'Evidence items 1 to 14 logged in evidence management (i-PRO).'
    ],
    entities: []
  },
  {
    id: 'REC-1006', title: 'Personnel action: termination, Parks Maintenance Worker II', dept: 'Human Resources', type: 'Personnel Record',
    date: daysAgo(27), sensitivity: 'Confidential', retention: '6 yrs after separation',
    body: [
      'Employee: Derek Collins, Employee ID 40219, Parks Maintenance Worker II',
      'SSN: 541-22-8734',
      'Home address: 17720 NE 104th St, Redmond, WA 98052. Personal phone (425) 555-0187.',
      'Reason for separation: repeated violation of Policy 4.12 (City vehicle use); written warnings issued in January and April.',
      'Medical note: FMLA leave approved for lumbar disc injury, excluded from disciplinary consideration.',
      'Final pay remitted by direct deposit to Account #0045519273.'
    ],
    entities: [
      { text: 'Derek Collins', type: 'Employee name', rcw: '42.56.250', conf: 0.52 },
      { text: '17720 NE 104th St, Redmond, WA 98052', type: 'Employee home address', rcw: '42.56.250', conf: 0.96 },
      { text: 'FMLA leave approved for lumbar disc injury', type: 'Medical information', rcw: '70.02', conf: 0.94 }
    ]
  },
  {
    id: 'REC-1007', title: 'Performance evaluation: Parks Maintenance Worker II (2025)', dept: 'Human Resources', type: 'Personnel Record',
    date: daysAgo(210), sensitivity: 'Confidential', retention: '6 yrs after separation',
    body: [
      'Employee: Derek Collins. Supervisor: A. Brooks.',
      'Overall rating: Needs improvement. Vehicle logbook incomplete on 9 occasions.',
      'Development plan: complete fleet safety refresher by Q1.'
    ],
    entities: [
      { text: 'Derek Collins', type: 'Employee name', rcw: '42.56.250', conf: 0.52 }
    ]
  },
  {
    id: 'REC-1008', title: 'Utility account history: 8500 block NE 85th St', dept: 'Finance', type: 'Utility Billing',
    date: daysAgo(12), sensitivity: 'Confidential', retention: '6 yrs',
    body: [
      'Customer: Helen Brandt. Service address: 8547 NE 85th St, Redmond, WA 98052',
      'Utility account: UB-3310-88214. Card on file: VISA ending 4417',
      'July: high water use complaint; field check found irrigation leak. Leak adjustment credit $212.40 applied.',
      'Customer contact: (425) 555-0161, hbrandt@outlook.com'
    ],
    entities: [
      { text: 'Helen Brandt', type: 'Utility customer name', rcw: '42.56.330', conf: 0.9 },
      { text: 'UB-3310-88214', type: 'Utility account number', rcw: '42.56.330', conf: 0.95 }
    ]
  },
  {
    id: 'REC-1009', title: 'Building permit BLD-2026-0417: 15800 NE 90th St', dept: 'Planning', type: 'Permit',
    date: daysAgo(40), sensitivity: 'Public', retention: 'Life of structure',
    body: [
      'Parcel 1225059018. Scope: two-story addition, 640 sq ft.',
      'Applicant: Northshore Design Build, (425) 555-0120.',
      'Status: issued. Inspections: footing (passed), framing (scheduled).'
    ],
    entities: []
  },
  {
    id: 'REC-1010', title: 'City Council regular meeting minutes', dept: 'City Clerk', type: 'Minutes',
    date: daysAgo(21), sensitivity: 'Public', retention: 'Permanent (archival)',
    body: [
      'Call to order 7:00 p.m. All councilmembers present.',
      'Consent agenda approved 7-0, including ratification of culvert emergency authorization.',
      'Public comment: three speakers on downtown parking.',
      'Adjourned 8:52 p.m.'
    ],
    entities: []
  },
  {
    id: 'REC-1011', title: 'Change request CR-2291: firewall rule update', dept: 'Technology & Information Systems', type: 'IT Change Record',
    date: daysAgo(9), sensitivity: 'Restricted', retention: '3 yrs',
    body: [
      'Change: allow SCADA historian replication to DR site.',
      'Source 10.40.12.18 to destination 172.16.8.44 on TCP 1433.',
      'Approved by CAB. Implemented during maintenance window, no incidents.'
    ],
    entities: []
  },
  {
    id: 'REC-1012', title: 'Facility rental agreement: Anderson Park pavilion', dept: 'Parks & Recreation', type: 'Agreement',
    date: daysAgo(15), sensitivity: 'Internal', retention: '3 yrs',
    body: [
      'Renter: Tomas Echeverria, (425) 555-0107, tomas.e@gmail.com',
      'Event: family reunion, 60 guests, Saturday 10 a.m. to 4 p.m.',
      'Deposit paid by VISA ending 9021; refunded after inspection.'
    ],
    entities: [
      { text: 'Tomas Echeverria', type: 'Private citizen name', rcw: '42.56.230', conf: 0.66 }
    ]
  },
  {
    id: 'REC-1013', title: 'EMS incident report: Fire Station 11 response', dept: 'Fire', type: 'Incident Report',
    date: daysAgo(6), sensitivity: 'Restricted (HIPAA)', retention: '10 yrs',
    body: [
      'Unit M11 dispatched 14:05 to Marymoor Park ball fields.',
      'Patient: 54-year-old male, chest pain, history of hypertension. Transported to Evergreen Health.',
      'Crew: FF/PM J. Park, FF/EMT L. Ortega.'
    ],
    entities: [
      { text: '54-year-old male, chest pain, history of hypertension', type: 'Patient health information', rcw: '70.02', conf: 0.95 }
    ]
  },
  {
    id: 'REC-1014', title: 'Destruction log: FY2019 accounts payable records', dept: 'City Clerk', type: 'Destruction Log',
    date: daysAgo(45), sensitivity: 'Public', retention: 'Permanent (archival)',
    body: [
      'Series: accounts payable vouchers FY2019 (GS 03-04-2019). Retention met.',
      'Approved for destruction via electronic signature; 14 boxes shredded on site.'
    ],
    entities: []
  }
];

// ---------------------------------------------------------------------------
// Simulated AI: pattern rules + recognized entities -> suggested redactions
// ---------------------------------------------------------------------------

// Older records so the retention view has material eligible for disposition.
records.push(
  {
    id: 'REC-0901', title: 'Facility rental agreements: Parks, 2021 season', dept: 'Parks & Recreation', type: 'Agreement',
    date: daysAgo(365 * 4 + 40), sensitivity: 'Internal', retention: '3 yrs after event',
    body: ['142 pavilion and field rental agreements, 2021 season.', 'Deposits reconciled with Finance; no open claims.'], entities: []
  },
  {
    id: 'REC-0902', title: 'Utility billing adjustments FY2019', dept: 'Finance', type: 'Utility Billing',
    date: daysAgo(365 * 6 + 210), sensitivity: 'Confidential', retention: '6 yrs after fiscal year',
    body: ['Leak adjustment and billing correction register, FY2019.', '318 adjustments; audited in FY2020 State Auditor review.'], entities: []
  },
  {
    id: 'REC-0903', title: 'Email: trail maintenance crew scheduling (2022)', dept: 'Public Works', type: 'Email',
    date: daysAgo(365 * 3 + 25), sensitivity: 'Internal', retention: '2 yrs',
    body: ['Routine crew rotation and equipment scheduling for trail maintenance, spring 2022.'], entities: []
  },
  {
    id: 'REC-0904', title: 'Claim file CL-2018-044: sidewalk trip and fall, NE 83rd St', dept: 'City Clerk', type: 'Claim File',
    date: daysAgo(365 * 7 + 15), sensitivity: 'Confidential', retention: '6 yrs after closure',
    body: ['Claim for damages filed March 2018; denied; lawsuit filed in King County Superior Court.', 'Litigation ongoing; preserve all related records.'], entities: []
  }
);

// Retention in years from the record date (null = permanent / archival / until an event closes).
const RETENTION_YEARS = {
  'REC-1001': 6, 'REC-1002': null, 'REC-1003': 2, 'REC-1004': 6, 'REC-1005': null, 'REC-1006': 6, 'REC-1007': 6,
  'REC-1008': 6, 'REC-1009': null, 'REC-1010': null, 'REC-1011': 3, 'REC-1012': 3, 'REC-1013': 10, 'REC-1014': null,
  'REC-0901': 3, 'REC-0902': 6, 'REC-0903': 2, 'REC-0904': 6
};
records.forEach((r) => { r.retentionYears = RETENTION_YEARS[r.id] ?? null; });

const CITY_DOMAIN = /@redmond\.gov$/i;
const CITY_PHONE = /^\(425\) 556-/;

const RULES = [
  { type: 'Social Security number', re: /\b\d{3}-\d{2}-\d{4}\b/g, conf: 0.99, rcw: '42.56.230', rcwByDept: { 'Human Resources': '42.56.250' } },
  { type: 'Date of birth', re: /(?<=DOB )\d{2}\/\d{2}\/\d{4}/g, conf: 0.96, rcw: '42.56.230', rcwByDept: { Police: '42.56.240' } },
  { type: 'Financial account number', re: /(?<=Account #)\d{6,}/g, conf: 0.97, rcw: '42.56.230' },
  { type: 'Bank routing number', re: /(?<=routing )\d{9}/g, conf: 0.93, rcw: '42.56.230' },
  { type: 'Payment card', re: /VISA ending \d{4}/g, conf: 0.95, rcw: '42.56.230' },
  { type: 'Internal IP address', re: /\b\d{1,3}(?:\.\d{1,3}){3}\b/g, conf: 0.92, rcw: '42.56.420' },
  { type: 'Vehicle plate', re: /(?<=plate )[A-Z0-9]{6,7}/g, conf: 0.61, rcw: '42.56.240' },
  { type: 'Phone number', re: /\(\d{3}\) \d{3}-\d{4}/g, conf: 0.9, rcw: '42.56.230', rcwByDept: { Police: '42.56.240', 'Human Resources': '42.56.250', Finance: '42.56.330' } },
  { type: 'Email address', re: /[\w.+-]+@[\w-]+\.[\w.]+/g, conf: 0.9, rcw: '42.56.230', rcwByDept: { Police: '42.56.240', Finance: '42.56.330' } }
];

// Contact details on these lines are usually business information, not private.
const BUSINESS_LINE = /^(Contractor contact|Applicant|City project manager|From:)/;

function runAi(record) {
  const found = [];
  const overlaps = (line, start, end) => found.some((f) => f.line === line && start < f.end && end > f.start);

  record.body.forEach((text, line) => {
    record.entities.forEach((entity) => {
      let idx = text.indexOf(entity.text);
      while (idx !== -1) {
        if (!overlaps(line, idx, idx + entity.text.length)) {
          found.push({ line, start: idx, end: idx + entity.text.length, text: entity.text, type: entity.type, rcw: entity.rcw, conf: entity.conf });
        }
        idx = text.indexOf(entity.text, idx + 1);
      }
    });

    RULES.forEach((rule) => {
      for (const match of text.matchAll(rule.re)) {
        const start = match.index;
        const end = start + match[0].length;
        if (overlaps(line, start, end)) continue;
        let conf = rule.conf;
        if (CITY_DOMAIN.test(match[0]) || CITY_PHONE.test(match[0])) conf = 0.34; // City staff contact info is public
        else if (BUSINESS_LINE.test(text)) conf = Math.min(conf, 0.55);
        found.push({ line, start, end, text: match[0], type: rule.type, rcw: rule.rcwByDept?.[record.dept] ?? rule.rcw, conf });
      }
    });
  });

  return found.sort((a, b) => a.line - b.line || a.start - b.start);
}

// ---------------------------------------------------------------------------
// Requests, redactions, audit
// ---------------------------------------------------------------------------

const STATUSES = ['Received', 'In Review', 'Released', 'Delivered'];

const requests = [
  {
    id: 'PRR-26-1184', requester: 'Jordan Pike, Eastside Ledger', received: daysAgo(3, 10, 12),
    description: 'All contracts, council materials and staff emails about the 2026 Bear Creek Trail culvert replacement.',
    recordIds: ['REC-1001', 'REC-1002', 'REC-1003'], status: 'Received', assignee: CURRENT_USER
  },
  {
    id: 'PRR-26-1191', requester: 'Northwest Mutual Insurance (claims)', received: daysAgo(2, 14, 40),
    description: 'Police report for vehicle prowl RPD-26-004417 at Downtown Park.',
    recordIds: ['REC-1004'], status: 'Received', assignee: CURRENT_USER
  },
  {
    id: 'PRR-26-1196', requester: 'Anonymous (via GovQA portal)', received: daysAgo(6, 9, 5),
    description: 'Discipline and separation records for Parks maintenance staff, 2025 to present.',
    recordIds: ['REC-1006', 'REC-1007'], status: 'Received', assignee: CURRENT_USER
  },
  {
    id: 'PRR-26-1202', requester: 'Marta Lindqvist', received: daysAgo(1, 16, 20),
    description: 'Utility billing complaints and credits for the 8500 block of NE 85th St.',
    recordIds: ['REC-1008'], status: 'Received', assignee: CURRENT_USER
  },
  {
    id: 'PRR-26-1175', requester: 'Redmond Neighbors Association', received: daysAgo(12, 11, 0),
    description: 'Minutes and destruction logs related to FY2019 records disposition.',
    recordIds: ['REC-1010', 'REC-1014'], status: 'Received', assignee: 'S. Chen'
  }
];

let redactions = [];   // { id, requestId, recordId, line, start, end, text, type, rcw, conf, source, status }
let audit = [];        // { ts, actor, user, action, requestId, recordId, detail }
let releasedCopies = {}; // `${requestId}|${recordId}` -> string[]
let nextRedactionId = 1;

function logAudit(entry) {
  audit.unshift({ ...entry, ts: entry.ts ?? new Date(), user: entry.actor === 'AI' ? 'Redaction model v2.3' : (entry.user ?? role().user) });
  audit.sort((a, b) => b.ts - a.ts);
}

function getRecord(id) {
  return records.find((r) => r.id === id);
}

function getRequest(id) {
  return requests.find((r) => r.id === id);
}

function dueDate(req) {
  return addBusinessDays(req.received, 5);
}

function redactionsFor(requestId, recordId) {
  return redactions.filter((r) => r.requestId === requestId && (!recordId || r.recordId === recordId));
}

function pendingCount(requestId, recordId) {
  return redactionsFor(requestId, recordId).filter((r) => r.status === 'pending').length;
}

// The AI scans a record once per request; results are stored as pending suggestions.
function scanRecord(req, recordId, ts) {
  if (redactionsFor(req.id, recordId).length || req.scanned?.includes(recordId)) return 0;
  req.scanned = [...(req.scanned ?? []), recordId];
  const found = runAi(getRecord(recordId));
  found.forEach((f) => {
    redactions.push({ id: nextRedactionId++, requestId: req.id, recordId, source: 'AI', status: 'pending', ...f });
    logAudit({ ts, actor: 'AI', action: 'Suggested', requestId: req.id, recordId, detail: `${f.type} "${f.text}" · ${Math.round(f.conf * 100)}% · RCW ${f.rcw}` });
  });
  return found.length;
}

function startReview(req, ts) {
  if (req.status !== 'Received') return 0;
  req.status = 'In Review';
  logAudit({ ts, actor: 'Human', action: 'Opened for review', requestId: req.id, detail: plural(req.recordIds.length, 'responsive record') });
  return req.recordIds.reduce((sum, id) => sum + scanRecord(req, id, ts), 0);
}

function setStatus(redaction, status, ts) {
  if (redaction.status === status) return;
  redaction.status = status;
  logAudit({ ts, actor: 'Human', action: status === 'accepted' ? 'Accepted' : 'Rejected', requestId: redaction.requestId, recordId: redaction.recordId, detail: `${redaction.source === 'AI' ? 'AI suggestion' : 'Manual redaction'}: ${redaction.type} "${redaction.text}"` });
}

function buildReleasedCopy(record, reds) {
  return record.body.map((text, line) => {
    const spans = reds.filter((r) => r.line === line && r.status === 'accepted').sort((a, b) => b.start - a.start);
    let out = text;
    spans.forEach((r) => { out = out.slice(0, r.start) + `\u0000${r.rcw}\u0001${'█'.repeat(Math.max(4, r.end - r.start))}\u0002` + out.slice(r.end); });
    return out;
  });
}

function releaseRequest(req, ts) {
  req.recordIds.forEach((recordId) => {
    releasedCopies[`${req.id}|${recordId}`] = buildReleasedCopy(getRecord(recordId), redactionsFor(req.id, recordId));
  });
  req.status = 'Released';
  req.releasedAt = ts ?? new Date();
  const count = redactionsFor(req.id).filter((r) => r.status === 'accepted').length;
  logAudit({ ts, actor: 'Human', action: 'Approved & released', requestId: req.id, detail: `${plural(req.recordIds.length, 'record')}, ${plural(count, 'redaction')}. Originals preserved unchanged.` });
}

function deliverRequest(req, ts) {
  req.status = 'Delivered';
  req.deliveredAt = ts ?? new Date();
  logAudit({ ts, actor: 'Human', action: 'Delivered to GovQA', requestId: req.id, detail: 'Released copies and exemption log uploaded to requester portal' });
}

// ---------------------------------------------------------------------------
// Retention, legal holds, disposition
// ---------------------------------------------------------------------------

const holds = [
  { id: 'LH-2026-01', matter: 'Moreau v. City of Redmond: Bear Creek Trail flooding claim', recordIds: ['REC-1001', 'REC-1002', 'REC-1003'], placedBy: 'City Attorney\'s Office', date: daysAgo(50), active: true },
  { id: 'LH-2025-07', matter: 'CL-2018-044 sidewalk claim: King County Superior Court litigation', recordIds: ['REC-0904'], placedBy: 'City Attorney\'s Office', date: daysAgo(410), active: true },
  { id: 'LH-2026-03', matter: 'RPD-26-003902 active investigation', recordIds: ['REC-1005'], placedBy: 'Police Department', date: daysAgo(33), active: true }
];
let nextHoldNum = 4;

const batches = []; // destruction logs
let nextBatchNum = 14;

const APPROVERS = [
  { role: 'Department Director', name: 'M. Hughes' },
  { role: 'Records Officer (City Clerk)', name: 'C. Ruiz' }
];

function activeHold(rec) {
  return holds.find((h) => h.active && h.recordIds.includes(rec.id));
}

function isHeld(rec) {
  return !!activeHold(rec);
}

function eligibleDate(rec) {
  if (rec.retentionYears == null) return null;
  const d = new Date(rec.date);
  d.setFullYear(d.getFullYear() + rec.retentionYears);
  return startOfDay(d);
}

// Why a record can or can't be destroyed today.
function disposition(rec) {
  if (rec.destroyed) return { code: 'destroyed', label: `Destroyed ${fmtDate(rec.destroyed.date)}` };
  const due = eligibleDate(rec);
  const hold = activeHold(rec);
  const holdNote = hold ? ` · hold ${hold.id}` : '';
  if (!due) return { code: 'permanent', label: `Permanent / event-based${holdNote}` };
  if (due > TODAY) return { code: 'active', label: `Retain until ${fmtDate(due)}${holdNote}` };
  if (hold) return { code: 'hold', label: `Blocked: legal hold ${hold.id}` };
  const prr = requests.find((q) => q.status !== 'Delivered' && q.recordIds.includes(rec.id));
  if (prr) return { code: 'prr', label: `Blocked: open request ${prr.id}` };
  const batch = batches.find((b) => b.status !== 'Destroyed' && b.recordIds.includes(rec.id));
  if (batch) return { code: 'batch', label: `In destruction log ${batch.id}` };
  return { code: 'eligible', label: `Eligible since ${fmtDate(due)}` };
}

function createBatch(recordIds) {
  const batch = {
    id: `DL-2026-${String(nextBatchNum++).padStart(3, '0')}`, recordIds, createdAt: new Date(), createdBy: role().user,
    steps: APPROVERS.map((a) => ({ ...a, signedAt: null })), status: 'Pending approval'
  };
  batches.unshift(batch);
  logAudit({ actor: 'Human', action: 'Created destruction log', detail: `${batch.id}: ${plural(recordIds.length, 'record')} routed to ${APPROVERS.map((a) => a.name).join(' → ')}` });
  return batch;
}

function signBatch(batch) {
  const step = batch.steps.find((s) => !s.signedAt);
  if (!step) return;
  step.signedAt = new Date();
  if (batch.steps.every((s) => s.signedAt)) batch.status = 'Approved';
  logAudit({ actor: 'Human', user: step.name, action: 'E-signed destruction log', detail: `${batch.id} approved by ${step.role}` });
}

function executeBatch(batch) {
  // Re-check blockers at execution time: a hold or request may have appeared since approval.
  const blocked = batch.recordIds.filter((id) => ['hold', 'prr'].includes(disposition({ ...getRecord(id), destroyed: null }).code));
  batch.recordIds.filter((id) => !blocked.includes(id)).forEach((id) => {
    const rec = getRecord(id);
    rec.destroyed = { date: new Date(), batchId: batch.id };
    logAudit({ actor: 'Human', action: 'Destroyed record', recordId: id, detail: `Retention met (${rec.retention}). Certificate of destruction in ${batch.id}` });
  });
  batch.status = 'Destroyed';
  batch.blocked = blocked;
  batch.executedAt = new Date();
  return blocked;
}

// Nightly job flags records whose retention period has been met.
function seedRetentionAlerts() {
  records.forEach((rec) => {
    const due = eligibleDate(rec);
    if (due && due <= TODAY) {
      logAudit({ ts: daysAgo(0, 2, 0), actor: 'System', user: 'Retention job', action: 'Retention period met', recordId: rec.id, detail: `${rec.title}: ${rec.retention}${isHeld(rec) ? ` · on legal hold ${activeHold(rec).id}` : ''}` });
    }
  });
}

// Seed: one request already completed end to end, so the history isn't empty.
(function seedHistory() {
  const done = getRequest('PRR-26-1175');
  startReview(done, daysAgo(11, 9, 30));
  redactionsFor(done.id).forEach((r) => setStatus(r, 'accepted', daysAgo(11, 10, 5)));
  releaseRequest(done, daysAgo(10, 15, 20));
  deliverRequest(done, daysAgo(10, 15, 24));
  done.user = 'S. Chen';
  audit.filter((a) => a.requestId === done.id && a.actor === 'Human').forEach((a) => { a.user = 'S. Chen'; });
})();
seedRetentionAlerts();

// ---------------------------------------------------------------------------
// UI state + helpers
// ---------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const ui = { view: 'requests', requestId: null, recordId: null, docMode: 'review', recordDetailId: null };

const BADGE = {
  Received: 'open', 'In Review': 'in-progress', Released: 'complete', Delivered: 'complete',
  pending: 'in-progress', accepted: 'overdue', rejected: 'neutral',
  Public: 'complete', Internal: 'open', Confidential: 'in-progress', Restricted: 'overdue',
  AI: 'ai', Human: 'human', System: 'system', Overdue: 'overdue', 'Legal hold': 'overdue',
  Eligible: 'in-progress', 'Pending approval': 'in-progress', Approved: 'open', Destroyed: 'neutral'
};

function badge(label, key = label) {
  const cls = BADGE[key] ?? BADGE[String(key).split(' ')[0]] ?? 'open';
  return `<span class="status-badge ${cls}">${escapeHtml(label)}</span>`;
}

function confClass(conf) {
  return conf >= 0.9 ? 'high' : conf >= 0.7 ? 'med' : 'low';
}

let toastTimer;
function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3400);
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

const TITLES = {
  requests: ['Public Records', 'Requests'],
  request: ['Public Records · Request', 'Review & release'],
  records: ['Enterprise Content', 'Records Library'],
  audit: ['AI Governance', 'AI & Audit Trail'],
  retention: ['Records Management', 'Retention & Legal Holds']
};

function go(view, id) {
  ui.view = view;
  if (view === 'request') {
    const req = getRequest(id);
    if (!req) return go('requests');
    if (ui.requestId !== id) {
      ui.requestId = id;
      ui.recordId = req.recordIds[0] ?? null;
      ui.docMode = req.status === 'Released' || req.status === 'Delivered' ? 'released' : 'review';
    }
    const suggested = role().review ? startReview(req) : 0;
    if (suggested) showToast(`AI scanned ${plural(req.recordIds.length, 'record')} and suggested ${plural(suggested, 'redaction')}. Nothing is redacted until you approve.`);
  }
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === (view === 'request' ? 'requests' : view)));
  $('viewEyebrow').textContent = TITLES[view][0];
  $('viewTitle').textContent = TITLES[view][1];
  history.replaceState(null, '', view === 'request' ? `#/request/${id}` : `#/${view}`);
  render();
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

function renderRequests() {
  const open = requests.filter((r) => r.status !== 'Delivered');
  const dueSoon = open.filter((r) => daysUntil(dueDate(r)) <= 2);
  const awaiting = redactions.filter((r) => r.status === 'pending').length;
  const delivered = requests.filter((r) => r.status === 'Delivered');

  $('prrKpis').innerHTML = [
    ['Open requests', open.length, `${requests.length} total this period`, 'accent-blue'],
    ['Due within 2 business days', dueSoon.length, dueSoon.filter((r) => daysUntil(dueDate(r)) < 0).length + ' overdue', 'accent-gold'],
    ['AI suggestions awaiting review', awaiting, 'Human approval required', 'accent-red'],
    ['Delivered', delivered.length, 'via GovQA portal', 'accent-green']
  ].map(([label, value, sub, cls]) => `
    <div class="kpi-card ${cls}"><span class="kpi-label">${label}</span><strong>${value}</strong><small>${sub}</small></div>`).join('');

  $('navOpenCount').textContent = open.length;

  $('requestTableBody').innerHTML = [...requests]
    .sort((a, b) => (a.status === 'Delivered') - (b.status === 'Delivered') || dueDate(a) - dueDate(b))
    .map((req) => {
      const days = daysUntil(dueDate(req));
      const dueNote = req.status === 'Delivered' ? 'responded' : days < 0 ? `${plural(-days, 'business day')} overdue` : days === 0 ? 'due today' : `${plural(days, 'business day')} left`;
      const pending = pendingCount(req.id);
      const notScanned = req.status === 'Received';
      return `
      <tr class="clickable-row" data-request-id="${req.id}" tabindex="0">
        <td><strong class="mono">${req.id}</strong><div class="muted small">${escapeHtml(req.description)}</div></td>
        <td>${escapeHtml(req.requester)}</td>
        <td>${fmtDate(req.received)}</td>
        <td>${fmtDate(dueDate(req))} <span class="small ${days < 0 && req.status !== 'Delivered' ? 'text-red' : 'muted'}">(${dueNote})</span></td>
        <td class="num">${req.recordIds.length}</td>
        <td class="num">${notScanned ? '<span class="muted small">not started</span>' : pending}</td>
        <td>${badge(req.status)}</td>
      </tr>`;
    }).join('');
}

function renderRequestWorkspace() {
  const req = getRequest(ui.requestId);
  if (!req) return;
  const locked = req.status === 'Released' || req.status === 'Delivered';
  const manage = role().manage;
  const totalPending = pendingCount(req.id);

  const banner = $('roleBanner');
  const hiddenHere = req.recordIds.filter((id) => !canView(getRecord(id))).length;
  banner.classList.toggle('hidden', manage && !hiddenHere);
  banner.innerHTML = !role().review
    ? `<strong>Read-only:</strong> ${escapeHtml(role().user)} can follow this request but can't review or release it.`
    : !manage
      ? `<strong>${escapeHtml(role().title)}:</strong> you can review redactions on police records. The City Clerk approves the release.`
      : `<strong>${plural(hiddenHere, 'restricted record')}</strong> in this request ${hiddenHere === 1 ? 'is' : 'are'} reviewed by a department records specialist. Your role can't open CJIS content.`;

  $('reqTitle').innerHTML = `<span class="mono">${req.id}</span> · ${escapeHtml(req.requester)}`;
  $('reqMeta').textContent = `${req.description} Received ${fmtDate(req.received)} · Response due ${fmtDate(dueDate(req))} (5 business days) · Assigned to ${req.assignee}`;

  const step = STATUSES.indexOf(req.status);
  $('reqStepper').innerHTML = STATUSES.map((s, i) => `<li class="${i < step ? 'done' : i === step ? 'current' : ''}">${s}</li>`).join('');

  const releaseBtn = $('releaseBtn');
  releaseBtn.disabled = locked || !manage || totalPending > 0 || req.recordIds.length === 0;
  releaseBtn.textContent = locked ? 'Released' : totalPending > 0 ? `${totalPending} pending review` : !manage ? 'Clerk approves release' : 'Approve & release';
  $('deliverBtn').disabled = req.status !== 'Released' || !manage;
  $('deliverBtn').textContent = req.status === 'Delivered' ? 'Delivered to GovQA ✓' : 'Send to GovQA portal';

  // Responsive records list
  $('wsRecordCount').textContent = plural(req.recordIds.length, 'record');
  $('wsRecordList').innerHTML = req.recordIds.map((id) => {
    const rec = getRecord(id);
    const pending = pendingCount(req.id, id);
    const accepted = redactionsFor(req.id, id).filter((r) => r.status === 'accepted').length;
    return `
    <li class="${id === ui.recordId ? 'active' : ''}" data-record-id="${id}">
      <div class="rl-title">${canView(rec) ? '' : '<span class="lock" title="Restricted for your role">🔒</span> '}${escapeHtml(rec.title)}</div>
      <div class="rl-meta">
        <span class="muted small">${rec.dept}</span>
        ${pending ? `<span class="status-badge in-progress">${pending} pending</span>` : `<span class="status-badge ${accepted ? 'overdue' : 'complete'}">${accepted ? `${accepted} redacted` : 'no redactions'}</span>`}
        ${!locked && manage ? `<button class="icon-btn" data-remove-record="${id}" title="Remove from request" aria-label="Remove ${escapeHtml(rec.title)} from request">✕</button>` : ''}
      </div>
    </li>`;
  }).join('') || '<li class="empty-state">No records attached yet.</li>';

  $('addRecordSearch').disabled = locked || !manage;
  $('addRecordSearch').placeholder = locked ? 'Request released: records locked' : !manage ? 'Coordinator adds records' : 'Search library to add a record…';
  renderAddResults(req);
  renderDocument(req, locked);
  renderSuggestions(req, locked);
  renderExemptionLog(req);
  $('reqAuditList').innerHTML = auditItems(audit.filter((a) => a.requestId === req.id)) || '<li class="empty-state">No activity yet.</li>';
}

function renderAddResults(req) {
  const q = $('addRecordSearch').value.trim().toLowerCase();
  if (!q) { $('addRecordResults').innerHTML = ''; return; }
  const matches = records.filter((r) => canView(r) && !r.destroyed && !req.recordIds.includes(r.id) && (r.title + ' ' + r.body.join(' ') + ' ' + r.dept).toLowerCase().includes(q)).slice(0, 5);
  $('addRecordResults').innerHTML = matches.map((r) => `
    <li><button type="button" data-add-record="${r.id}"><strong>+</strong> ${escapeHtml(r.title)} <span class="muted small">${r.dept}</span></button></li>`).join('')
    || '<li class="empty-state small">No matching records.</li>';
}

function renderDocument(req, locked) {
  const rec = getRecord(ui.recordId);
  const docBody = $('docBody');
  if (!rec) {
    $('docTitle').textContent = 'Select a record';
    $('docMeta').textContent = '';
    docBody.innerHTML = '<p class="empty-state">Choose a responsive record to review.</p>';
    return;
  }
  if (!locked && ui.docMode === 'released') ui.docMode = 'review';
  const viewable = canView(rec) && !rec.partitioned;
  const act = !locked && canReview(rec);
  $('docTitle').textContent = rec.title;
  $('docMeta').innerHTML = `${rec.id} · ${rec.dept} · ${rec.type} · ${fmtDate(rec.date)} · ${badge(rec.sensitivity, rec.sensitivity)}${isHeld(rec) ? ' ' + badge('Legal hold') : ''}`;
  document.querySelectorAll('#docToggle button').forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === ui.docMode);
    b.disabled = !viewable || (b.dataset.mode === 'released' && !locked);
  });
  $('docLegend').classList.toggle('hidden', !viewable || ui.docMode !== 'review');
  $('manualBar').classList.toggle('hidden', !act || ui.docMode !== 'review');

  if (!viewable) {
    docBody.className = 'doc-body locked-doc';
    docBody.innerHTML = rec.partitioned
      ? '<p class="lock-msg">🔒 <strong>Partitioned: active investigation.</strong><br>Only assigned detectives can open this case file.</p>'
      : `<p class="lock-msg">🔒 <strong>Restricted for your role.</strong><br>${escapeHtml(rec.sensitivity)} content is reviewed by a ${escapeHtml(rec.dept)} records specialist. Access follows Entra ID group membership, and every attempt is logged.</p>`;
    return;
  }

  const lines = ui.docMode === 'released'
    ? (releasedCopies[`${req.id}|${rec.id}`] ?? rec.body).map((text) => escapeHtml(text)
        .replace(/\u0000([\d.]+)\u0001(█+)\u0002/g, (_, rcw, bar) => `<span class="bar" title="Redacted under RCW ${rcw}">${bar}</span><sup class="bar-code">${rcw}</sup>`))
    : rec.body.map((text, line) => ui.docMode === 'original' ? escapeHtml(text) : markLine(text, redactionsFor(req.id, rec.id).filter((r) => r.line === line)));

  docBody.className = `doc-body mode-${ui.docMode}`;
  docBody.innerHTML = lines.map((html, i) => `<p data-line="${i}"><span class="ln">${i + 1}</span>${html}</p>`).join('');
  if (ui.docMode === 'original') docBody.insertAdjacentHTML('afterbegin', '<p class="doc-note">Original record: preserved unaltered in the repository.</p>');
  if (ui.docMode === 'released') docBody.insertAdjacentHTML('afterbegin', `<p class="doc-note">Released copy: redactions are burned in and can't be reversed. Released ${fmtDateTime(req.releasedAt)}.</p>`);
}

function markLine(text, reds) {
  let html = '';
  let pos = 0;
  [...reds].sort((a, b) => a.start - b.start).forEach((r) => {
    html += escapeHtml(text.slice(pos, r.start));
    html += `<mark class="red ${r.status}" data-red-id="${r.id}" title="${escapeHtml(r.type)} · RCW ${r.rcw}">${escapeHtml(text.slice(r.start, r.end))}</mark>`;
    pos = r.end;
  });
  return html + escapeHtml(text.slice(pos));
}

function renderSuggestions(req, locked) {
  const rec = getRecord(ui.recordId);
  const reds = redactionsFor(req.id, ui.recordId);
  const pending = reds.filter((r) => r.status === 'pending').length;
  const act = !!rec && !locked && canReview(rec);
  $('suggCount').textContent = `${reds.length} items · ${pending} pending`;
  $('acceptHighBtn').disabled = !act || !reds.some((r) => r.status === 'pending' && r.conf >= 0.9);
  if (rec && (!canView(rec) || rec.partitioned)) {
    $('suggList').innerHTML = `<li class="empty-state">${pending ? `${plural(pending, 'suggestion')} waiting for a ${escapeHtml(rec.dept)} reviewer.` : 'Reviewed by department specialist.'} Details hidden for your role.</li>`;
    return;
  }

  const rcwOptions = (selected) => Object.keys(RCW).map((code) => `<option value="${code}" ${code === selected ? 'selected' : ''}>RCW ${code}</option>`).join('');

  $('suggList').innerHTML = reds.map((r) => `
    <li class="sugg ${r.status}" data-red-id="${r.id}">
      <div class="sugg-head">
        <span class="sugg-type">${escapeHtml(r.type)}</span>
        ${r.source === 'AI' ? `<span class="conf ${confClass(r.conf)}" title="Model confidence">${Math.round(r.conf * 100)}%</span>` : '<span class="status-badge human">Manual</span>'}
      </div>
      <div class="sugg-text">"${escapeHtml(r.text)}"</div>
      <div class="sugg-controls">
        <select data-rcw-for="${r.id}" ${act ? '' : 'disabled'} aria-label="Exemption">${rcwOptions(r.rcw)}</select>
        ${!act ? badge(r.status === 'accepted' ? 'Redacted' : r.status === 'rejected' ? 'Not redacted' : 'Pending review', r.status) : `
        <button type="button" class="mini-btn ${r.status === 'accepted' ? 'on' : ''}" data-act="accepted" data-id="${r.id}">Redact</button>
        <button type="button" class="mini-btn ${r.status === 'rejected' ? 'on' : ''}" data-act="rejected" data-id="${r.id}">Keep visible</button>`}
      </div>
    </li>`).join('') || '<li class="empty-state">No sensitive content detected in this record.</li>';

  const manualRcw = $('manualRcw');
  if (!manualRcw.options.length) manualRcw.innerHTML = Object.keys(RCW).map((c) => `<option value="${c}">RCW ${c}</option>`).join('');
}

function renderExemptionLog(req) {
  const rows = redactionsFor(req.id).filter((r) => r.status === 'accepted')
    .sort((a, b) => req.recordIds.indexOf(a.recordId) - req.recordIds.indexOf(b.recordId) || a.line - b.line);
  $('exemptionLogBody').innerHTML = rows.map((r) => `
    <tr>
      <td class="mono small nowrap">${r.recordId}</td>
      <td class="num">${r.line + 1}</td>
      <td>${escapeHtml(r.type)}</td>
      <td class="nowrap">RCW ${r.rcw}</td>
      <td class="small muted">${escapeHtml(RCW[r.rcw])}</td>
    </tr>`).join('') || '<tr><td colspan="5" class="empty-state">Redactions appear here as they are approved.</td></tr>';
}

function auditItems(entries) {
  return entries.map((a) => `
    <li class="audit-item ${a.actor.toLowerCase()}">
      <span class="actor">${badge(a.actor)}</span>
      <div>
        <div><strong>${escapeHtml(a.action)}</strong>${a.recordId ? ` <span class="mono small muted">${a.recordId}</span>` : ''} <span class="mono small muted">${a.requestId ?? ''}</span></div>
        <div class="small">${a.recordId && !canView(getRecord(a.recordId)) ? '<span class="muted">Details hidden: restricted record</span>' : escapeHtml(a.detail)}</div>
        <div class="small muted">${escapeHtml(a.user)} · ${fmtDateTime(a.ts)}</div>
      </div>
    </li>`).join('');
}

function renderRecords() {
  const q = $('recSearch').value.trim().toLowerCase();
  const dept = $('recDeptFilter').value;
  const type = $('recTypeFilter').value;
  const visible = records.filter((r) => canView(r) && !r.destroyed);
  const hidden = records.length - visible.length;
  const list = visible.filter((r) => (!dept || r.dept === dept) && (!type || r.type === type)
    && (!q || (r.title + ' ' + r.body.join(' ') + ' ' + r.id).toLowerCase().includes(q)));

  $('recordCount').textContent = (q || dept || type ? `${list.length} of ${visible.length} records` : `${visible.length} records · full-text indexed`)
    + (hidden ? ` · ${hidden} hidden by your permissions` : '');
  $('recordTableBody').innerHTML = list.map((r) => `
    <tr class="clickable-row ${r.id === ui.recordDetailId ? 'selected' : ''}" data-record-detail="${r.id}" tabindex="0">
      <td><strong>${escapeHtml(r.title)}</strong><div class="mono small muted">${r.id}</div></td>
      <td>${escapeHtml(r.dept)}</td>
      <td>${escapeHtml(r.type)}</td>
      <td class="nowrap">${fmtDate(r.date)}</td>
      <td>${badge(r.sensitivity, r.sensitivity)}</td>
      <td class="small">${escapeHtml(r.retention)}</td>
      <td>${isHeld(r) ? badge(`Hold ${activeHold(r).id}`, 'Legal hold') : disposition(r).code === 'eligible' ? badge('Eligible for destruction', 'Eligible') : '<span class="muted small">Active</span>'}</td>
    </tr>`).join('') || '<tr><td colspan="7" class="empty-state">No records match these filters.</td></tr>';

  const rec = getRecord(ui.recordDetailId);
  const detail = $('recordDetail');
  detail.classList.toggle('hidden', !rec);
  if (!rec) return;
  const usedIn = requests.filter((r) => r.recordIds.includes(rec.id));
  detail.innerHTML = `
    <div class="detail-header">
      <div><div class="eyebrow muted">${rec.id} · ${escapeHtml(rec.type)}</div><h4>${escapeHtml(rec.title)}</h4></div>
      <button class="ghost-btn" type="button" data-close-detail>Close</button>
    </div>
    <div class="detail-grid">
      <div><span class="meta-label">Department</span><strong>${escapeHtml(rec.dept)}</strong></div>
      <div><span class="meta-label">Sensitivity</span>${badge(rec.sensitivity, rec.sensitivity)}</div>
      <div><span class="meta-label">Retention</span><strong>${escapeHtml(rec.retention)}</strong></div>
      <div><span class="meta-label">Legal hold</span><strong>${isHeld(rec) ? `${activeHold(rec).id}: deletion blocked` : 'No'}</strong></div>
    </div>
    ${rec.partitioned ? '<p class="lock-msg">🔒 <strong>Partitioned: active investigation.</strong> Only assigned detectives can open this case file.</p>' : `<div class="doc-body mode-original">${rec.body.map((t, i) => `<p><span class="ln">${i + 1}</span>${escapeHtml(t)}</p>`).join('')}</div>`}
    <p class="small muted">Used in requests: ${usedIn.length ? usedIn.map((r) => `<a href="#/request/${r.id}" data-open-request="${r.id}">${r.id}</a>`).join(', ') : 'none'}</p>`;
}

function renderAudit() {
  const ai = redactions.filter((r) => r.source === 'AI');
  const decided = ai.filter((r) => r.status !== 'pending');
  const accepted = decided.filter((r) => r.status === 'accepted');
  const manual = redactions.filter((r) => r.source === 'Human');
  const acceptRate = decided.length ? Math.round((accepted.length / decided.length) * 100) : 0;

  $('aiKpis').innerHTML = [
    ['AI suggestions', ai.length, `${ai.length - decided.length} awaiting human review`, 'accent-blue'],
    ['Accepted by reviewers', `${acceptRate}%`, `${accepted.length} of ${decided.length} decided`, 'accent-green'],
    ['Rejected by reviewers', decided.length - accepted.length, 'Possible false positives', 'accent-gold'],
    ['Added manually', manual.length, 'Possible AI misses (false negatives)', 'accent-red']
  ].map(([label, value, sub, cls]) => `
    <div class="kpi-card ${cls}"><span class="kpi-label">${label}</span><strong>${value}</strong><small>${sub}</small></div>`).join('');

  const actor = $('auditActorFilter').value;
  $('auditList').innerHTML = auditItems(audit.filter((a) => !actor || a.actor === actor)) || '<li class="empty-state">No entries.</li>';
}

const selectedForBatch = new Set();

function renderRetention() {
  const manage = role().manage;
  const live = records.filter((r) => canView(r) && !r.destroyed);
  const disp = new Map(live.map((r) => [r.id, disposition(r)]));
  const count = (code) => [...disp.values()].filter((d) => d.code === code).length;
  const awaiting = batches.filter((b) => b.status !== 'Destroyed').length;

  $('retKpis').innerHTML = [
    ['Eligible for destruction', count('eligible'), 'Retention period met, no blockers', 'accent-gold'],
    ['Blocked by legal hold', count('hold'), `${holds.filter((h) => h.active).length} active holds`, 'accent-red'],
    ['Blocked by open request', count('prr'), 'Preserved while a PRR is pending', 'accent-blue'],
    ['Destruction logs in approval', awaiting, `${batches.filter((b) => b.status === 'Destroyed').length} completed`, 'accent-green']
  ].map(([label, value, sub, cls]) => `
    <div class="kpi-card ${cls}"><span class="kpi-label">${label}</span><strong>${value}</strong><small>${sub}</small></div>`).join('');

  // Only offer selection for records that are still eligible
  [...selectedForBatch].forEach((id) => { if (disp.get(id)?.code !== 'eligible') selectedForBatch.delete(id); });

  const order = { eligible: 0, hold: 1, prr: 2, batch: 3, active: 4, permanent: 5 };
  const rows = [...live].sort((a, b) => order[disp.get(a.id).code] - order[disp.get(b.id).code] || (eligibleDate(a) ?? Infinity) - (eligibleDate(b) ?? Infinity));
  const statusBadge = { eligible: 'in-progress', hold: 'overdue', prr: 'open', batch: 'open', active: 'complete', permanent: 'neutral' };

  $('retentionTableBody').innerHTML = rows.map((r) => {
    const d = disp.get(r.id);
    const eligible = d.code === 'eligible';
    return `
    <tr class="${eligible ? 'row-eligible' : ''}">
      <td class="check-col">${eligible && manage ? `<input type="checkbox" data-select-record="${r.id}" ${selectedForBatch.has(r.id) ? 'checked' : ''} aria-label="Select ${escapeHtml(r.title)}" />` : ''}</td>
      <td><strong>${escapeHtml(r.title)}</strong><div class="mono small muted">${r.id} · ${fmtDate(r.date)}</div></td>
      <td>${escapeHtml(r.dept)}</td>
      <td class="small">${escapeHtml(r.retention)}</td>
      <td><span class="status-badge ${statusBadge[d.code]}">${escapeHtml(d.label)}</span></td>
      <td>${manage && !isHeld(r) && d.code !== 'permanent' ? `<button class="mini-btn" type="button" data-quick-hold="${r.id}">Hold</button>` : ''}</td>
    </tr>`;
  }).join('');

  const eligibleIds = rows.filter((r) => disp.get(r.id).code === 'eligible').map((r) => r.id);
  $('selectAllEligible').disabled = !manage || !eligibleIds.length;
  $('selectAllEligible').checked = eligibleIds.length > 0 && eligibleIds.every((id) => selectedForBatch.has(id));
  $('createBatchBtn').disabled = !manage || selectedForBatch.size === 0;
  $('createBatchBtn').textContent = !manage ? 'Coordinator creates logs' : `Create destruction log${selectedForBatch.size ? ` (${selectedForBatch.size})` : ''}`;

  $('batchList').innerHTML = batches.map((b) => {
    const next = b.steps.find((s) => !s.signedAt);
    return `
    <div class="batch">
      <div class="batch-head"><strong class="mono">${b.id}</strong>${badge(b.status)}</div>
      <div class="small muted">Created by ${escapeHtml(b.createdBy)} · ${fmtDateTime(b.createdAt)}</div>
      <ul class="batch-records">${b.recordIds.map((id) => {
        const rec = getRecord(id);
        return `<li class="${rec.destroyed ? 'tombstone' : ''}"><span class="mono small">${id}</span> ${escapeHtml(rec.title)} <span class="muted small">· ${escapeHtml(rec.retention)}</span>${b.blocked?.includes(id) ? ' ' + badge('Skipped: now blocked', 'Legal hold') : ''}</li>`;
      }).join('')}</ul>
      <ol class="sign-steps">${b.steps.map((s) => `<li class="${s.signedAt ? 'signed' : ''}">${s.signedAt ? '✓' : '○'} ${escapeHtml(s.role)}: ${escapeHtml(s.name)}${s.signedAt ? ` <span class="muted small">signed ${fmtDateTime(s.signedAt)}</span>` : ''}</li>`).join('')}</ol>
      ${manage && next ? `<button class="secondary-btn" type="button" data-sign-batch="${b.id}">Simulate e-signature: ${escapeHtml(next.name)}</button>` : ''}
      ${manage && b.status === 'Approved' ? `<button class="danger-btn" type="button" data-execute-batch="${b.id}">Execute destruction</button>` : ''}
      ${b.status === 'Destroyed' ? `<p class="small muted">Destroyed ${fmtDateTime(b.executedAt)}. This log is retained permanently as the certificate of destruction.</p>` : ''}
    </div>`;
  }).join('') || '<p class="empty-state">No destruction logs yet. Select eligible records above to start one.</p>';

  $('holdList').innerHTML = holds.filter((h) => h.active).map((h) => `
    <li>
      <div class="batch-head"><strong class="mono">${h.id}</strong>${manage ? `<button class="mini-btn" type="button" data-release-hold="${h.id}">Release hold</button>` : ''}</div>
      <div>${escapeHtml(h.matter)}</div>
      <div class="small muted">Placed by ${escapeHtml(h.placedBy)} · ${fmtDate(h.date)} · ${h.recordIds.map((id) => canView(getRecord(id)) ? id : 'restricted record').join(', ')}</div>
    </li>`).join('') || '<li class="empty-state">No active legal holds.</li>';

  $('holdForm').classList.toggle('hidden', !manage);
  const holdable = live.filter((r) => !isHeld(r) && disposition(r).code !== 'permanent');
  const current = $('holdRecord').value;
  $('holdRecord').innerHTML = holdable.map((r) => `<option value="${r.id}" ${r.id === current ? 'selected' : ''}>${r.id} · ${escapeHtml(r.title)}</option>`).join('');
}

function placeHold(recordId, matter) {
  const hold = { id: `LH-2026-${String(nextHoldNum++).padStart(2, '0')}`, matter, recordIds: [recordId], placedBy: role().user, date: new Date(), active: true };
  holds.unshift(hold);
  logAudit({ actor: 'Human', action: 'Placed legal hold', recordId, detail: `${hold.id}: ${matter}` });
  return hold;
}

function render() {
  const eligibleNow = records.filter((r) => canView(r) && !r.destroyed && disposition(r).code === 'eligible').length;
  $('navEligibleCount').textContent = eligibleNow || '';
  renderRequests();
  if (ui.view === 'request') renderRequestWorkspace();
  if (ui.view === 'records') renderRecords();
  if (ui.view === 'audit') renderAudit();
  if (ui.view === 'retention') renderRetention();
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

document.querySelectorAll('.nav-item').forEach((b) => b.addEventListener('click', () => go(b.dataset.view)));
$('resetDemoBtn').addEventListener('click', () => { location.hash = '#/requests'; location.reload(); });
$('backToQueue').addEventListener('click', () => go('requests'));

$('requestTableBody').addEventListener('click', (e) => {
  const row = e.target.closest('[data-request-id]');
  if (row) go('request', row.dataset.requestId);
});
$('requestTableBody').addEventListener('keydown', (e) => {
  const row = e.target.closest('[data-request-id]');
  if (row && e.key === 'Enter') go('request', row.dataset.requestId);
});

$('wsRecordList').addEventListener('click', (e) => {
  const req = getRequest(ui.requestId);
  const remove = e.target.closest('[data-remove-record]');
  if (remove) {
    const id = remove.dataset.removeRecord;
    req.recordIds = req.recordIds.filter((r) => r !== id);
    redactions = redactions.filter((r) => !(r.requestId === req.id && r.recordId === id));
    req.scanned = (req.scanned ?? []).filter((r) => r !== id);
    logAudit({ actor: 'Human', action: 'Removed record', requestId: req.id, recordId: id, detail: 'Marked not responsive' });
    if (ui.recordId === id) ui.recordId = req.recordIds[0] ?? null;
    render();
    return;
  }
  const item = e.target.closest('[data-record-id]');
  if (item) { ui.recordId = item.dataset.recordId; ui.docMode = ['Released', 'Delivered'].includes(req.status) ? 'released' : 'review'; render(); }
});

$('addRecordSearch').addEventListener('input', () => renderAddResults(getRequest(ui.requestId)));
$('addRecordResults').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-add-record]');
  if (!btn) return;
  const req = getRequest(ui.requestId);
  const id = btn.dataset.addRecord;
  req.recordIds.push(id);
  logAudit({ actor: 'Human', action: 'Added record', requestId: req.id, recordId: id, detail: 'Marked responsive' });
  const n = scanRecord(req, id);
  ui.recordId = id;
  $('addRecordSearch').value = '';
  render();
  showToast(`Added ${id}. AI suggested ${n} redaction${n === 1 ? '' : 's'}.`);
});

$('docToggle').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-mode]');
  if (btn && !btn.disabled) { ui.docMode = btn.dataset.mode; render(); }
});

// Click a highlight in the document to jump to its card
$('docBody').addEventListener('click', (e) => {
  const mark = e.target.closest('mark[data-red-id]');
  if (!mark) return;
  const card = document.querySelector(`.sugg[data-red-id="${mark.dataset.redId}"]`);
  if (card) { card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); card.classList.add('pulse'); setTimeout(() => card.classList.remove('pulse'), 1200); }
});

$('suggList').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const r = redactions.find((x) => x.id === Number(btn.dataset.id));
  if (!canReview(getRecord(r.recordId))) return;
  setStatus(r, btn.dataset.act);
  render();
});

$('suggList').addEventListener('change', (e) => {
  const sel = e.target.closest('select[data-rcw-for]');
  if (!sel) return;
  const r = redactions.find((x) => x.id === Number(sel.dataset.rcwFor));
  if (!canReview(getRecord(r.recordId))) return;
  logAudit({ actor: 'Human', action: 'Changed exemption', requestId: r.requestId, recordId: r.recordId, detail: `${r.type} "${r.text}": RCW ${r.rcw} → RCW ${sel.value}` });
  r.rcw = sel.value;
  render();
});

$('acceptHighBtn').addEventListener('click', () => {
  if (!canReview(getRecord(ui.recordId))) return;
  const targets = redactionsFor(ui.requestId, ui.recordId).filter((r) => r.status === 'pending' && r.conf >= 0.9);
  targets.forEach((r) => setStatus(r, 'accepted'));
  render();
  showToast(`Accepted ${targets.length} high-confidence suggestions. Lower-confidence items still need a decision.`);
});

$('manualRedactBtn').addEventListener('click', () => {
  const sel = window.getSelection();
  const text = sel.toString().trim();
  const p = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement).closest('#docBody p[data-line]');
  if (!text || !p) { showToast('Select some text in the document first.'); return; }
  const line = Number(p.dataset.line);
  const rec = getRecord(ui.recordId);
  if (!canReview(rec)) return;
  const source = rec.body[line];
  const existing = redactionsFor(ui.requestId, ui.recordId).filter((r) => r.line === line);
  let start = source.indexOf(text);
  while (start !== -1 && existing.some((r) => start < r.end && start + text.length > r.start)) start = source.indexOf(text, start + 1);
  if (start === -1) { showToast('Select text within a single line that is not already marked.'); return; }
  const r = { id: nextRedactionId++, requestId: ui.requestId, recordId: ui.recordId, line, start, end: start + text.length, text, type: 'Manual redaction', rcw: $('manualRcw').value, conf: 1, source: 'Human', status: 'accepted' };
  redactions.push(r);
  logAudit({ actor: 'Human', action: 'Added manual redaction', requestId: r.requestId, recordId: r.recordId, detail: `"${text}" · RCW ${r.rcw} (not flagged by AI)` });
  sel.removeAllRanges();
  render();
  showToast('Manual redaction added and logged as a possible AI miss.');
});

$('releaseBtn').addEventListener('click', () => {
  const req = getRequest(ui.requestId);
  if (pendingCount(req.id) > 0 || !role().manage) return;
  releaseRequest(req);
  ui.docMode = 'released';
  render();
  showToast(`${req.id} released. Redactions are permanent in the released copies; originals are preserved.`);
});

$('deliverBtn').addEventListener('click', () => {
  const req = getRequest(ui.requestId);
  if (req.status !== 'Released' || !role().manage) return;
  deliverRequest(req);
  render();
  showToast(`${req.id} delivered to the GovQA portal with its exemption log.`);
});

['recSearch', 'recDeptFilter', 'recTypeFilter'].forEach((id) => $(id).addEventListener(id === 'recSearch' ? 'input' : 'change', renderRecords));
$('recordTableBody').addEventListener('click', (e) => {
  const row = e.target.closest('[data-record-detail]');
  if (row) { ui.recordDetailId = row.dataset.recordDetail; renderRecords(); $('recordDetail').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
});
$('recordDetail').addEventListener('click', (e) => {
  if (e.target.closest('[data-close-detail]')) { ui.recordDetailId = null; renderRecords(); }
  const link = e.target.closest('[data-open-request]');
  if (link) { e.preventDefault(); go('request', link.dataset.openRequest); }
});
$('auditActorFilter').addEventListener('change', renderAudit);

// Retention & holds
$('retentionTableBody').addEventListener('change', (e) => {
  const box = e.target.closest('[data-select-record]');
  if (!box) return;
  if (box.checked) selectedForBatch.add(box.dataset.selectRecord); else selectedForBatch.delete(box.dataset.selectRecord);
  renderRetention();
});
$('selectAllEligible').addEventListener('change', (e) => {
  records.filter((r) => canView(r) && !r.destroyed && disposition(r).code === 'eligible')
    .forEach((r) => (e.target.checked ? selectedForBatch.add(r.id) : selectedForBatch.delete(r.id)));
  renderRetention();
});
$('retentionTableBody').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-quick-hold]');
  if (!btn || !role().manage) return;
  const hold = placeHold(btn.dataset.quickHold, 'Anticipated litigation: preserve pending review');
  render();
  showToast(`${hold.id} placed on ${btn.dataset.quickHold}. It can't be destroyed until the hold is released.`);
});
$('createBatchBtn').addEventListener('click', () => {
  if (!role().manage || !selectedForBatch.size) return;
  const batch = createBatch([...selectedForBatch]);
  selectedForBatch.clear();
  render();
  showToast(`${batch.id} created and routed to ${APPROVERS.map((a) => a.name).join(' → ')} for e-signature.`);
});
$('batchList').addEventListener('click', (e) => {
  if (!role().manage) return;
  const sign = e.target.closest('[data-sign-batch]');
  const exec = e.target.closest('[data-execute-batch]');
  if (sign) {
    const b = batches.find((x) => x.id === sign.dataset.signBatch);
    signBatch(b);
    render();
    showToast(b.status === 'Approved' ? `${b.id} fully approved. Ready to execute.` : `${b.id} signed. Routed to next approver.`);
  }
  if (exec) {
    const b = batches.find((x) => x.id === exec.dataset.executeBatch);
    const blocked = executeBatch(b);
    render();
    showToast(`${plural(b.recordIds.length - blocked.length, 'record')} destroyed under ${b.id}.${blocked.length ? ` ${blocked.length} skipped: newly blocked.` : ''} Certificate retained.`);
  }
});
$('holdList').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-release-hold]');
  if (!btn || !role().manage) return;
  const hold = holds.find((h) => h.id === btn.dataset.releaseHold);
  hold.active = false;
  logAudit({ actor: 'Human', action: 'Released legal hold', detail: `${hold.id}: ${hold.matter}. Covered records resume normal retention` });
  render();
  showToast(`${hold.id} released. Covered records resume normal retention.`);
});
$('placeHoldBtn').addEventListener('click', () => {
  if (!role().manage) return;
  const recordId = $('holdRecord').value;
  const matter = $('holdMatter').value.trim();
  if (!recordId || !matter) { showToast('Enter a matter and choose a record.'); return; }
  const hold = placeHold(recordId, matter);
  $('holdMatter').value = '';
  render();
  showToast(`${hold.id} placed on ${recordId}.`);
});

$('roleSelect').addEventListener('change', (e) => {
  roleKey = e.target.value;
  $('roleHint').textContent = role().hint;
  if (ui.recordDetailId && !canView(getRecord(ui.recordDetailId))) ui.recordDetailId = null;
  render();
  showToast(`Signed in as ${role().user} (${role().title}). Search, records and actions now follow this role.`);
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

[...new Set(records.map((r) => r.dept))].sort().forEach((d) => $('recDeptFilter').insertAdjacentHTML('beforeend', `<option>${escapeHtml(d)}</option>`));
[...new Set(records.map((r) => r.type))].sort().forEach((t) => $('recTypeFilter').insertAdjacentHTML('beforeend', `<option>${escapeHtml(t)}</option>`));
$('todayPill').textContent = TODAY.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
['recSearch', 'recDeptFilter', 'recTypeFilter', 'auditActorFilter', 'addRecordSearch', 'holdMatter'].forEach((id) => { $(id).value = ''; });
$('roleSelect').value = 'coordinator';
$('roleHint').textContent = role().hint;

const [, route, param] = location.hash.split('/');
if (route === 'request' && getRequest(param)) go('request', param);
else go(['requests', 'records', 'audit', 'retention'].includes(route) ? route : 'requests');
