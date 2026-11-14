const SNAP_WAIT_MS = 20000;

function interpretMealResponse(status, body) {
  if (status === 429) return { type: "quota" };
  if (status >= 200 && status < 300 && body && body.success === true && body.data) {
    return { type: "meal", data: body.data };
  }
  return { type: "retry" };
}

module.exports = {
  SNAP_WAIT_MS,
  interpretMealResponse,
};
