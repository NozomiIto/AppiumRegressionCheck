/* eslint no-console: 0*/

'use strict';

const chai = require("chai");
const assert = chai.assert;
const forEach = require('mocha-each');
const sizeOf = require('image-size');
const rimraf = require("rimraf");
const wd = require("wd");
const webdriverio = require("webdriverio");
const TouchAction = wd.TouchAction;
const util = require("util");
const path = require("path");
const childProcess = require("child_process");
const teenProcess = require('teen_process');
const requestPromise = require("request-promise");
const xpath = require('xpath');
const xmlDom = require('xmldom');
const nodeSimctl = require('node-simctl');

const appiumCmds = process.env.APPIUM_MAIN_JS_PATH_FOR_MAGIC_POD ? ["node", process.env.APPIUM_MAIN_JS_PATH_FOR_MAGIC_POD] : ["appium"];
const testAppDir = __dirname + "/../test_app";
const java8Port = 4723;
const java9Port = 4724;
// use different ports to avoid the mixed communication with other iOS devices
const iosSimulatorWdaPort = 8100;
const iosRealDeviceWdaPort = 8101;
// TODO session attach/detach test

function iOS13SimulatorForUdidBaseCapabilities (udid) {
  return {
    platformName: 'iOS',
    platformVersion: '9.9',  // actually dummy
    deviceName: 'dummy',
    udid: udid,
    automationName: 'XCUITest',
    showXcodeLog: true,
    useJSONSource: true, // more stable and faster
    wdaLocalPort: iosSimulatorWdaPort,
    language: 'ja'
  };
}

function iOS13SimulatorBaseCapabilities () {
  return {
    platformName: 'iOS',
    platformVersion: '13.1',
    deviceName: 'iPhone 8',
    automationName: 'XCUITest',
    showXcodeLog: true,
    useJSONSource: true, // more stable and faster
    wdaLocalPort: iosSimulatorWdaPort,
    language: 'ja'
  };
}

let alreadyRunIOSRealDeviceWithUseNewWDA = false; // for https://github.com/Magic-Pod/AppiumRegressionCheck/issues/26

function iOSRealDeviceBaseCapabilities () {
  let caps = {
    platformName: 'iOS',
    platformVersion: '9.9',  // actually dummy
    deviceName: 'real device', // dummy
    udid: 'auto',
    automationName: 'XCUITest',
    showXcodeLog: true,
    useJSONSource: true, // more stable and faster
    xcodeSigningId: 'iPhone Developer',
    xcodeOrgId: process.env.APPLE_TEAM_ID_FOR_MAGIC_POD,
    wdaLocalPort: iosRealDeviceWdaPort
  };
  if (process.env.UPDATED_WDA_BUNDLE_ID_FOR_MAGIC_POD) {
    caps.updatedWDABundleId = process.env.UPDATED_WDA_BUNDLE_ID_FOR_MAGIC_POD;
  }
  if (!alreadyRunIOSRealDeviceWithUseNewWDA) {
    alreadyRunIOSRealDeviceWithUseNewWDA = true;
    caps.useNewWDA = true;
  }
  return caps;
}

async function getAndroidRealDeviceUdid() {
  if (process.env.ANDROID_HOME) {
    var androidHome = process.env.ANDROID_HOME;
  } else {
    var androidHome = path.join(process.env["HOME"], "Library/Android/sdk");
  }
  var adbPath = path.join(androidHome, "platform-tools/adb");
  let adbResult = await teenProcess.exec(adbPath, ["devices"]);
  let stdOut = adbResult.stdout.trim();
  let deviceList = stdOut.split("\n");
  // skip first line since the line is the header
  for (var i = 1; i < deviceList.length; i++) {
    let deviceDef = deviceList[i].trim();
    if (!deviceDef) {
      continue;
    }
    let deviceName = deviceDef.split(/\s+/)[0].trim();
    if (deviceName.indexOf("emulator") == -1) {
      return deviceName;
    }
  }
  throw new Error(util.format("no Android real device is connected:\n%s", stdOut));
}

