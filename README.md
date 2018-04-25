# Overview

Test code to check if Appium works well for the various environments.

# Usage

- Install Node.js and npm.
- Install Java8 and Java9 (both required to pass all tests)
- Install required library by `npm install` in this directory.
- Install Appium server so that it can be called from the command line.
- Connect Android real device and iOS real device for which required Appium set up has been completed.
- Set the following environment variable if necessary.
  - `APPLE_TEAM_ID_FOR_MAGIC_POD`: Your Apple team ID for iOS real device test.
  - `UPDATED_WDA_BUNDLE_ID_FOR_MAGIC_POD`: UpdatedWdaBundleID capabilities which is sometimes required for iOS real device test.
- `npm test`

# Run only specific test

If you want to run only tests for some platform, use the command like the following:

`npm test -- --grep "iOS real device"`

# Run for the Appium server from the latest GtiHub master

Run like the following.

`APPIUM_MAIN_JS_PATH_FOR_MAGIC_POD=/Users/itonozomi/Documents/GitHub/appium/build/lib/main.js npm test`

If `APPIUM_MAIN_JS_PATH_FOR_MAGIC_POD` environment variable is specified,
the test calls main.js by node instead of the Appium executable.
