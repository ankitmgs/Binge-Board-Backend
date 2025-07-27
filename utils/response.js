function sendResponse(res, status, msg, data = null) {
  res.status(status).json({ status, msg, data });
}

module.exports = sendResponse;
