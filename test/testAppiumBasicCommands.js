'use strict';

const chai = require("chai");
const assert = chai.assert;
const forEach = require('mocha-each');
const wd = require("wd");
const TouchAction = wd.TouchAction;
const util = require("util");
const childProcess = require("child_process");
const teenProcess = require('teen_process');

const appiumCmds = ["appium"];
// const appiumCmds = ["node", "/Users/itonozomi/Documents/GitHub/appium/build/lib/main.js"];
const testAppDir = __dirname + "/../test_app";
const java8Port = 4723;
const java9Port = 4724;

let sleep = function(milliSeconds) {
    return new Promise(resolve => setTimeout(resolve, milliSeconds));
}

let getJavaHomeValue = async (versionStr) => {
  let javaHomeResult = await teenProcess.exec("/usr/libexec/java_home", ["-v", versionStr]);
  let stdOut = javaHomeResult.stdout;
  if (stdOut) {
    return stdOut.trim();
  }
  throw new Error(util.format("JAVA_HOME for % is not found", versionStr));
}

// returns process object
let launchAppiumServer = async (javaVersion, port) => {
  process.env["JAVA_HOME"] = await getJavaHomeValue(javaVersion);
  console.log(util.format("launch Appium server with JAVA_HOME=%s", process.env["JAVA_HOME"]));
  let command = appiumCmds[0];
  let args = appiumCmds.slice(1).concat(
    ["--log", "appiumServer.log", "--session-override", "--log-level", "debug", "--local-timezone", "--port", port]);
  let proc = childProcess.spawn(command, args);
  return proc;
}

let killAppiumServer = (proc) => {
  console.log("kill Appium server");
  if (proc) {
    proc.kill();
  }
}

let standardOperationCheck = async (caps, serverPort) => {
  let driver = wd.promiseChainRemote(util.format('http://localhost:%d/wd/hub', serverPort));
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
  let java8AppiumServer = null;
  let java9AppiumServer = null;

  before(async () => {
    java8AppiumServer = await launchAppiumServer("1.8", java8Port);
    java9AppiumServer = await launchAppiumServer("9", java9Port);
    await sleep(5000); // TODO smarter wait
  });

  after(() => {
    killAppiumServer(java8AppiumServer);
    killAppiumServer(java9AppiumServer);
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
      wdaLocalPort: 8100, // use its own port to avoid the mixed communication with other iOS devices
    };
    caps[targetKey] = targetValue;
    await standardOperationCheck(caps, java8Port);
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
      wdaLocalPort: 8101, // use its own port to avoid the mixed communication with other iOS devices
    };
    caps[targetKey] = targetValue;
    await standardOperationCheck(caps, java8Port);
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
      wdaLocalPort: 8102, // use its own port to avoid the mixed communication with other iOS devices
    };
    caps[targetKey] = targetValue;
    await standardOperationCheck(caps, java8Port);
  });

  // Android real device must be connected
  forEach([
    ['app', testAppDir + "/ApiDemos-debug.apk", null, null],
    // assume following apps have been installed
    ['appPackage', 'com.android.chrome', 'appActivity', 'com.google.android.apps.chrome.Main']
  ])
  .it("should work with Android real device with Java8: %s=%s", async (targetKey1, targetValue1, targetKey2, targetValue2) => {
    let caps = {
      'platformName': 'Android',
      'deviceName': 'Android',
      'automationName': 'uiautomator2',
    };
    caps[targetKey1] = targetValue1;
    if (targetKey2) {
      caps[targetKey2] = targetValue2;
    };
    await standardOperationCheck(caps, java8Port);
  });

  // Android real device must be connected
  forEach([
    ['app', testAppDir + "/ApiDemos-debug.apk", null, null],
    // assume following apps have been installed
    ['appPackage', 'com.google.android.apps.maps', 'appActivity', 'com.google.android.maps.MapsActivity']
  ])
  .it("should work with Android real device with Java9: %s=%s", async (targetKey1, targetValue1, targetKey2, targetValue2) => {
    let caps = {
      'platformName': 'Android',
      'deviceName': 'Android',
      'automationName': 'uiautomator2',
    };
    caps[targetKey1] = targetValue1;
    if (targetKey2) {
      caps[targetKey2] = targetValue2;
    };
    await standardOperationCheck(caps, java9Port);
  });
});
