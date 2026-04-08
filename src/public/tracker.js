function initializeApplicationSearch() {
  const input = document.querySelector('[data-application-search]');
  if (!input) return;

  const targetTableId = input.getAttribute('data-target-table');
  const table = targetTableId ? document.getElementById(targetTableId) : null;
  if (!table) return;

  const rows = Array.from(table.querySelectorAll('tbody tr[data-search]'));
  const emptyState = document.querySelector('[data-search-empty]');

  const applyFilter = () => {
    const query = String(input.value || '').trim().toLowerCase();
    let visibleCount = 0;

    rows.forEach((row) => {
      const haystack = String(row.getAttribute('data-search') || '');
      const matches = !query || haystack.includes(query);
      row.hidden = !matches;
      if (matches) visibleCount += 1;
    });

    if (emptyState) {
      emptyState.hidden = visibleCount !== 0;
    }
  };

  input.addEventListener('input', applyFilter);
  applyFilter();
}

function initializeArchiveFilter() {
  const table = document.getElementById('archived-applications-table');
  if (!table) return;

  const rows = Array.from(table.querySelectorAll('tbody tr'));
  const emptyState = document.querySelector('[data-archive-empty]');
  const visibleCount = document.querySelector('[data-archive-visible-count]');
  const statApplications = document.querySelector('[data-archive-stat="applications"]');
  const statFailed = document.querySelector('[data-archive-stat="failed"]');
  const statPassed = document.querySelector('[data-archive-stat="passed"]');

  const compute = () => {
    let applications = 0;
    let failed = 0;
    let passed = 0;

    rows.forEach((row) => {
      if (row.hidden) return;
      applications += 1;
      const status = String(row.getAttribute('data-status') || '').trim().toLowerCase();
      if (status === 'failed') failed += 1;
      if (status === 'passed') passed += 1;
    });

    if (visibleCount) visibleCount.textContent = String(applications);
    if (statApplications) statApplications.textContent = String(applications);
    if (statFailed) statFailed.textContent = String(failed);
    if (statPassed) statPassed.textContent = String(passed);

    if (emptyState) {
      emptyState.hidden = rows.length === 0 || applications !== 0;
    }
  };

  compute();
}

function initializeLiveRefresh() {
  const refreshMs = Number.parseInt(
    document.body?.getAttribute('data-live-refresh-ms') || '',
    10
  );

  if (Number.isNaN(refreshMs) || refreshMs <= 0) return;

  let pendingRefresh = false;

  const refreshPage = () => {
    if (document.hidden) {
      pendingRefresh = true;
      return;
    }

    pendingRefresh = false;
    window.location.reload();
  };

  setInterval(refreshPage, refreshMs);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && pendingRefresh) {
      refreshPage();
    }
  });
}

function initializeInfoTooltip() {
  const tooltip = document.querySelector('[data-info-tooltip-layer]');
  const cards = Array.from(document.querySelectorAll('[data-info-tooltip]'));
  if (!tooltip || !cards.length) return;

  tooltip.hidden = false;

  const offsetX = 4;
  const offsetY = 4;

  const moveTooltip = (event) => {
    const tooltipRect = tooltip.getBoundingClientRect();
    const maxLeft = window.innerWidth - tooltipRect.width - 12;
    const maxTop = window.innerHeight - tooltipRect.height - 12;
    const left = Math.min(
      event.clientX + offsetX,
      Math.max(12, maxLeft)
    );
    const top = Math.min(
      event.clientY + offsetY,
      Math.max(12, maxTop)
    );

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  };

  cards.forEach((card) => {
    card.addEventListener('mouseenter', (event) => {
      tooltip.textContent = card.getAttribute('data-info-tooltip') || '';
      tooltip.classList.add('infoTooltip--visible');
      moveTooltip(event);
    });

    card.addEventListener('mousemove', moveTooltip);

    card.addEventListener('mouseleave', () => {
      tooltip.classList.remove('infoTooltip--visible');
      tooltip.textContent = '';
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initializeApplicationSearch();
  initializeArchiveFilter();
  initializeLiveRefresh();
  initializeInfoTooltip();
});
