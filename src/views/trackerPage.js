function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function summarizeInfoBody(body) {
  const text = String(body || '').trim();
  const firstSentence = text.match(/^.*?[.!?](?:\s|$)/);
  return firstSentence ? firstSentence[0].trim() : text;
}

const PHASES = ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4'];
const { getPublicAssetUrls } = require('../utils/assets');

function getReviewStatus(record) {
  if (record.rawStatus === 'Passed') {
    return { label: 'PASSED', tone: 'success' };
  }

  if (record.rawStatus === 'Failed') {
    return { label: 'FAILED', tone: 'danger' };
  }

  if (record.rawStatus === 'On Hold') {
    return { label: 'ON HOLD', tone: 'hold' };
  }

  return { label: 'IN PROGRESS', tone: 'progress' };
}

function renderIcon(type) {
  const icons = {
    passed:
      '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.8 13.6 4.7 10.5l-1.4 1.4 4.5 4.5L16.7 7.5l-1.4-1.4Z"/></svg>',
    failed:
      '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.4 5 5 6.4 8.6 10 5 13.6 6.4 15l3.6-3.6 3.6 3.6 1.4-1.4-3.6-3.6L15 6.4 13.6 5 10 8.6Z"/></svg>',
    pending:
      '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4a1 1 0 0 1 1 1v4.4l3.2 1.8-.9 1.6L9.5 10.6A1 1 0 0 1 9 9.7V5a1 1 0 0 1 1-1Zm0 14a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm0-2a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z"/></svg>',
    hold:
      '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4h2.5v12H6zm5.5 0H14v12h-2.5z"/></svg>',
  };

  return icons[type] || '';
}

function detectPhaseNumber(text) {
  const haystack = String(text || '').toLowerCase();

  if (
    /\b(p1|phase 1|profile screening|profile check|pending)\b/.test(haystack)
  ) {
    return 1;
  }

  if (
    /\b(p2|phase 2|application reading|application)\b/.test(haystack)
  ) {
    return 2;
  }

  if (
    /\b(p3|phase 3|background check|background)\b/.test(haystack)
  ) {
    return 3;
  }

  if (
    /\b(p4|phase 4|administrative review|administrative)\b/.test(haystack)
  ) {
    return 4;
  }

  return null;
}

function buildProgressItems(record) {
  const items = [];
  const previousPhase = detectPhaseNumber(record.previousListName);
  const detectedFailedPhase =
    detectPhaseNumber(record.comments) || previousPhase || 1;

  const pushPassedThrough = (phaseNumber) => {
    for (let index = 1; index <= phaseNumber; index += 1) {
      items.push({
        tone: 'passed',
        icon: 'passed',
        label: PHASES[index - 1],
      });
    }
  };

  switch (record.rawStatus) {
    case 'Pending':
      items.push({ tone: 'pending', icon: 'pending', label: 'Phase 1' });
      break;
    case 'Phase 1 - Profile Screening':
      items.push({ tone: 'pending', icon: 'pending', label: 'Phase 1' });
      break;
    case 'Phase 2 - Application Reading':
      pushPassedThrough(1);
      items.push({ tone: 'pending', icon: 'pending', label: 'Phase 2' });
      break;
    case 'Phase 3 - Background Check':
      pushPassedThrough(2);
      items.push({ tone: 'pending', icon: 'pending', label: 'Phase 3' });
      break;
    case 'Phase 4 - Administration Review':
      pushPassedThrough(3);
      items.push({ tone: 'pending', icon: 'pending', label: 'Phase 4' });
      break;
    case 'Passed':
      pushPassedThrough(4);
      break;
    case 'Failed':
      pushPassedThrough(Math.max(0, detectedFailedPhase - 1));
      items.push({
        tone: 'failed',
        icon: 'failed',
        label: PHASES[detectedFailedPhase - 1] || 'Phase 1',
      });
      break;
    case 'On Hold': {
      const holdPhase = previousPhase || 1;
      pushPassedThrough(Math.max(0, holdPhase - 1));
      items.push({
        tone: 'hold',
        icon: 'hold',
        label: PHASES[holdPhase - 1] || 'Phase 1',
      });
      break;
    }
    default:
      items.push({ tone: 'pending', icon: 'pending', label: record.status });
      break;
  }

  return items;
}

