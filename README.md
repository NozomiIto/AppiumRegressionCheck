# Overview

Test code to check if Appium works well for the various environments.

# Usage

- Install Node.js and npm.
- Install Java8 and Java9 (both required to pass all tests)
- Install required library by `npm install` in this directory.
- Install Appium server so that it can be called from the command line.
- Connect Android real device and iOS real device for which required Appium set up has been completed.
- Create AVD (= Android emulator) used for the test (don't need to launch it).
- Set the following environment variable if necessary.
  - `APPLE_TEAM_ID_FOR_MAGIC_POD`: Your Apple team ID for iOS real device test.
  - `UPDATED_WDA_BUNDLE_ID_FOR_MAGIC_POD`: UpdatedWdaBundleID capabilities which is sometimes required for iOS real device test.
  - `AVD10_FOR_MAGIC_POD`: The name of the existing AVD (= Android emulator) for Android 10 emulator test like `Nexus_5_API_29`.
  - `AVD9_FOR_MAGIC_POD`: Similar to AVD7_FOR_MAGIC_POD,  like `Pixel_API_28`.
- `npm test`

# Run only specific test

If you want to run only tests for some platform, use the command like the following:

`npm test -- --grep "iOS real device"`

# Run for the Appium server from the latest GtiHub master

Run like the following.

`APPIUM_MAIN_JS_PATH_FOR_MAGIC_POD=/Users/itonozomi/Documents/GitHub/appium/build/lib/main.js npm test`

If `APPIUM_MAIN_JS_PATH_FOR_MAGIC_POD` environment variable is specified,
the test calls main.js by node instead of the Appium executable.

# Our test result

- Appium 1.18.0: passed all tests, but seems to have [a problem](https://github.com/appium/appium/issues/14586).
- Appium 1.17.1: passed all tests. This version is required to make iOS13.4 webview tests work
- Appium 1.17.0: passed all tests
- Appium 1.16.0: passed all tests
- Appium 1.15.0: passed all tests, but seems to has some problems like [this](https://github.com/Magic-Pod/AppiumRegressionCheck/issues/26) and [this](https://github.com/Magic-Pod/AppiumRegressionCheck/issues/27) and [this](https://github.com/appium/appium/issues/13302) and [this](https://github.com/appium/appium/issues/13288).
- Appium 1.14.0: passed all tests
- Appium 1.13.0: found [a problem](https://github.com/appium/WebDriverAgent/pull/166)
- Appium 1.12.1: passed all tests, but has [small problem](https://github.com/appium/appium/issues/12504)
