# Overview

Test code to check if Appium works well for the various environments.

# Usage

- Install Node.js and npm.
- Install Java8 and Java9 (both required to pass all tests)
- Install required library by `npm install` in this directory.
- Install Appium server so that it can be called from the command line.
- Connect Android real device and iOS real device for which required Appium set up has been completed.
- Set your Apple team ID to `APPLE_TEAM_ID_FOR_MAGIC_POD` environment variable.
- `npm test`

If you want to run only tests for some platform, use the command like the following:

`npm test -- --grep "iOS real device"`
