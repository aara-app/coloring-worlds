/* Coloring Cart — in-app purchase layer (cordova-plugin-purchase v13).
 *
 * One product: "coloringcart.full.unlock" — non-consumable, $4.99,
 * unlocks all worlds + the full palette/tools. The entitlement is cached
 * in the app's existing localStorage flag (cw_unlocked_v1, owned by
 * app.js); this module only ever SETS it via the callback given to
 * init(), after the store confirms ownership.
 *
 * Safety: on web (phone preview / browser) there is no store — every
 * call resolves gracefully with status "unavailable" and the app shows a
 * friendly toast. Nothing here throws into the app.
 *
 * To go live, the product must exist in App Store Connect (and Play
 * Console) with the exact id above — see store-metadata-draft.md.
 */
(function () {
  "use strict";

  var PRODUCT_ID = "coloringcart.full.unlock";
  var initPromise = null;
  var ready = false;
  var entitlementCb = null;
  var pendingPurchase = null; // {resolve} while a purchase sheet is open

  function isNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform &&
      window.Capacitor.isNativePlatform());
  }
  function store() {
    try {
      if (typeof CdvPurchase !== "undefined" && CdvPurchase.store) return CdvPurchase.store;
    } catch (e) {}
    return null;
  }
  function owned() {
    var s = store();
    if (!s) return false;
    try {
      if (typeof s.owned === "function") return !!s.owned(PRODUCT_ID);
      var p = s.get(PRODUCT_ID);
      return !!(p && p.owned);
    } catch (e) { return false; }
  }
  function notifyIfOwned() {
    if (owned() && entitlementCb) {
      try { entitlementCb(true); } catch (e) {}
    }
  }
  /* Success buzz via the Capacitor Haptics plugin when a purchase
   * completes. Defensive guard: native only, silently no-ops on web /
   * missing plugin, never throws into the purchase flow. */
  function purchaseSuccessHaptic() {
    try {
      var H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
      if (!H) return;
      var p = H.notification({ type: "SUCCESS" }); /* NotificationType.Success */
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }
  function settlePurchase(result) {
    if (pendingPurchase) {
      var p = pendingPurchase;
      pendingPurchase = null;
      if (result && result.ok && result.status === "purchased") purchaseSuccessHaptic();
      try { p.resolve(result); } catch (e) {}
    }
  }

  /* Register the product + transaction pipeline, then initialize the
   * store. Resolves true when a real store is ready, false on web /
   * before the store products exist. Never rejects. */
  function init(onEntitlement) {
    if (onEntitlement) entitlementCb = onEntitlement;
    if (initPromise) return initPromise;
    initPromise = new Promise(function (resolve) {
      var s = store();
      if (!isNative() || !s) { resolve(false); return; }
      try {
        s.register([{
          id: PRODUCT_ID,
          type: CdvPurchase.ProductType.NON_CONSUMABLE
        }]);
        var when = s.when();
        when.approved(function (tx) {
          try { tx.verify(); } catch (e) {}
        });
        when.verified(function (receipt) {
          try { receipt.finish(); } catch (e) {}
          notifyIfOwned();
          settlePurchase({ ok: true, status: "purchased" });
        });
        when.finished(function () {
          notifyIfOwned();
          if (owned()) settlePurchase({ ok: true, status: "purchased" });
        });
        when.productUpdated(function () { notifyIfOwned(); });
        when.receiptUpdated(function () { notifyIfOwned(); });

        var platforms = [];
        if (CdvPurchase.Platform) {
          if (CdvPurchase.Platform.APPLE_APPSTORE) platforms.push(CdvPurchase.Platform.APPLE_APPSTORE);
          if (CdvPurchase.Platform.GOOGLE_PLAY) platforms.push(CdvPurchase.Platform.GOOGLE_PLAY);
        }
        var p = platforms.length ? s.initialize(platforms) : s.initialize();
        Promise.resolve(p).then(function () {
          ready = true;
          try { s.update(); } catch (e) {}
          notifyIfOwned();
          resolve(true);
        }).catch(function () { resolve(false); });
      } catch (e) { resolve(false); }
    });
    return initPromise;
  }

  /* Buy the unlock. Resolves {ok, status} where status is one of
   * "purchased" | "owned" | "cancelled" | "unavailable" | "error".
   * Never rejects. */
  function purchase() {
    return init().then(function (storeReady) {
      var s = store();
      if (!storeReady || !s) return { ok: false, status: "unavailable" };
      if (owned()) return { ok: true, status: "owned" };
      var product = null;
      try { product = s.get(PRODUCT_ID); } catch (e) {}
      if (!product) {
        // Store is up but the product isn't (not created in the store
        // console yet, or metadata still propagating).
        try { s.update(); } catch (e) {}
        return { ok: false, status: "error", reason: "product-not-found" };
      }
      return new Promise(function (resolve) {
        pendingPurchase = { resolve: resolve };
        var orderResult;
        try {
          orderResult = s.order(product);
        } catch (e) {
          settlePurchase({ ok: false, status: "error" });
          return;
        }
        Promise.resolve(orderResult).then(function (err) {
          if (err) {
            var cancelled = !!(CdvPurchase.ErrorCode &&
              err.code === CdvPurchase.ErrorCode.PAYMENT_CANCELLED);
            settlePurchase({ ok: false, status: cancelled ? "cancelled" : "error" });
          } else if (owned()) {
            settlePurchase({ ok: true, status: "purchased" });
          }
          // Otherwise the approved -> verified -> finished chain
          // settles the pending purchase.
        }).catch(function () {
          settlePurchase({ ok: false, status: "error" });
        });
      });
    });
  }

  /* Restore purchases. Resolves {ok, unlocked, status}. Never rejects. */
  function restore() {
    return init().then(function (storeReady) {
      var s = store();
      if (!storeReady || !s) return { ok: false, unlocked: false, status: "unavailable" };
      var attempt = (typeof s.restorePurchases === "function")
        ? Promise.resolve(s.restorePurchases()).catch(function () {})
        : Promise.resolve();
      return attempt.then(function () {
        try { s.update(); } catch (e) {}
        return new Promise(function (resolve) {
          setTimeout(function () {
            var has = owned();
            if (has) notifyIfOwned();
            resolve({ ok: true, unlocked: has, status: has ? "restored" : "nothing" });
          }, 900);
        });
      });
    });
  }

  window.CC_Purchases = {
    PRODUCT_ID: PRODUCT_ID,
    init: init,
    purchase: purchase,
    restore: restore,
    owned: owned,
    isAvailable: function () { return isNative() && !!store(); },
    isReady: function () { return ready; }
  };
})();