async function androidRealDeviceBaseCapabilities () {
  let udid = await getAndroidRealDeviceUdid();
  return {
    'platformName': 'Android',
    'deviceName': 'Android',
    'automationName': 'uiautomator2',
    'udid': udid,
    // Since Magic Pod always skip the initial activity wait so that users don't need to care about appWaitActivity,
    // we also skip this wait by specifying 'appWaitActivity': '*'
    'appWaitActivity': '*',
    'unicodeKeyboard': true,
    'resetKeyboard': true,
  };
}

function android7EmulatorBaseCapabilities () {
  return {
    'platformName': 'Android',
    'deviceName': 'Android Emulator',
    'automationName': 'uiautomator2',
    'avd': process.env.AVD7_FOR_MAGIC_POD,
    // Since Magic Pod always skip the initial activity wait so that users don't need to care about appWaitActivity,
    // we also skip this wait by specifying 'appWaitActivity': '*'
    'appWaitActivity': '*',
    'unicodeKeyboard': true,
    'resetKeyboard': true,
  }
}

function android8EmulatorBaseCapabilities () {
  return {
    'platformName': 'Android',
    'deviceName': 'Android Emulator',
    'automationName': 'uiautomator2',
    'avd': process.env.AVD8_FOR_MAGIC_POD,
    // Since Magic Pod always skip the initial activity wait so that users don't need to care about appWaitActivity,
    // we also skip this wait by specifying 'appWaitActivity': '*'
    'appWaitActivity': '*',
    'unicodeKeyboard': true,
    'resetKeyboard': true,
  }
}

async function androidEspressoBaseCapabilities () {
 let udid = await getAndroidRealDeviceUdid();
  return {
    'platformName': 'Android',
    'deviceName': 'Android',
    'automationName': 'Espresso',
    'udid': udid,
    // TODO remove this comment once https://github.com/appium/appium-espresso-driver/pull/473 is published
    // 'appWaitActivity': '*',
    'unicodeKeyboard': true,
    'resetKeyboard': true,
  };
}

function sleep (milliSeconds) {
  return new Promise(resolve => setTimeout(resolve, milliSeconds));
}

async function getJavaHomeValue (versionStr) {
  let javaHomeResult = await teenProcess.exec("/usr/libexec/java_home", ["-v", versionStr]);
  let stdOut = javaHomeResult.stdout;
  if (stdOut) {
    return stdOut.trim();
  }
  throw new Error(util.format("JAVA_HOME for % is not found", versionStr));
}

// returns: process object
async function launchAppiumServer (javaVersion, port) {
  process.env.JAVA_HOME = await getJavaHomeValue(javaVersion);
  console.log(util.format("launch Appium server with JAVA_HOME=%s", process.env.JAVA_HOME));
  let command = appiumCmds[0];
  let logFileName = util.format("appiumServer_Java%s.log", javaVersion);
  let args = appiumCmds.slice(1).concat(
    ["--log", logFileName, "--log-level", "debug", "--local-timezone", "--port", port]);
  let proc = childProcess.spawn(command, args);
  proc.on('error', (err) => {
    console.log('Failed to start Appium server:' + err);
  });
  return proc;
}

function killAppiumServer (proc) {
  if (proc) {
    console.log("kill Appium server");
    proc.kill("SIGKILL");
    console.log("killed Appium server");
  }
}

async function checkScreenshotWorks (driver) {
  let image = await driver.takeScreenshot();
  assert.isTrue(!!image); // not null nor empty
}

async function checkSessionLessScreenshotWorks (driver, wdaPort) {
  let opt = {
    method: 'GET',
    url: util.format("http://localhost:%d/screenshot", wdaPort)
  };
  let body = await requestPromise(opt);
  assert.isTrue(!!body); // not null
}

function getFirstElementChild (parent) {
  let childNodes = parent.childNodes;
  for (let i = 0; i < childNodes.length; i++) {
    let childNode = childNodes[i];
    if (childNode.constructor.name == "Element") {
      return childNode;
    }
  }
  return null;
}

