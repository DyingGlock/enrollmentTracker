const SITE_META_DESCRIPTION =
  'An online tracker to view and track applications to the Firestone Peace Officer Standards and Training Academy.';

const ACTIVE_LIST_NAMES = [
  'Pending',
  'Phase 1 - Profile Screening',
  'Phase 2 - Application Reading',
  'Phase 3 - Background Check',
  'Phase 4 - Administration Review',
  'Passed',
  'On Hold',
];

const IGNORED_LIST_NAMES = [
  'Questions',
  'Old Questions',
  'Blacklist',
  'Settings',
  'Information',
];

const TRACKED_APPLICANT_LIST_NAMES = [...ACTIVE_LIST_NAMES, 'Failed'];

const STATUS_LABELS = {
  Pending: 'Pending',
  'Phase 1 - Profile Screening': 'Phase 1',
  'Phase 2 - Application Reading': 'Phase 2',
  'Phase 3 - Background Check': 'Phase 3',
  'Phase 4 - Administration Review': 'Phase 4',
  Passed: 'Passed',
  Failed: 'Failed',
  'On Hold': 'On Hold',
};

const INFO_SECTIONS = [
  {
    title: 'Phase 1',
    body:
      'Phase 1 consists of a general profile check.\nIf you failed this phase, due to confidentiality, the reason will not be disclosed. This is to protect our screening process and prevent alternate accounts from getting in.\nIf you fail this stage, do not reapply.',
  },
  {
    title: 'Phase 2',
    body:
      "Phase 2 consists of the application's reading.\nApplicants fail this stage due to the quality (or lack thereof) of someone's application.\nCommon reasons include poor grammar/spelling, lack of detail/effort, and lack of knowledge (some questions are knowledge-based).\nReasons for failing this stage will be disclosed to encourage improvement upon reapplying.\nIf you fail this stage, take into consideration the feedback and reapply.",
  },
  {
    title: 'Phase 3',
    body:
      'Phase 3 consists of a background check.\nEven though you may think you have an impeccable background, that might not be the case.\nReasons for failing the background check will not be disclosed.\nIf you fail this phase, do not reapply.',
  },
  {
    title: 'Phase 4',
    body:
      'Phase 4 consists of an administrative review.\nInformation discovered in the application screening process will be reviewed by the POST Administration and select individuals to determine whether or not the applicant possesses the necessary qualities required to be a POST Cadet.\nIf you failed this phase, do not reapply.',
  },
];

function normalizeStatusLabel(status) {
  return STATUS_LABELS[status] || status || 'Unknown';
}

function looksLikeApplicantCardName(name) {
  return /^[^:]+:\d+$/.test(String(name || '').trim());
}

function isIgnoredList(listName) {
  return IGNORED_LIST_NAMES.includes(String(listName || '').trim());
}

function isTrackedApplicantList(listName) {
  return TRACKED_APPLICANT_LIST_NAMES.includes(String(listName || '').trim());
}

function getTrackerConfig() {
  return {
    activeListNames: ACTIVE_LIST_NAMES,
    ignoredListNames: IGNORED_LIST_NAMES,
    trackedApplicantListNames: TRACKED_APPLICANT_LIST_NAMES,
    infoSections: INFO_SECTIONS,
  };
}

module.exports = {
  SITE_META_DESCRIPTION,
  ACTIVE_LIST_NAMES,
  IGNORED_LIST_NAMES,
  TRACKED_APPLICANT_LIST_NAMES,
  STATUS_LABELS,
  INFO_SECTIONS,
  isIgnoredList,
  isTrackedApplicantList,
  looksLikeApplicantCardName,
  normalizeStatusLabel,
  getTrackerConfig,
};