function renderProgress(record) {
  const items = buildProgressItems(record);

  return `
    <div class="progressColumn">
      <div class="progressTrail">
        ${items
          .map(
            (item) => `
          <span class="progressBubble progressBubble--${item.tone}">
            <span class="progressBubble__icon">${renderIcon(item.icon)}</span>
            <span class="progressBubble__label">${escapeHtml(item.label)}</span>
          </span>
        `
          )
          .join('')}
      </div>
    </div>
  `;
}

function renderApplicantName(name) {
  const [left, right] = String(name || '').split(/:(.+)/);
  if (!right) {
    return `<div class="primary-name">${escapeHtml(name)}</div>`;
  }

  return `
    <div class="primary-name">
      <span class="primary-name__line">${escapeHtml(left)}:</span>
      <span class="primary-name__line">${escapeHtml(right)}</span>
    </div>
  `;
}

function renderComment(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);
  return text.trim() ? escapeHtml(text) : '';
}

function renderRows(records, archived) {
  if (!records.length) {
    return `
      <tr>
        <td colspan="${archived ? 7 : 6}" class="empty-row">
          No ${archived ? 'archived' : 'active'} applications yet.
        </td>
      </tr>
    `;
  }

  return records
    .map(
      (record) => {
        const reviewStatus = getReviewStatus(record);
        return `
        <tr data-search="${escapeHtml(
          `${record.name || ''}`
            .toLowerCase()
            .trim()
        )}" data-class="${escapeHtml(
          String(record.classNumber || record.classLabel || '').toLowerCase().trim()
        )}" data-status="${escapeHtml(String(reviewStatus.label || '').toLowerCase())}">
          <td class="primary-cell">
            ${renderApplicantName(record.name)}
          </td>
          <td class="status-cell">
            <span class="reviewStatus reviewStatus--${escapeHtml(
              reviewStatus.tone
            )}">${escapeHtml(reviewStatus.label)}</span>
          </td>
          <td class="progress-cell">${renderProgress(record)}</td>
          <td class="class-cell">${escapeHtml(record.classLabel || '—')}</td>
          <td class="comments-cell">${renderComment(record.comments)}</td>
          ${
            archived
              ? `<td>${escapeHtml(formatDate(record.archivedAt))}</td>`
              : ''
          }
        </tr>
      `;
      }
    )
    .join('');
}

