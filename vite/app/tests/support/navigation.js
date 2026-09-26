// -----------------------------------------------------------
//  [*] Test support — hard navigation spy
//
//  The app ends several flows with a FULL page load:
//    window.location.href = "/"               (after login)
//    window.location.href = "/login"          (401, logout)
//    window.location.href = "/student/finish" (test finished)
//    window.location.reload()                 (retry buttons)
//  jsdom cannot navigate (it only logs "Not implemented:
//  navigation"), so `install` puts a Proxy in place of
//  window.location: every READ goes to the real jsdom
//  Location (pathname, search, ... — React Router's
//  BrowserRouter keeps working), while href writes,
//  assign/replace and reload are only RECORDED for the test
//  to assert on.
//
//  The Proxy's target is an empty stand-in, NOT the real
//  Location: jsdom defines assign / replace / reload /
//  toString as non-writable, non-configurable own properties
//  of every Location, and a Proxy over it may not report a
//  different value for those (the engine throws a TypeError
//  on `window.location.reload()` otherwise).
//
//    hardNavigations() → ["/login", ...] in call order
//    reloadCount()     → how many times reload() was called
//
//  setup.js installs the spy before every test; the
//  vi.unstubAllGlobals() in its afterEach removes it.
// -----------------------------------------------------------

import { vi } from "vitest";


let navigations = [];
let reloads = 0;

// spy → the real Location it stands in for
const realLocations = new WeakMap();







// -----------------------------------------------------------
// installNavigationSpy
// -----------------------------------------------------------
//
// Called by setup.js before each test. Captures the real
// location first — once stubbed, window.location IS the
// proxy (a spy a previous test left behind is unwrapped, so
// spies never stack).
//
// Used by:
//   - setup.js (beforeEach)
// -----------------------------------------------------------

export function installNavigationSpy() {

  navigations = [];
  reloads = 0;

  const current = window.location;
  const realLocation = realLocations.get(current) ?? current;

  // One function each, so identity checks see stable methods
  const record = (url) => { navigations.push(String(url)); };
  const reload = () => { reloads += 1; };

  const standIn = Object.create(Object.getPrototypeOf(realLocation));

  const spy = new Proxy(standIn, {
    get(_standIn, property) {
      if (property === "assign" || property === "replace") return record;
      if (property === "reload") return reload;

      // Real value, read with the real Location as `this` —
      // its accessors reject any other receiver
      const value = Reflect.get(realLocation, property, realLocation);
      return typeof value === "function" ? value.bind(realLocation) : value;
    },

    set(_standIn, property, value) {
      if (property === "href") {
        record(value);
        return true;
      }
      return Reflect.set(realLocation, property, value, realLocation);
    },

    has(_standIn, property) {
      return property in realLocation;
    },
  });

  realLocations.set(spy, realLocation);
  vi.stubGlobal("location", spy);
}







// -----------------------------------------------------------
// hardNavigations / reloadCount
// -----------------------------------------------------------
//
// What the code under test asked the browser to do, in order.
//
// Used by:
//   - every test asserting a full-page redirect or reload
// -----------------------------------------------------------

export const hardNavigations = () => [...navigations];

export const reloadCount = () => reloads;
