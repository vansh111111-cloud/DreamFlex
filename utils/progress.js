// utils/progress.js

/**
 * Simulate upload progress for small files
 * @param {function} callback - function(percent) to receive progress updates
 * @param {number} intervalTime - interval between updates in ms (default 300ms)
 * @returns {function} - a stop function to clear the interval
 */
function simulateProgress(callback, intervalTime = 300) {
  let percent = 0;
  const interval = setInterval(() => {
    if (percent < 90) {
      percent += 10;
      callback(percent);
    }
  }, intervalTime);

  // Return stop function
  return () => clearInterval(interval);
}

/**
 * Broadcast progress (placeholder function)
 * You can replace this with SSE or socket.io in your project
 * @param {number} percent
 */
function broadcastProgress(percent) {
  console.log(`Upload progress: ${percent}%`);
}

module.exports = {
  simulateProgress,
  broadcastProgress
};
