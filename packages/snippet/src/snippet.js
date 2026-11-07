(function (window, document) {
  var script = document.currentScript;
  var nav = window.navigator;
  if (
    !script ||
    nav.doNotTrack === "1" ||
    window.doNotTrack === "1" ||
    nav.globalPrivacyControl
  ) {
    return;
  }
  var endpoint = script.getAttribute("data-endpoint");
  if (!endpoint) return;
  var pattern = script.getAttribute("data-room-regex");
  var roomRegex = pattern ? new RegExp(pattern) : null;

  var TYPE = "text/plain;charset=UTF-8";
  var MAX_BATCH = 10;
  var MAX_PER_REQUEST = 20;
  var FLUSH_DELAY = 2000;
  var MAX_AGE = 86400000;
  var queue = [];
  var timer = 0;
  var lastPath = "";

  function cleanProps(props) {
    if (!props || typeof props !== "object") return null;
    var out = {};
    var count = 0;
    Object.keys(props).forEach(function (key) {
      var value = props[key];
      var type = typeof value;
      if (count >= 10) return;
      if (type !== "string" && type !== "number" && type !== "boolean") return;
      if (type === "number" && !isFinite(value)) return;
      out[key.slice(0, 40)] = type === "string" ? value.slice(0, 100) : value;
      count++;
    });
    return count ? out : null;
  }

  function send(body) {
    var sent = false;
    try {
      sent = nav.sendBeacon
        ? nav.sendBeacon(endpoint, new Blob([body], { type: TYPE }))
        : false;
    } catch (error) {
      sent = false;
    }
    if (!sent && window.fetch) {
      window
        .fetch(endpoint, {
          method: "POST",
          body: body,
          headers: { "content-type": TYPE },
          keepalive: true,
          credentials: "omit",
        })
        .catch(function () {});
    }
  }

  function flush() {
    window.clearTimeout(timer);
    timer = 0;
    var now = Date.now();
    while (queue.length) {
      var events = queue.splice(0, MAX_PER_REQUEST).map(function (item) {
        item.age = Math.min(Math.max(Math.round(now - item.at), 0), MAX_AGE);
        delete item.at;
        return item;
      });
      send(JSON.stringify({ events: events }));
    }
  }

  function push(name, props, referrer) {
    var clean = String(name)
      .toLowerCase()
      .replace(/[^a-z0-9_:-]/g, "_")
      .slice(0, 40);
    if (!clean) return;
    var path = window.location.pathname.slice(0, 200);
    var item = { name: clean, path: path, at: Date.now() };
    var match = roomRegex && roomRegex.exec(path);
    var room = match && match[1] ? match[1].toUpperCase() : "";
    if (/^[A-Z0-9]{4,12}$/.test(room)) item.room = room;
    if (referrer) item.referrer = referrer;
    var cleanedProps = cleanProps(props);
    if (cleanedProps) item.props = cleanedProps;
    queue.push(item);
    if (queue.length >= MAX_BATCH) flush();
    else if (!timer) timer = window.setTimeout(flush, FLUSH_DELAY);
  }

  function pageview() {
    var path = window.location.pathname;
    if (path === lastPath) return;
    var first = !lastPath;
    lastPath = path;
    var referrer = "";
    if (first && document.referrer) {
      try {
        referrer = new URL(document.referrer).hostname;
      } catch (error) {
        referrer = "";
      }
      if (referrer === window.location.hostname) referrer = "";
    }
    push("pageview", null, referrer.slice(0, 100));
  }

  ["pushState", "replaceState"].forEach(function (method) {
    var original = window.history[method];
    window.history[method] = function () {
      var result = original.apply(this, arguments);
      pageview();
      return result;
    };
  });
  window.addEventListener("popstate", pageview);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);

  window.cp = {
    track: function (name, props) {
      push(name, props);
    },
  };

  pageview();
})(window, document);
