const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isTrackedActiveList,
  isApplicationCard,
  isEnrollmentApplicationCard,
} = require('../src/services/sync');

const config = {
  TRELLO_CLASS_CARD_ID: '668c60d1fefc661ba4da67fe',
};

const applicationCard = {
  id: '5f8d7c1a2b3c4d5e6f7a8b9c',
  name: 'Jane Applicant:12345',
};

test('Failed list applications are not tracked as active', () => {
  assert.equal(isTrackedActiveList('Failed'), false);
  assert.equal(
    isEnrollmentApplicationCard(applicationCard, 'Failed', config),
    false
  );
});

test('Passed list applications remain tracked as active', () => {
  assert.equal(isTrackedActiveList('Passed'), true);
  assert.equal(
    isEnrollmentApplicationCard(applicationCard, 'Passed', config),
    true
  );
});

test('board utility lists are excluded from application tracking', () => {
  const utilityLists = [
    'Questions',
    'Old Questions',
    'Blacklist',
    'Settings',
    'Information',
  ];

  for (const listName of utilityLists) {
    assert.equal(
      isApplicationCard(applicationCard, config, listName),
      false,
      `expected ${listName} to be ignored`
    );
    assert.equal(
      isEnrollmentApplicationCard(applicationCard, listName, config),
      false,
      `expected ${listName} to be ignored`
    );
  }
});

test('question and template cards are excluded from application tracking', () => {
  assert.equal(
    isApplicationCard(
      { id: '5f8d7c1a2b3c4d5e6f7a8b9e', name: 'Why are you applying to POST?' },
      config,
      'Questions'
    ),
    false
  );
  assert.equal(
    isApplicationCard(
      { id: '5f8d7c1a2b3c4d5e6f7a8b9f', name: '[USERNAME]:[USERID]' },
      config,
      'Information'
    ),
    false
  );
  assert.equal(
    isApplicationCard(applicationCard, config, 'Failed'),
    true
  );
});

test('class and board title cards are excluded from application tracking', () => {
  assert.equal(
    isApplicationCard(
      { id: config.TRELLO_CLASS_CARD_ID, name: 'Enrollment Exam for POST Class 12' },
      config
    ),
    false
  );
  assert.equal(
    isApplicationCard(
      { id: '5f8d7c1a2b3c4d5e6f7a8b9d', name: 'Enrollment Exam for POST Class 12' },
      config
    ),
    false
  );
});