// returns: source string in XML or description format
async function checkSourceWorks (driver, isOS) {
  if (isOS) {
    return  await driver.execute("mobile: source", {format: "description"});
  } else {
    let xmlStr = await driver.source();
    let doc = new xmlDom.DOMParser().parseFromString(xmlStr);
    // check that the tree has a certain depth
    let element1 = getFirstElementChild(doc.documentElement);
    let element2 = getFirstElementChild(element1);
    assert.isTrue(!!element2, element1); // not null
    return xmlStr;
  }
}

// returns: Document object representing XML tree
async function checkSessionLessSourceWorks (driver, wdaPort) {
  let opt = {
    method: 'GET',
    url: util.format("http://localhost:%d/source", wdaPort)
  };
  let result = await requestPromise(opt);
  let xmlStr = JSON.parse(result).value;
  try {
    let doc = new xmlDom.DOMParser().parseFromString(xmlStr);
    // check that the tree has a certain depth
    let element1 = getFirstElementChild(doc.documentElement);
    let element2 = getFirstElementChild(element1);
    assert.isTrue(!!element2, element1); // not null
    return doc
  } catch (e) {
    console.log(e);
    console.log("invalid source XML");
    console.log(xmlStr);
    throw e;
  }
}

async function simpleCheck (caps, serverPort, additionalCheck) {
  let driver = wd.promiseChainRemote(util.format('http://localhost:%d/wd/hub', serverPort));
  try {
    await driver.init(caps);

    console.log("screenshot");
    await checkScreenshotWorks(driver);
    console.log("page source");
    await checkSourceWorks(driver);

    if (additionalCheck) {
      // check lock/unlock behavior just for simulator and emulator
      // (since unlock command for the real device requires the change for the unlock password of the device
      // and it is troublesome)
      if ((caps.platformName == "iOS" && caps.deviceName != 'real device')
          || (caps.platformName == "Android" && caps.deviceName == "Android Emulator")) {
        console.log("lock");
        await driver.lock();
        await sleep(1000);
        console.log("unlock");
        await driver.unlock();
      }

      console.log("close app");
      await driver.closeApp();
      await sleep(1000);
      console.log("launch app");
      await driver.launchApp();
    }

    // try to click one of the elements if clickable
    console.log("find and click");
    const targetClassName = caps.platformName === "iOS" ? "XCUIElementTypeOther" : "android.widget.FrameLayout";

    const element = await driver.elementByXPathOrNull(util.format("//%s[1]", targetClassName));
    if (element == null) {
      console.log("no element is found");
    } else {
      if (await element.isDisplayed() && await element.isEnabled()) {
        await element.click();
      }
    }

    if (additionalCheck) {
      // check TouchAction works
      console.log("touch action");
      let action = new TouchAction(driver);
      action.press({x: 50, y:50}).moveTo({x: 100, y: 100}).release();
      await driver.performTouchAction(action);

      // check getting the focused activity works for Android
      if (caps.platformName == "Android") {
        console.log("package and activity");
        let pkg = await driver.getCurrentPackage();
        assert.isTrue(!!pkg); // not null nor empty
        if (caps.appPackage) {
          assert.equal(pkg, caps.appPackage);
        }
        let activity = await driver.getCurrentActivity();
        assert.isTrue(!!activity); // not null nor empty
      }

      // TODO check rotation works
      // console.log("orientation");
      // await driver.setOrientation("LANDSCAPE");
      // await driver.setOrientation("PORTRAIT");

      // check taking screen shot and page source command again after several operations
      console.log("screenshot again");
      await checkScreenshotWorks(driver);
      console.log("page source again");
      await checkSourceWorks(driver, caps.platformName == "iOS");
    }
  } finally {
    try {
      await driver.quit();
    } catch (e) {
      console.log(e); // ignore
    }
  }
}

