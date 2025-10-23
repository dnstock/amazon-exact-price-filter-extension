/* Amazon Exact Price Filter - popup.js */
(function() {
  'use strict';

  const form = document.getElementById('price-form');
  const minInput = document.getElementById('minPrice');
  const maxInput = document.getElementById('maxPrice');
  const errorEl = document.getElementById('error');
  const statusEl = document.getElementById('status');
  const resetBtn = document.getElementById('resetBtn');

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.add('show');
    statusEl.classList.remove('show');
  }

  function showStatus(msg) {
    statusEl.textContent = msg;
    statusEl.classList.add('show');
    errorEl.classList.remove('show');
  }

  function clearMessages() {
    errorEl.classList.remove('show');
    statusEl.classList.remove('show');
  }

  function isOnAmazonCom(url) {
    try {
      const u = new URL(url);
      return u.hostname.endsWith('amazon.com');
    } catch {
      return false;
    }
  }

  function sanitizeNumber(str) {
    if (str == null) return null;
    const trimmed = String(str).trim();
    if (!trimmed) return null;
    const val = Number(trimmed);
    return Number.isFinite(val) && val >= 0 ? val : NaN;
  }

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  function updateUrlWithPrices(rawUrl, minVal, maxVal, doRemoveIfEmpty = false) {
    const url = new URL(rawUrl);
    const sp = url.searchParams;

    // Optionally remove first
    if (doRemoveIfEmpty) {
      sp.delete('low-price');
      sp.delete('high-price');
    }

    if (minVal != null && !Number.isNaN(minVal)) {
      sp.set('low-price', String(minVal));
    }
    if (maxVal != null && !Number.isNaN(maxVal)) {
      sp.set('high-price', String(maxVal));
    }
    url.search = sp.toString();
    return url.toString();
  }

  function removePriceFilters(rawUrl) {
    const url = new URL(rawUrl);
    url.searchParams.delete('low-price');
    url.searchParams.delete('high-price');
    url.search = url.searchParams.toString();
    return url.toString();
  }

  // Prefill from current tab
  (async function prefill() {
    try {
      const tab = await getActiveTab();
      if (!tab || !tab.url) return;

      if (!isOnAmazonCom(tab.url)) {
        showStatus('Open an Amazon.com search results page to use this.');
        return;
      }

      const u = new URL(tab.url);
      const lp = u.searchParams.get('low-price');
      const hp = u.searchParams.get('high-price');
      if (lp) minInput.value = lp;
      if (hp) maxInput.value = hp;
    } catch (e) {
      console.error(e);
    }
  })();

  // Apply filters
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();

    const minVal = sanitizeNumber(minInput.value);
    const maxVal = sanitizeNumber(maxInput.value);

    // Validate provided values
    if (minInput.value.trim() && Number.isNaN(minVal)) {
      showError('Minimum price must be a valid non-negative number.');
      return;
    }
    if (maxInput.value.trim() && Number.isNaN(maxVal)) {
      showError('Maximum price must be a valid non-negative number.');
      return;
    }
    if (minInput.value.trim() && maxInput.value.trim() && minVal >= maxVal) {
      showError('Minimum price must be less than maximum price.');
      return;
    }
    if (!minInput.value.trim() && !maxInput.value.trim()) {
      showError('Enter at least one value (min or max).');
      return;
    }

    const tab = await getActiveTab();
    if (!tab || !tab.id || !tab.url) {
      showError('Could not access the current tab.');
      return;
    }
    if (!isOnAmazonCom(tab.url)) {
      showError('This tool only modifies URLs on Amazon.com.');
      return;
    }

    try {
      const newUrl = updateUrlWithPrices(tab.url, minVal, maxVal, /*remove first*/ true);
      await chrome.tabs.update(tab.id, { url: newUrl });
      showStatus('Applied. Reloading results…');
    } catch (err) {
      console.error(err);
      showError('Failed to update the URL.');
    }
  });

  // Reset filters and inputs
  resetBtn.addEventListener('click', async () => {
    clearMessages();
    minInput.value = '';
    maxInput.value = '';

    const tab = await getActiveTab();
    if (!tab || !tab.id || !tab.url) return;

    if (!isOnAmazonCom(tab.url)) {
      showStatus('Inputs cleared.');
      return;
    }

    try {
      const newUrl = removePriceFilters(tab.url);
      if (newUrl !== tab.url) {
        await chrome.tabs.update(tab.id, { url: newUrl });
        showStatus('Cleared and reloading results…');
      } else {
        showStatus('Inputs cleared.');
      }
    } catch (err) {
      console.error(err);
      showError('Failed to clear filters from URL.');
    }
  });
})();