function renderTrackerPage({
  title,
  heading,
  subtitle,
  pageUrl,
  imageUrl,
  currentClass,
  infoSections,
  records,
  archived,
}) {
  const assets = getPublicAssetUrls();
  const activeStatusMap = archived
    ? null
    : currentClass.statusCounts.reduce((accumulator, item) => {
        accumulator[item.status] = item.count;
        return accumulator;
      }, {});

  const archivedClasses = archived
    ? Array.from(
        new Set(
          records
            .map((record) => ({
              classLabel: String(record.classLabel || '').trim(),
              classNumber: String(record.classNumber || '').trim(),
            }))
            .filter((item) => item.classLabel || item.classNumber)
            .map((item) => `${item.classNumber}|||${item.classLabel}`)
        )
      )
        .map((item) => {
          const [classNumber, classLabel] = item.split('|||');
          return { classNumber, classLabel };
        })
        .sort((left, right) => Number(right.classNumber || 0) - Number(left.classNumber || 0))
    : [];

  const archivedStats = archived
    ? {
        applications: records.length,
        failed: records.filter((record) => record.rawStatus === 'Failed').length,
        passed: records.filter((record) => record.rawStatus === 'Passed').length,
      }
    : null;

  const topStatuses = archived
    ? ''
    : `
        <article class="commandMetric commandMetric--primary">
          <span class="commandMetric__label">Applications</span>
          <strong class="commandMetric__value">${escapeHtml(records.length)}</strong>
        </article>
        <article class="commandMetric commandMetric--failed">
          <span class="commandMetric__label">Failed</span>
          <strong class="commandMetric__value">${escapeHtml(activeStatusMap.Failed || 0)}</strong>
        </article>
        <article class="commandMetric commandMetric--hold">
          <span class="commandMetric__label">On Hold</span>
          <strong class="commandMetric__value">${escapeHtml(activeStatusMap['On Hold'] || 0)}</strong>
        </article>
        <article class="commandMetric commandMetric--passed">
          <span class="commandMetric__label">Passed</span>
          <strong class="commandMetric__value">${escapeHtml(activeStatusMap.Passed || 0)}</strong>
        </article>
      `;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(subtitle)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(subtitle)}" />
    <meta property="og:url" content="${escapeHtml(pageUrl)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:alt" content="POST Enrollment Tracker logo" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(subtitle)}" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet" />
    <link rel="icon" href="${escapeHtml(assets.faviconHref)}" type="image/svg+xml" />
    <link rel="shortcut icon" href="${escapeHtml(assets.faviconHref)}" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="${escapeHtml(assets.logoPngHref)}" />
    <link rel="stylesheet" href="${escapeHtml(assets.trackerCssHref)}" />
    <script defer src="${escapeHtml(assets.trackerJsSrc)}"></script>
  </head>
  <body data-live-refresh-ms="60000">
    <section class="mobileNotice" aria-labelledby="mobile-notice-title">
      <div class="mobileNotice__card">
        <span class="mobileNotice__logo">
          <img src="${escapeHtml(assets.logoPngHref)}" alt="POST logo" />
        </span>
        <p class="mobileNotice__kicker">Firestone POST Enrollment Tracker</p>
        <h1 class="mobileNotice__title" id="mobile-notice-title">
          This tracker is not available on mobile devices
        </h1>
        <p class="mobileNotice__text">
          The enrollment tracker is designed for desktop and larger tablet resolutions so application progress, comments, and stage data remain readable.
        </p>
        <p class="mobileNotice__text">
          Please reopen this page on a desktop or expand your browser window to continue.
        </p>
      </div>
    </section>
    <div class="shell">
      <header class="topbar">
        <a href="/" class="brandLink">
          <span class="brandLogo">
            <img src="${escapeHtml(assets.logoPngHref)}" alt="POST logo" />
          </span>
          <span class="brandCopy">
            <span class="brandKicker">Firestone POST</span>
            <span class="brandText">Enrollment Tracker</span>
            <span class="brandSubtext">Peace Officer Standards and Training class applications</span>
          </span>
        </a>
        <nav class="nav">
          <a href="/" class="${archived ? '' : 'navLink--active'}">Home</a>
          <a href="/archived" class="${archived ? 'navLink--active' : ''}">Archived</a>
          <span class="navDivider"></span>
          <span class="navMeta">${escapeHtml(currentClass.currentClass)}</span>
        </nav>
      </header>

      <main class="card">
        <div class="trackerPage">
          <section class="commandBanner ${archived ? 'commandBanner--archive' : ''}">
            <div class="commandBanner__body">
              <div class="commandBanner__copy">
                <span class="masthead__kicker">Firestone Peace Officer Standards and Training</span>
                <h1 class="masthead__title">
                  ${
                    archived
                      ? 'Enrollment Archive'
                      : 'Enrollment Tracker for '
                  }${archived ? '' : `<strong>${escapeHtml(heading)}</strong>`}
                </h1>
                <p class="masthead__subtitle">
                  ${
                    archived
                      ? 'Historical application records retained after leaving the active Firestone POST enrollment workflow. Filter by class below to review archived outcomes.'
                      : 'A live enrollment tracker for Firestone POST applicants, tracking stage progression, review outcomes, and board activity mirrored from Trello into PostgreSQL.'
                  }
                </p>
              </div>
            </div>

            <div class="commandMetrics ${archived ? 'commandMetrics--hidden' : ''}">
              ${topStatuses}
            </div>
          </section>
          ${
            !archived && infoSections && infoSections.length
              ? `
          <section class="infoCard">
            <div class="sectionHeader">
              <div>
                <h2 class="sectionHeader__title">Assessment Stages</h2>
                <p class="sectionHeader__subtitle">Each enrollment phase follows the Firestone POST screening and review standard.</p>
              </div>
              <span class="sectionHeader__meta">Hover for full guidance</span>
            </div>
            <div class="infoGrid">
              ${infoSections
                .map(
                  (section) => `
                <article
                  class="infoPanel infoPanel--interactive"
                  data-info-tooltip="${escapeHtml(section.body)}"
                >
                  <div class="infoPanel__top">
                    <h3>${escapeHtml(section.title)}</h3>
                  </div>
                  <p>${escapeHtml(summarizeInfoBody(section.body))}</p>
                  <span class="infoPanel__hint">Open briefing</span>
                </article>
              `
                )
                .join('')}
            </div>
          </section>
          `
              : ''
          }

          <section class="tableCard">
            <div class="sectionHeader">
              <div>
                <h2 class="sectionHeader__title">${
                  archived ? 'Archived Enrollment Roster' : 'Active Enrollment Roster'
                }</h2>
                <p class="sectionHeader__subtitle">${
                  archived
                    ? 'Filter historical records by class and review final archived outcomes.'
                    : 'Synced from the live Trello board and mirrored into PostgreSQL for roster review.'
                }</p>
              </div>
              <div class="sectionHeader__meta">${
                archived ? 'Archive Review' : escapeHtml(currentClass.totalApplications) + ' active tracked'
              }</div>
            </div>

            ${
              archived
                ? `
            <div class="tableToolbar tableToolbar--archive">
              <div class="archiveControls">
                <label class="archiveFilter" for="archive-class-filter">
                  <span class="archiveFilter__label">Class Filter</span>
                  <select
                    id="archive-class-filter"
                    class="archiveFilter__select"
                    data-archive-class-filter
                    data-target-table="archived-applications-table"
                  >
                    <option value="">All classes</option>
                    ${archivedClasses
                      .map(
                        (item) => `
                      <option value="${escapeHtml(
                        String(item.classNumber || item.classLabel).toLowerCase()
                      )}">${escapeHtml(item.classLabel || `Class ${item.classNumber}`)}</option>
                    `
                      )
                      .join('')}
                  </select>
                </label>
                <div class="archiveRecordsPill">
                  <span data-archive-visible-count>${escapeHtml(records.length)}</span> records shown
                </div>
              </div>
              <div class="archiveStats archiveStats--compact">
                <article class="archiveStatCard archiveStatCard--applications">
                  <span class="archiveStatCard__label">Applications</span>
                  <strong class="archiveStatCard__value" data-archive-stat="applications">${escapeHtml(
                    archivedStats.applications
                  )}</strong>
                </article>
                <article class="archiveStatCard archiveStatCard--failed">
                  <span class="archiveStatCard__label">Failed</span>
                  <strong class="archiveStatCard__value" data-archive-stat="failed">${escapeHtml(
                    archivedStats.failed
                  )}</strong>
                </article>
                <article class="archiveStatCard archiveStatCard--passed">
                  <span class="archiveStatCard__label">Passed</span>
                  <strong class="archiveStatCard__value" data-archive-stat="passed">${escapeHtml(
                    archivedStats.passed
                  )}</strong>
                </article>
              </div>
            </div>
            `
                : `
            <div class="tableToolbar">
              <label class="searchBar" for="application-search">
                <span class="searchBar__icon" aria-hidden="true">⌕</span>
                <input
                  id="application-search"
                  class="searchBar__input"
                  type="search"
                  placeholder="Search by Roblox username or Roblox ID"
                  data-application-search
                  data-target-table="active-applications-table"
                />
              </label>
              <p class="tableToolbar__hint">Filter by the Application column only.</p>
            </div>
            `
            }

            <div class="tableWrap">
              <table ${
                archived ? 'id="archived-applications-table"' : 'id="active-applications-table"'
              }>
                <colgroup>
                  <col class="col-application" />
                  <col class="col-status" />
                  <col class="col-progress" />
                  <col class="col-class" />
                  <col class="col-comments" />
                  ${archived ? '<col class="col-archived" />' : ''}
                </colgroup>
                <thead>
                  <tr>
                    <th>Application</th>
                    <th class="status-heading">Status</th>
                    <th>Progress</th>
                    <th>Class</th>
                    <th>Comments</th>
                    ${archived ? '<th>Archived</th>' : ''}
                  </tr>
                </thead>
                <tbody>
                  ${renderRows(records, archived)}
                </tbody>
              </table>
              ${
                archived
                  ? archivedStats.applications
                    ? '<div class="tableEmptyState" data-archive-empty hidden>No archived applications match this class.</div>'
                    : ''
                  : '<div class="tableEmptyState" data-search-empty hidden>No matching applications found.</div>'
              }
            </div>
          </section>
        </div>
      </main>
    </div>
    <div class="infoTooltip" data-info-tooltip-layer hidden></div>
  </body>
</html>`;
}

module.exports = { renderTrackerPage, escapeHtml, formatDate };