async function iOSAppiumRegressionTestAppCheck (caps, wdaPort) {
  assert.isTrue(caps.app.includes("AppiumRegressionTestApp"));
  assert.isTrue(caps.fullReset);
  let driver = wd.promiseChainRemote(util.format('http://localhost:%d/wd/hub', java8Port));
  try {
    await driver.init(caps);

    console.log("screenshot for system alert");
    await checkScreenshotWorks(driver);
    console.log("page source for system alert");
    await checkSourceWorks(driver, true);
    console.log("session-less screenshot for system alert");
    await checkSessionLessScreenshotWorks(driver, wdaPort);
    console.log("session-less source for system alert");
    await checkSessionLessSourceWorks(driver, wdaPort);

    await driver.acceptAlert(); // currently the alert must be displayed

    console.log("session-less screenshot for normal page");
    await checkSessionLessScreenshotWorks(driver, wdaPort);
    console.log("session-less source for normal page");
    await checkSessionLessSourceWorks(driver, wdaPort);

    await driver.backgroundApp(-1);

    console.log("screenshot for home");
    await checkScreenshotWorks(driver, wdaPort);
    console.log("source for home");
    await checkSourceWorks(driver, true);
  } finally {
    try {
      await driver.acceptAlert(); // try to close in case acceptAlert is not called
    } catch (e) {
      // ignore
    }
    try {
      await driver.quit();
    } catch (e) {
      console.log(e); // ignore
    }
  }
}

