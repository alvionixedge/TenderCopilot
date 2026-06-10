/**
 * Tender ingestion source (spec 2.3, 6.1).
 *
 * Production wires real portal adapters (GeM, CPPP, state portals, PSUs)
 * behind the same shape. The MVP ships a representative curated dataset so
 * the matching, scoring and proposal pipeline is fully exercisable on day
 * one. Ingestion is idempotent: upsert ON CONFLICT (source_url).
 */

export interface IncomingTender {
  source: "GeM" | "CPPP" | "StatePortal" | "PSU";
  sourceUrl: string;
  title: string;
  department: string;
  estimatedValue: number;
  emd: number;
  daysToDeadline: number;
  requirements: { requirement: string; mandatory: boolean; category: string }[];
}

export const SAMPLE_TENDERS: IncomingTender[] = [
  {
    source: "GeM",
    sourceUrl: "https://gem.gov.in/tenders/GEM-2026-B-100001",
    title: "Supply and Installation of Desktop Computers and Peripherals for District Offices",
    department: "Department of Electronics & IT, Govt. of Maharashtra",
    estimatedValue: 18500000,
    emd: 185000,
    daysToDeadline: 21,
    requirements: [
      { requirement: "OEM authorization certificate for quoted hardware", mandatory: true, category: "Technical" },
      { requirement: "Average annual turnover of INR 55 lakh in last 3 FY", mandatory: true, category: "Financial" },
      { requirement: "GST registration certificate", mandatory: true, category: "Legal" },
      { requirement: "ISO 9001:2015 certification", mandatory: false, category: "Compliance" },
      { requirement: "Onsite warranty support for 3 years across district locations", mandatory: true, category: "Technical" },
    ],
  },
  {
    source: "CPPP",
    sourceUrl: "https://eprocure.gov.in/cppp/tenders/2026_DoT_754321",
    title: "Annual Maintenance Contract for Networking Equipment and CCTV Systems",
    department: "Department of Telecommunications",
    estimatedValue: 9200000,
    emd: 92000,
    daysToDeadline: 14,
    requirements: [
      { requirement: "Minimum 3 similar AMC contracts completed in last 5 years", mandatory: true, category: "Technical" },
      { requirement: "CCNA/CCNP certified engineers on rolls (min 4)", mandatory: true, category: "Technical" },
      { requirement: "GST and PAN registration", mandatory: true, category: "Legal" },
      { requirement: "EMD exemption available for MSME registered bidders", mandatory: false, category: "Financial" },
    ],
  },
  {
    source: "GeM",
    sourceUrl: "https://gem.gov.in/tenders/GEM-2026-B-100417",
    title: "Development and Maintenance of Citizen Services Web Portal with Mobile Application",
    department: "National Informatics Centre",
    estimatedValue: 32000000,
    emd: 320000,
    daysToDeadline: 30,
    requirements: [
      { requirement: "CMMI Level 3 or above appraisal", mandatory: true, category: "Compliance" },
      { requirement: "Minimum 50 software engineers on payroll", mandatory: true, category: "Technical" },
      { requirement: "Experience in 2 government web-portal projects of INR 1 crore+", mandatory: true, category: "Technical" },
      { requirement: "ISO 27001 information security certification", mandatory: true, category: "Compliance" },
      { requirement: "Local presence or willingness to open Delhi NCR office", mandatory: false, category: "Legal" },
    ],
  },
  {
    source: "StatePortal",
    sourceUrl: "https://tenders.karnataka.gov.in/2026/KPWD-65432",
    title: "Supply of Office Furniture and Modular Workstations for New Secretariat Building",
    department: "Karnataka Public Works Department",
    estimatedValue: 7600000,
    emd: 76000,
    daysToDeadline: 18,
    requirements: [
      { requirement: "BIFMA or equivalent quality certification for furniture", mandatory: true, category: "Technical" },
      { requirement: "Average annual turnover of INR 25 lakh", mandatory: true, category: "Financial" },
      { requirement: "Delivery and installation within 60 days", mandatory: true, category: "Technical" },
    ],
  },
  {
    source: "PSU",
    sourceUrl: "https://etenders.bhel.in/2026/BHEL-SCT-88991",
    title: "Hiring of Skilled Manpower for Plant Operations Support (2-Year Contract)",
    department: "Bharat Heavy Electricals Limited",
    estimatedValue: 14800000,
    emd: 148000,
    daysToDeadline: 25,
    requirements: [
      { requirement: "Valid labour license and EPF/ESI registration", mandatory: true, category: "Legal" },
      { requirement: "Experience of manpower supply to PSU/Govt for 3+ years", mandatory: true, category: "Technical" },
      { requirement: "Average annual turnover of INR 45 lakh", mandatory: true, category: "Financial" },
    ],
  },
  {
    source: "CPPP",
    sourceUrl: "https://eprocure.gov.in/cppp/tenders/2026_MoHFW_991234",
    title: "Procurement of Medical Consumables and Surgical Supplies for District Hospitals",
    department: "Ministry of Health & Family Welfare",
    estimatedValue: 26500000,
    emd: 265000,
    daysToDeadline: 12,
    requirements: [
      { requirement: "Valid drug license for listed consumable categories", mandatory: true, category: "Legal" },
      { requirement: "WHO-GMP certified manufacturing or authorized distributorship", mandatory: true, category: "Compliance" },
      { requirement: "Cold-chain logistics capability where applicable", mandatory: false, category: "Technical" },
    ],
  },
  {
    source: "GeM",
    sourceUrl: "https://gem.gov.in/tenders/GEM-2026-B-100892",
    title: "Cloud Migration and DevOps Managed Services for State Data Centre Workloads",
    department: "Centre for e-Governance, Govt. of Karnataka",
    estimatedValue: 41000000,
    emd: 410000,
    daysToDeadline: 35,
    requirements: [
      { requirement: "MeitY-empanelled CSP partnership (AWS/Azure/GCP)", mandatory: true, category: "Compliance" },
      { requirement: "Minimum 5 cloud migration projects of INR 50 lakh+", mandatory: true, category: "Technical" },
      { requirement: "ISO 27001 and ISO 20000 certifications", mandatory: true, category: "Compliance" },
      { requirement: "24x7 NOC with defined SLAs", mandatory: true, category: "Technical" },
    ],
  },
  {
    source: "StatePortal",
    sourceUrl: "https://mahatenders.gov.in/2026/ZP-PUNE-44781",
    title: "Construction of Anganwadi Centres in Rural Blocks (Package 3)",
    department: "Zilla Parishad Pune",
    estimatedValue: 12300000,
    emd: 123000,
    daysToDeadline: 28,
    requirements: [
      { requirement: "Class IV-A or above contractor registration", mandatory: true, category: "Legal" },
      { requirement: "Completed 2 similar civil works of INR 40 lakh+ in 5 years", mandatory: true, category: "Technical" },
      { requirement: "Solvency certificate of INR 30 lakh", mandatory: true, category: "Financial" },
    ],
  },
  {
    source: "PSU",
    sourceUrl: "https://tenders.ntpc.co.in/2026/NTPC-IT-55320",
    title: "Supply, Implementation and Support of HRMS Software for Corporate Offices",
    department: "NTPC Limited",
    estimatedValue: 19700000,
    emd: 197000,
    daysToDeadline: 40,
    requirements: [
      { requirement: "HRMS implementations in 3 organizations of 1000+ employees", mandatory: true, category: "Technical" },
      { requirement: "Average annual turnover of INR 60 lakh in last 3 FY", mandatory: true, category: "Financial" },
      { requirement: "Data residency within India", mandatory: true, category: "Compliance" },
    ],
  },
  {
    source: "GeM",
    sourceUrl: "https://gem.gov.in/tenders/GEM-2026-B-101244",
    title: "Annual Rate Contract for Printing and Stationery Items",
    department: "Directorate of Printing, Govt. of India",
    estimatedValue: 5400000,
    emd: 54000,
    daysToDeadline: 16,
    requirements: [
      { requirement: "GST registration certificate", mandatory: true, category: "Legal" },
      { requirement: "In-house printing facility with offset capability", mandatory: true, category: "Technical" },
      { requirement: "MSME bidders eligible for EMD exemption", mandatory: false, category: "Financial" },
    ],
  },
];
