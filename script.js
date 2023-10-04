/*
  script.js
  Used by index.html.
*/

document.getElementById('form').addEventListener('submit', event => {
  event.preventDefault();
  document.getElementById('submit').setAttribute('disabled');
  document
  .getElementById('status')
  .textContent = 'Request being processed. Please leave this page open and wait up to 5 minutes for the result.';
});