// This test checks if the current Appium server and client combination works well.
// You need to install command line Appium server preliminarily.
// - For iOS real device test, APPLE_TEAM_ID_FOR_MAGIC_POD environment variable must be set
describe("Appium", function () {
  this.timeout(3600000);  // mocha timeout
  let java8AppiumServer = null;
  let java9AppiumServer = null;

  before(async function () {
    java8AppiumServer = await launchAppiumServer("1.8", java8Port);
    java9AppiumServer = await launchAppiumServer("9", java9Port);
    await sleep(12000); // TODO smarter wait
  });

  after(async function () {
    killAppiumServer(java8AppiumServer);
    killAppiumServer(java9AppiumServer);
    await sleep(3000); // TODO smarter wait
  });

  describe("simpleCheck", function () {
    forEach([
      ['app', testAppDir + "/TestApp.app", true, false],
      ['app', testAppDir + "/UICatalog.app", false, true],
      ['app', testAppDir + "/magic_pod_demo_app.app", false, false],
      ['bundleId', 'com.apple.Maps', false, false],
      ['bundleId', 'com.apple.Preferences', false, true],
      ['bundleId', 'com.apple.mobileslideshow', true, false]
    ])
    .it("should work with iOS simulator13: %s=%s", async (targetKey, targetValue, additionalCheck, reduceMotion) => {
      let caps = iOS13SimulatorBaseCapabilities();
      caps[targetKey] = targetValue;
      if (reduceMotion) {
        caps["reduceMotion"] = true;
      }
      await simpleCheck(caps, java8Port, additionalCheck);
    });

    forEach([
      ['bundleId', 'com.apple.Preferences', false]
    ])
    .it("should work with headless udid iOS simulator13: %s=%s", async (targetKey, targetValue, additionalCheck) => {
      let devices = (await nodeSimctl.getDevices())["13.1"];
      devices = devices.filter((device) => device.name.indexOf("iPhone 8") != -1);
      if (devices.length == 0) {
        throw new Error("cannot find the simulator for iOS 13.1 and iPhone 8. Please prepare it.");
      }
      let udid = devices[0].udid;
      let caps = iOS13SimulatorForUdidBaseCapabilities(udid);
      caps.isHeadless = true
      caps.reduceMotion = true;
      caps[targetKey] = targetValue;
      await simpleCheck(caps, java8Port, additionalCheck);
    });

    forEach([
      ['app', testAppDir + "/TestApp.ipa", true],
      ['bundleId', 'com.apple.camera', false],
      ['bundleId', 'com.apple.mobilecal', false]
    ])
    .it("should work with iOS real device: %s=%s", async (targetKey, targetValue, additionalCheck) => {
      let caps = iOSRealDeviceBaseCapabilities();
      caps[targetKey] = targetValue;
      await simpleCheck(caps, java8Port, additionalCheck);
    });

    // Android real device must be connected
    forEach([
      ['app', testAppDir + "/ApiDemos-debug.apk", null, null, true],
    ])
    .it("should work with Android real device with Java8: %s=%s",
        async (targetKey1, targetValue1, targetKey2, targetValue2, additionalCheck) => {
          let caps = await androidRealDeviceBaseCapabilities();
          caps[targetKey1] = targetValue1;
          if (targetKey2) {
            caps[targetKey2] = targetValue2;
          }
          await simpleCheck(caps, java8Port, additionalCheck);
        });

    // Android real device must be connected
    forEach([
      // assume following apps have been installed
      ['appPackage', 'com.google.android.apps.maps', 'appActivity', 'com.google.android.maps.MapsActivity', true]
    ])
    .it("should work with Android real device with Java9: %s=%s",
        async (targetKey1, targetValue1, targetKey2, targetValue2, additionalCheck) => {
          let caps = await androidRealDeviceBaseCapabilities();
          caps[targetKey1] = targetValue1;
          if (targetKey2) {
            caps[targetKey2] = targetValue2;
          }
          await simpleCheck(caps, java9Port, additionalCheck);
        });

    // AVD must have been created
    forEach([
      // assume following apps have been installed
      ['appPackage', 'com.google.android.apps.maps', 'appActivity', 'com.google.android.maps.MapsActivity', true]
    ])
    .it("should work with Android7 emulator with Java8: %s=%s",
        async (targetKey1, targetValue1, targetKey2, targetValue2, additionalCheck) => {
          let caps = android7EmulatorBaseCapabilities();
          caps[targetKey1] = targetValue1;
          if (targetKey2) {
            caps[targetKey2] = targetValue2;
          }
          await simpleCheck(caps, java8Port, additionalCheck);
        });

    // AVD must have been created
    forEach([
      ['app', testAppDir + "/ApiDemos-debug.apk", null, null, true]
    ])
    .it("should work with Android7 emulator with Java9: %s=%s",
        async (targetKey1, targetValue1, targetKey2, targetValue2, additionalCheck) => {
          let caps = android7EmulatorBaseCapabilities();
          caps[targetKey1] = targetValue1;
          if (targetKey2) {
            caps[targetKey2] = targetValue2;
          }
          await simpleCheck(caps, java9Port, additionalCheck);
        });

    // AVD must have been created
    forEach([
      ['app', testAppDir + "/ApiDemos-debug.apk", null, null, true]
    ])
    .it("should work with Android8 emulator with Java8: %s=%s",
        async (targetKey1, targetValue1, targetKey2, targetValue2, additionalCheck) => {
          let caps = android8EmulatorBaseCapabilities();
          caps[targetKey1] = targetValue1;
          if (targetKey2) {
            caps[targetKey2] = targetValue2;
          }
          await simpleCheck(caps, java8Port, additionalCheck);
        });

    // AVD must have been created
    forEach([
      // assume following apps have been installed
      ['appPackage', 'com.android.vending', 'appActivity', '.AssetBrowserActivity', true]
    ])
    .it("should work with Android8 emulator with Java9: %s=%s",
        async (targetKey1, targetValue1, targetKey2, targetValue2, additionalCheck) => {
          let caps = android8EmulatorBaseCapabilities();
          caps[targetKey1] = targetValue1;
          if (targetKey2) {
            caps[targetKey2] = targetValue2;
          }
          await simpleCheck(caps, java9Port, additionalCheck);
        });
  });

  describe("iOS screenshot and source should work in various situation", function () {
    it("on iOS simulator13", async function () {
      let caps = iOS13SimulatorBaseCapabilities();
      caps.app = testAppDir + "/AppiumRegressionTestApp.app";
      caps.fullReset = true;
      await iOSAppiumRegressionTestAppCheck(caps, iosSimulatorWdaPort);
    });

    it("on iOS real device", async function () {
      let caps = iOSRealDeviceBaseCapabilities();
      caps.app = testAppDir + "/AppiumRegressionTestApp.ipa";
      caps.fullReset = true;
      await iOSAppiumRegressionTestAppCheck(caps, iosRealDeviceWdaPort);
    });
  });

  describe("iOS source contents should be valid", function () {
    it("on iOS simulator13", async function () {
      let caps = iOS13SimulatorBaseCapabilities();
      caps.app = testAppDir + "/magic_pod_demo_app.app";
      let driver = wd.promiseChainRemote(util.format('http://localhost:%d/wd/hub', java8Port));
      try {
        await driver.init(caps);
        await sleep(2000);
        console.log("page source");
        let tree1 = await checkSourceWorks(driver, true);
        // TODO better check
        assert.include(tree1, "}}, identifier: 'ユーザー登録'");
        assert.include(tree1, "}}, label: '登録'");

        // we have experienced the bug of page source command which happens after taking screenshot
        console.log("screenshot");
        await checkScreenshotWorks(driver);

        console.log("page source　again");
        let tree2 = await checkSourceWorks(driver, true);
        // TODO better check
        assert.include(tree2, "}}, identifier: 'ユーザー登録'");
        assert.include(tree2, "}}, label: '登録'");
      } finally {
        await driver.quit();
      }
    });
  });

  describe("mobile: scroll should work", function () {
    it("on iOS simulator13", async function () {
      let caps = iOS13SimulatorBaseCapabilities();
      caps.app = testAppDir + "/UICatalog.app";
      let driver = wd.promiseChainRemote(util.format('http://localhost:%d/wd/hub', java8Port));
      try {
        await driver.init(caps);
        let element = await driver.elementByXPath("//XCUIElementTypeStaticText[@name='Search Bars']/parent::*");
        await driver.execute("mobile: scroll", {element: element, toVisible: true});
        element = await driver.elementByXPath("//XCUIElementTypeStaticText[@name='Search Bars']/parent::*");
        await element.click();
        await driver.elementById("Default");
        await driver.elementById("Custom");
      } finally {
        await driver.quit();
      }
    });
  });

  let uiCatalogMoveToTest = async function(caps) {
    let driver = wd.promiseChainRemote(util.format('http://localhost:%d/wd/hub', java8Port));
    try {
      await driver.init(caps);
      let application = await driver.elementByClassName("XCUIElementTypeApplication");
      let screenSize = await application.getSize();
      let centerX = Math.floor(screenSize["width"] / 2);
      let centerY = Math.floor(screenSize["height"] / 2);
      for (let i = 0; i < 8; i++) {
        console.log("scroll");
        // scroll happens only when moveTo handles its argument as the absolute position
        let action = new TouchAction(driver);
        action.press({x:centerX, y:centerY}).wait({ms: 500}).moveTo({x:centerX, y:(centerY-150)}).release();
        await driver.performTouchAction(action);
        await sleep(1000);
      }
      await sleep(3000);
      let searchBars = await driver.elementById("Search Bars");
      await searchBars.click();
      await driver.elementById("Default");
    } finally {
      await driver.quit();
    }
  }

  describe("multiple test launches should not fail", function() {
    it("on iOS real device", async function() {
      for (let i = 0; i < 4; i++) {
        let caps = iOSRealDeviceBaseCapabilities();
        if (i % 2 == 0) {
          caps.app = testAppDir + "/UICatalog.ipa";
        } else {
          caps.app = testAppDir + "/TestApp.ipa";
        }
        caps.notReset = true;
        console.log("launch app");
        let driver = wd.promiseChainRemote(util.format('http://localhost:%d/wd/hub', java8Port));
        try {
          await driver.init(caps);
        } finally {
          driver.quit();
        }
      }
    });
  })

  describe("moveTo action should work", function () {
    it("on iOS simulator13", async function () {
      let caps = iOS13SimulatorBaseCapabilities();
      caps.app = testAppDir + "/UICatalog.app";
      await uiCatalogMoveToTest(caps);
    });

    it("on Android", async function () {
      let caps = await androidRealDeviceBaseCapabilities();
      caps.noReset = false; // reset app state
      caps.app = testAppDir + "/ApiDemos-debug.apk";
      let driver = wd.promiseChainRemote(util.format('http://localhost:%d/wd/hub', java8Port));
      try {
        await driver.init(caps);
        let graphics = await driver.elementByXPath("//android.widget.TextView[@content-desc='Graphics']");
        await graphics.click();
        for (let i = 0; i < 8; i++) {
          console.log("scroll");
          // scroll happens only when moveTo handles its argument as the absolute position
          let action = new TouchAction(driver);
          action.press({x: 200, y:200}).wait({ms: 500}).moveTo({x:200, y:0}).release();
          await driver.performTouchAction(action);
          await sleep(1000);
        }
        // assert the scroll was actually happened
        // and "Xfermodes" line, which occurs only when the page is scrolled, can be clicked
        let xfermodes = await driver.elementByXPath("//android.widget.TextView[@content-desc='Xfermodes']");
        await xfermodes.click();
        await driver.elementByXPath("//android.widget.TextView[@text='Graphics/Xfermodes']");
      } finally {
        await driver.quit();
      }
    });
  });

  describe("parallel Appium server run should work", function () {
    it("on iOS simulator13", async function () {
      rimraf.sync(__dirname + "/../DerivedData1");
      rimraf.sync(__dirname + "/../DerivedData2");
      let caps1 = iOS13SimulatorBaseCapabilities();
      let caps2 = iOS13SimulatorBaseCapabilities();
      caps1.wdaLocalPort = 8102;
      caps2.wdaLocalPort = 8103;
      caps1.derivedDataPath = __dirname + "/../DerivedData1";
      caps2.derivedDataPath = __dirname + "/../DerivedData2";
      caps1.deviceName = 'iPhone 8';
      caps2.deviceName = 'iPhone 8 Plus';
      caps1.isHeadless = true;
      caps2.isHeadless = true;
      caps1.app = testAppDir + "/magic_pod_demo_app.app";
      caps2.app = testAppDir + "/magic_pod_demo_app.app";
      // use different Appium servers
      await Promise.all([simpleCheck(caps1, java8Port, false), simpleCheck(caps2, java9Port, false)]);
    });
  });

  describe("uiAutomator2 and Espresso combination should work", function() {
    it("on Android real device", async function() {
      let eCaps = await androidEspressoBaseCapabilities();
      eCaps.app = testAppDir + "/ApiDemos-debug.apk";

      let uCaps = await androidRealDeviceBaseCapabilities();
      uCaps.appPackage = "dummy";
      uCaps.appActivity = "dummy";
      uCaps.autoLaunch = false;

      let cleanUp = false; // this test will work well by specifying true here
      if (cleanUp) {
        console.log("UiAutomator2: start cleanup");
        let uDriver = wd.promiseChainRemote(util.format('http://localhost:%d/wd/hub', java9Port));
        await uDriver.init(uCaps);
        await uDriver.quit();
        console.log("UiAutomator2: cleaned up");
      }

      let eDriver = await wd.promiseChainRemote(util.format('http://localhost:%d/wd/hub', java9Port));
      await eDriver.init(eCaps);
      console.log("Espresso init: finished");
      let uDriver = wd.promiseChainRemote(util.format('http://localhost:%d/wd/hub', java9Port));
      await uDriver.init(uCaps);
      console.log("UiAutomator2 init: finished");
      try {
        const eElement = await eDriver.elementByXPath("//android.widget.TextView[@content-desc='Graphics']");
        await eElement.click();
        await sleep(2000);
        let uElement = await uDriver.elementByXPath("//android.widget.TextView[@content-desc='Arcs']");
        await uElement.click();
      } finally {
        let quit = false; // this test will work well by specifying true here
        if (quit) {
          if (uDriver) {
            await uDriver.quit();
          }
          if (eDriver) {
            await eDriver.quit();
          }
        }
      }
    });
  });
});
