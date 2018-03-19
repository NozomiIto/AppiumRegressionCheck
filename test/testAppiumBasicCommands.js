'use strict';

const chai = require("chai");
const assert = chai.assert;
const forEach = require('mocha-each');
const wd = require("wd");
const TouchAction = wd.TouchAction;
const util = require("util");
const childProcess = require("child_process");

const appiumCmds = ["appium"];
// const appiumCmds = ["node", "/Users/itonozomi/Documents/GitHub/appium/build/lib/main.js"];
const testAppDir = __dirname + "/../test_app";

let sleep = function(milliSeconds) {
    return new Promise(resolve => setTimeout(resolve, milliSeconds));
}

// returns process object
let launchAppiumServer = async () => {
  console.log("launch Appium server");
  let command = appiumCmds[0];
  let args = appiumCmds.slice(1).concat(
    ["--log", "appiumServer.log", "--session-override", "--log-level", "debug", "--local-timezone"]);
  let process = childProcess.spawn(command, args);
  await sleep(5000); // TODO smarter wait
  return process;
}

let killAppiumServer = (process) => {
  console.log("kill Appium server");
  if (process) {
    process.kill();
  }
}

let standardOperationCheck = async (caps) => {
  let driver = wd.promiseChainRemote('http://localhost:4723/wd/hub');
  await driver.init(caps);

  // check page source method works without error
  console.log("page source");
  let src = await driver.source();
  assert.isTrue(!!src); // not null nor empty

  // check taking screen shot works without error
  console.log("screenshot");
  let image = await driver.takeScreenshot();
  assert.isTrue(!!image); // not null nor empty

  // try to click first element if clickable
  console.log("find and click");
  let element = await driver.elementByXPath("//*[1]");
  if (await element.isDisplayed() && await element.isEnabled()) {
    await element.click();
  }

  // check TouchAction works
  console.log("touch action");
  let action = new TouchAction(driver);
  action.press({x: 50, y:50}).moveTo({x: 100, y: 100}).release();
  await driver.performTouchAction(action);

  // TODO check rotation works
  // console.log("orientation");
  // await driver.setOrientation("LANDSCAPE");
  // await driver.setOrientation("PORTRAIT");

  // check page source method and taking screen shot again after several operations
  console.log("page source again");
  src = await driver.source();
  assert.isTrue(!!src); // not null nor empty
  console.log("screenshot again");
  image = await driver.takeScreenshot();
  assert.isTrue(!!image); // not null nor empty

  await driver.quit();
}

// This test checks if the current Appium server and client combination works well.
// You need to install command line Appium server preliminarily.
describe("Appium basic commands", function() {
  this.timeout(3600000);  // mocha timeout
  let appiumServer = null;

  before(async () => {
    appiumServer = await launchAppiumServer();
  });

  after(() => {
    killAppiumServer(appiumServer);
  });

  forEach([
    ['app', testAppDir + "/TestApp.app"],
    ['bundleId', 'com.apple.Maps'],
    ['bundleId', 'com.apple.Preferences']
  ])
  .it("should work with iOS simulator 10: %s=%s", async (targetKey, targetValue) => {
    let caps = {
      platformName: 'iOS',
      platformVersion: '10.3',
      deviceName: 'iPhone 7',
      automationName: 'XCUITest',
      showXcodeLog: true,
      wdaLocalPort: 8100,
    };
    caps[targetKey] = targetValue;
    await standardOperationCheck(caps);
  });

  forEach([
    ['app', testAppDir + "/UICatalog.app"],
    ['app', testAppDir + "/magic_pod_demo_app.app"],
    ['bundleId', 'com.apple.news'],
    ['bundleId', 'com.apple.mobileslideshow']
  ])
  .it("should work with iOS simulator 11: %s=%s", async (targetKey, targetValue) => {
    let caps = {
      platformName: 'iOS',
      platformVersion: '11.2',
      deviceName: 'iPhone 8',
      automationName: 'XCUITest',
      showXcodeLog: true,
      wdaLocalPort: 8101,
    };
    caps[targetKey] = targetValue;
    await standardOperationCheck(caps);
  });

  // - iOS real device must be connected
  // - APPLE_TEAM_ID_FOR_MAGIC_POD environment variable must be set
  forEach([
    ['bundleId', 'com.apple.camera'],
    ['bundleId', 'com.apple.Health']
  ])
  .it("should work with iOS real device: %s=%s", async (targetKey, targetValue) => {
    let caps = {
      platformName: 'iOS',
      platformVersion: '10.3', // dummy
      deviceName: 'iPhone 5', // dummy
      udid: 'auto',
      automationName: 'XCUITest',
      showXcodeLog: true,
      xcodeSigningId: 'iPhone Developer',
      xcodeOrgId: process.env.APPLE_TEAM_ID_FOR_MAGIC_POD,
      wdaLocalPort: 8102,
    };
    caps[targetKey] = targetValue;
    await standardOperationCheck(caps);
  });

  // Android real device must be connected
  forEach([
    ['app', testAppDir + "/ApiDemos-debug.apk", null, null],
    // assume following apps have been installed
    ['appPackage', 'com.android.chrome', 'appActivity', 'com.google.android.apps.chrome.Main'],
    ['appPackage', 'com.google.android.apps.maps', 'appActivity', 'com.google.android.maps.MapsActivity']
  ])
  .it("should work with Android real device: %s=%s", async (targetKey1, targetValue1, targetKey2, targetValue2) => {
    let caps = {
      'platformName': 'Android',
      'deviceName': 'Android',
      'automationName': 'uiautomator2',
    };
    caps[targetKey1] = targetValue1;
    if (targetKey2) {
      caps[targetKey2] = targetValue2;
    };
    await standardOperationCheck(caps);
  });
});
