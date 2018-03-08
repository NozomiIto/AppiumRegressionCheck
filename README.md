# Overview

Test code to check if Appium works well for the various environments.

# Usage

- Install Python and pip.
- Install required library by `pip install -r requirements.txt`.
- Install Appium server so that it can be called from the command line.
- Go to the top directory of this project.
- Connect Android real device and iOS real device for which required Appium set up has been completed.
- `nosetests -sv .`

If you can run only test for some platform, use the command like the following:

`nosetests -sv basic_behavior_test.py:IOSSimulator10BehaviorTest`
