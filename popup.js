document.addEventListener('DOMContentLoaded', function() {
  const setupBtn = document.getElementById('setupBtn');
  const testBtn = document.getElementById('testBtn');

  setupBtn.addEventListener('click', function() {
    chrome.tabs.create({ url: 'setup.html' });
  });

  testBtn.addEventListener('click', function() {
    chrome.tabs.create({ url: 'test.html' });
  });
});
