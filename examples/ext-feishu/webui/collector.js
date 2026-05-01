/**
 * - POST /ext-feishu/collect
 * - GET /ext-feishu/stats
 */

const state = {
  events: [],
  counters: {},
};

function addEvent(event) {
  const type = event && event.type ? String(event.type) : 'unknown';
  state.events.push({
    ...event,
    type,
    at: Date.now(),
  });
  state.counters[type] = (state.counters[type] || 0) + 1;

  if (state.events.length > 1000) {
    state.events.splice(0, state.events.length - 1000);
  }
}

module.exports = async function extFeishuCollector(req, res) {
  if (req.method === 'POST') {
    addEvent(req.body || {});
    return res.json({ ok: true, total: state.events.length });
  }

  return res.json({
    ok: true,
    total: state.events.length,
    counters: state.counters,
    latest: state.events.slice(-20),
  });
};
