// End-to-end run of kernel.js in goja: lifecycle, RPC handlers, storage
// layout, reminder scheduling and multi-window claiming.
(async function () {
  var failures = 0;
  function check(name, ok, detail) {
    if (ok) console.log("ok   " + name);
    else {
      failures++;
      console.log("FAIL " + name + (detail === undefined ? "" : " :: " + JSON.stringify(detail)));
    }
  }
  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }
  function localDate(offsetDays) {
    var d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }
  function call(method) {
    var fn = __mock.rpc.get(method);
    if (!fn) throw new Error("method not bound: " + method);
    return fn.apply(null, Array.prototype.slice.call(arguments, 1));
  }

  var life = siyuan.plugin.lifecycle;
  await life.onload();
  await life.onrunning();

  check("binds all RPC methods", __mock.rpc.size === 7, Array.from(__mock.rpc.keys()));

  var empty = await call("snapshot");
  check("empty snapshot", empty.subscriptions.length === 0 && empty.settings.notifyAt === "09:00", empty);

  var settings = await call("updateSettings", { notifyAt: "00:00" });
  check("settings saved", settings.notifyAt === "00:00" && __mock.storage.has("settings.json"));

  var input = {
    name: "Netflix",
    status: "active",
    price: { amount: 1599, currency: "USD" },
    cycle: { unit: "month", every: 1 },
    anchorDate: localDate(3),
  };
  __mock.broadcasts.length = 0;
  var created = await call("createSubscription", input);
  check("create returns record", typeof created.id === "string" && created.name === "Netflix", created);
  check("one file per subscription", __mock.storage.has("subscriptions/" + created.id + ".json"));
  check("broadcasts changed", __mock.broadcasts.some((b) => b.method === "changed"));
  check("hlc uses device id", /-8d2fABC123device$/.test(created.updatedAt), created.updatedAt);

  var pending = await call("pendingReminders");
  check("reminder due 3 days ahead", pending.length === 1 && pending[0].threshold === 3 && pending[0].daysLeft === 3, pending);

  await sleep(50); // let the tick scheduled after the edit run
  var due = __mock.broadcasts.filter((b) => b.method === "reminders-due");
  check("tick broadcasts reminders-due once", due.length === 1 && due[0].params.reminders.length === 1, due);

  var key = pending[0].key;
  var results = await Promise.all([call("claimReminders", [key]), call("claimReminders", [key])]);
  check("exactly one window wins the claim", results[0].length + results[1].length === 1, results);
  check("delivery recorded per device", __mock.storage.has("delivered/8d2fABC123device.json"));
  check("claimed reminder no longer pending", (await call("pendingReminders")).length === 0);

  var error = null;
  try {
    await call("createSubscription", Object.assign({}, input, { anchorDate: "2026-02-30" }));
  } catch (e) {
    error = String(e && e.message ? e.message : e);
  }
  check("validation errors are JSON", error !== null && error.indexOf('"kind":"validation"') >= 0, error);

  var updated = await call("updateSubscription", created.id, Object.assign({}, input, { name: "Netflix Premium" }));
  check("update bumps hlc", updated.updatedAt > created.updatedAt && updated.name === "Netflix Premium");

  await call("deleteSubscription", created.id);
  var after = await call("snapshot");
  var tomb = JSON.parse(__mock.storage.get("subscriptions/" + created.id + ".json"));
  check("delete leaves a tombstone", after.subscriptions.length === 0 && !!tomb.deletedAt, tomb);

  var notFound = null;
  try {
    await call("deleteSubscription", created.id);
  } catch (e) {
    notFound = String(e.message);
  }
  check("deleting twice reports not-found", notFound !== null && notFound.indexOf("not-found") >= 0, notFound);

  await life.onunload();
  check("no warnings or errors logged", __mock.logs.filter((l) => l[0] === "warn" || l[0] === "error").length === 0, __mock.logs);

  console.log(failures === 0 ? "kernel scenario passed" : failures + " check(s) failed");
  __finish(failures === 0 ? 0 : 1);
})().catch(function (e) {
  console.log("FAIL uncaught: " + (e && e.stack ? e.stack : e));
  __finish(1);
});
