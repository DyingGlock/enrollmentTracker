function initializeApplicationSearch() {
  const inputs = Array.from(document.querySelectorAll('[data-application-search]'));

  inputs.forEach((input) => {
    const targetTableId = input.getAttribute('data-target-table');
    const table = targetTableId ? document.getElementById(targetTableId) : null;
    if (!table) return;

    const rows = Array.from(table.querySelectorAll('tbody tr[data-search]'));
    const emptyState =
      table.closest('.tableWrap')?.querySelector('[data-search-empty]') ||
      document.querySelector('[data-search-empty]');

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
  });
}

function initializeArchiveFilter() {
  const table = document.getElementById('archived-applications-table');
  if (!table) return;

  const searchInput = document.querySelector('[data-archive-search]');
  const classFilter = document.querySelector('[data-archive-class-filter]');
  const rows = Array.from(table.querySelectorAll('tbody tr[data-search]'));
  const emptyState = table.closest('.tableWrap')?.querySelector('[data-search-empty]');
  const visibleCount = document.querySelector('[data-archive-visible-count]');
  const statFailed = document.querySelector('[data-archive-stat="failed"]');
  const statPassed = document.querySelector('[data-archive-stat="passed"]');

  const classOptions = classFilter
    ? Array.from(classFilter.querySelectorAll('[data-archive-class-option]'))
    : [];
  const classToggle = classFilter?.querySelector('[data-class-filter-toggle]');
  const classMenu = classFilter?.querySelector('[data-class-filter-menu]');
  const classSummary = classFilter?.querySelector('[data-class-filter-summary]');
  const classSelectAll = classFilter?.querySelector('[data-class-filter-all]');
  const classSelectNone = classFilter?.querySelector('[data-class-filter-none]');

  const getSelectedClasses = () =>
    new Set(
      classOptions.filter((option) => option.checked).map((option) => option.value)
    );

  const updateClassSummary = () => {
    if (!classSummary) return;

    const selected = classOptions.filter((option) => option.checked);
    if (!classOptions.length || selected.length === classOptions.length) {
      classSummary.textContent = 'All classes';
      return;
    }

    if (!selected.length) {
      classSummary.textContent = 'No classes selected';
      return;
    }

    if (selected.length <= 2) {
      classSummary.textContent = selected
        .map((option) => `Class ${option.value}`)
        .join(', ');
      return;
    }

    classSummary.textContent = `${selected.length} classes selected`;
  };

  const rowMatchesFilters = (row) => {
    const query = searchInput ? String(searchInput.value || '').trim().toLowerCase() : '';
    const haystack = String(row.getAttribute('data-search') || '');
    const searchMatches = !query || haystack.includes(query);

    if (!classOptions.length) {
      return searchMatches;
    }

    const selectedClasses = getSelectedClasses();
    if (!selectedClasses.size) {
      return false;
    }

    const classNumber = String(row.getAttribute('data-class') || '').trim();
    const classMatches = classNumber && selectedClasses.has(classNumber);
    return searchMatches && classMatches;
  };

  const applyFilters = () => {
    let applications = 0;
    let failed = 0;
    let passed = 0;

    rows.forEach((row) => {
      const matches = rowMatchesFilters(row);
      row.hidden = !matches;
      if (!matches) return;

      applications += 1;
      const status = String(row.getAttribute('data-status') || '').trim().toLowerCase();
      if (status === 'failed') failed += 1;
      if (status === 'passed') passed += 1;
    });

    if (visibleCount) visibleCount.textContent = String(applications);
    if (statFailed) statFailed.textContent = String(failed);
    if (statPassed) statPassed.textContent = String(passed);
    if (emptyState) {
      emptyState.hidden = applications !== 0;
    }

    updateClassSummary();
  };

  const closeClassMenu = () => {
    if (!classMenu || !classToggle) return;
    classMenu.hidden = true;
    classToggle.setAttribute('aria-expanded', 'false');
  };

  const openClassMenu = () => {
    if (!classMenu || !classToggle) return;
    classMenu.hidden = false;
    classToggle.setAttribute('aria-expanded', 'true');
  };

  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }

  classOptions.forEach((option) => {
    option.addEventListener('change', applyFilters);
  });

  if (classSelectAll) {
    classSelectAll.addEventListener('click', () => {
      classOptions.forEach((option) => {
        option.checked = true;
      });
      applyFilters();
    });
  }

  if (classSelectNone) {
    classSelectNone.addEventListener('click', () => {
      classOptions.forEach((option) => {
        option.checked = false;
      });
      applyFilters();
    });
  }

  if (classToggle && classMenu) {
    classToggle.addEventListener('click', () => {
      if (classMenu.hidden) {
        openClassMenu();
      } else {
        closeClassMenu();
      }
    });

    document.addEventListener('click', (event) => {
      if (!classFilter?.contains(event.target)) {
        closeClassMenu();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeClassMenu();
      }
    });
  }

  applyFilters();
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
    const left = Math.min(event.clientX + offsetX, Math.max(12, maxLeft));
    const top = Math.min(event.clientY + offsetY, Math.max(12, maxTop));

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
