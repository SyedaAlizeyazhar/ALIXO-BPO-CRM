/* Static CRM configuration. Campaigns live here — they are never fetched from Sheets. */

export type Campaign = {
  name: string;
  type: string;
  did: string;
  states: string;
  timing: string;
  breakTime: string;
  ageLimit: string;
  dqNotes: string;
  formLink: string;
  target: number;
  status: "Active" | "Paused";
};

export const BRAND = { name: "ALIXO", suffix: "BPO", tagline: "Let's grow together" };

/* Hidden admin entrance (like the Elijah site). Not linked anywhere agents can see. */
export const ADMIN_PATH = "/admin-alixo-bpo-2026";
export const ADMIN_PORTAL = `${ADMIN_PATH}/portal`;

/* Colour themes. Each user picks one (saved in their browser); admin sets the default. */
export const PALETTES = [
  { id: "aurora", name: "Aurora", a: "#6366f1", b: "#22d3ee" },
  { id: "grape", name: "Grape", a: "#7c3aed", b: "#ec4899" },
  { id: "ocean", name: "Ocean", a: "#2563eb", b: "#06b6d4" },
  { id: "emerald", name: "Emerald", a: "#10b981", b: "#84cc16" },
  { id: "teal", name: "Teal", a: "#0d9488", b: "#14b8a6" },
  { id: "sunset", name: "Sunset", a: "#f97316", b: "#ec4899" },
  { id: "rose", name: "Rose Gold", a: "#e11d48", b: "#f59e0b" },
  { id: "graphite", name: "Graphite", a: "#334155", b: "#64748b" },
] as const;

export type PaletteId = (typeof PALETTES)[number]["id"];
export const DEFAULT_PALETTE: PaletteId = "aurora";
export const DEFAULT_MODE = "light" as const;

/* Seconds between automatic refreshes of live data. */
export const REFRESH_SECONDS = 20;

export const campaigns: Campaign[] = [
  {
    name: "MED CPA (BLIND TRANSFER) (JCK)",
    type: "Static",
    did: "5618726752",
    states: "Bad States: NY, WA, CA, DC, HI, AK",
    timing: "7:00 PM - 03:30 AM",
    breakTime: "10:00 PM - 11:00 PM",
    ageLimit: "50-85",
    dqNotes: "No VA, Tricare, Kizer, Retirement Plan",
    formLink: "",
    target: 1,
    status: "Active",
  },
  {
    name: "MED CPL BLIND TRANSFERS (ADO)",
    type: "Static",
    did: "8664349627",
    states: "Good States: AZ, FL, GA, IL, KS, KY, LA, MO, NC, OH, PA, SC, TN, TX, VA",
    timing: "07:00 PM - 03:00 AM",
    breakTime: "NO BREAK",
    ageLimit: "65-85",
    dqNotes: "",
    formLink: "https://silverbpo.callhub.ai/form.php",
    target: 30,
    status: "Active",
  },
  {
    name: "FE 180 (BLIND TRANSFER) (ADO)",
    type: "Static",
    did: "PING",
    states: "States: AL, AZ, CO, IL, IN, KS, KY, MI, MO, OH, PA, SC, TN, TX",
    timing: "06:30 PM - 03:00 AM",
    breakTime: "NO BREAK",
    ageLimit: "50-80",
    dqNotes: "",
    formLink: "https://silverbpo.callhub.ai/form3.php",
    target: 5,
    status: "Active",
  },
  {
    name: "FE 140 (WARM TRANSFER) (ELIJ)",
    type: "Static",
    did: "PING",
    states: "ALL STATES EXCEPT NYC",
    timing: "06:00 PM - 06:00 AM",
    breakTime: "NO BREAK",
    ageLimit: "50-80",
    dqNotes: "ORIGINAL NUMBER ONLY",
    formLink: "https://ringba-bid-asya.vercel.app/",
    target: 5,
    status: "Active",
  },
  {
    name: "180 FE SYED (WARM TRANSFER) (ATTA)",
    type: "Static",
    did: "8333840955",
    states: "TX OH PA NC SC GA TN IN MO FL",
    timing: "07:00 PM - 05:00 AM",
    breakTime: "NO BREAK",
    ageLimit: "50-80",
    dqNotes: "Original Number Only & Interested Customers",
    formLink: "",
    target: 10,
    status: "Active",
  },
  {
    name: "240 FE (BLIND TRANSFER) (ATTA)",
    type: "Static",
    did: "8556692411",
    states: "Bad States: AR, CO, IL, KY, MA, MI, MO, MT, NY, NV, TN, WV, WY",
    timing: "07:00 PM - 03:00 AM",
    breakTime: "NO BREAK",
    ageLimit: "50-79",
    dqNotes: "ORIGINAL NUMBER ONLY",
    formLink: "",
    target: 1,
    status: "Active",
  },
  {
    name: "220 FE (BLIND TRANSFER) (ATTA)",
    type: "Static",
    did: "8554713892",
    states:
      "States: AL, AR, AZ, CA, CO, FL, GA, IA, IL, IN, KS, KY, LA, MD, MI, MO, MS, NC, NJ, NM, NV, OH, OR, PA, SC, TN, TX, VA",
    timing: "06:00 PM - 04:00 AM",
    breakTime: "NO BREAK",
    ageLimit: "50-79",
    dqNotes: "ORIGINAL NUMBER ONLY",
    formLink: "https://www.leadlync.site/form/",
    target: 1,
    status: "Active",
  },
  {
    name: "SYED FE 180 (BLIND TRANSFER) (WEB)",
    type: "Static",
    did: "8445061716",
    states: "ALL STATES EXCEPT NYC",
    timing: "07:00 PM - 04:00 AM",
    breakTime: "12:00 AM - 01:00 AM",
    ageLimit: "50-79",
    dqNotes: "Original Number Only & Interested Customers",
    formLink: "",
    target: 25,
    status: "Paused",
  },
];

export const activeCampaigns = campaigns.filter((c) => c.status === "Active");

export const tools = [
  { name: "Inhouse Form", url: "https://docs.google.com/forms/d/1aI1zJBzCfVVHZsoN7J9y3IgXlD1jlm3M93QVZNzskGo/edit", note: "Internal intake form" },
  { name: "TCPA Tools", url: "https://tcpa.tools/", note: "Compliance lookup" },
  { name: "Pharmacy Form", url: "https://forms.gle/dwKd8qccigrdx7BN7", note: "Pharmacy verification" },
  { name: "Searching Website", url: "https://uspeoplesearch.net/", note: "People / number lookup" },
  {
    name: "Inbound Transfer Form",
    url: "https://docs.google.com/forms/u/0/d/e/1FAIpQLSd8A350LojvYD9qY78p1uydYB15lDscFtqiMABMLfsAxizG_Q/formResponse",
    note: "Inbound transfer logging",
  },
];

export const dialer = {
  domain: "https://silverbpo.callhub.ai/",
  ipLink: "https://silverbpo.callhub.ai:444",
  username: "Silver1 - Silver20",
  password: "Silver1 - Silver20",
  note: "Same ID and same password",
};
