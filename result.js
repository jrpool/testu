/*
  result.js

  Makes the result page subscribe to server-sent events and update its status whenever it receives
  an event addressed to it.
*/

// CONSTANTS

const jobID = document.getElementById('jobID').textContent;

// FUNCTIONS

// Handles a message event.
const handleMessage = event => {
  // If the message is addressed to this session:
  const {data} = event;
  if (data) {
    // Replace the status content with the received text.
    document.getElementById('status').innerHTML = data;
  }
};
// After the DOM has loaded:
document.addEventListener('DOMContentLoaded', () => {
  // Request an event stream and listen for messages on it.
  const source = new EventSource('/testu/status');
  source.addEventListener('message', event => {
    handleMessage(event);
  });
});
