#-*- coding: utf-8 -*-

from appium import webdriver
from appium.webdriver.common.touch_action import TouchAction
from parameterized import parameterized
import unittest
import os
import subprocess
import time


test_app_dir = os.path.dirname(os.path.abspath(__file__)) + "/test_app"


# Calculate easy-to-understand test name
def custom_name_func(testcase_func, _, param):
    if param.args[0] == "app":
        suffix = os.path.basename(param.args[1])
    else:
        suffix = param.args[1]
    return "{}_{}".format(testcase_func.__name__, parameterized.to_safe_name(suffix))


# Don't execute slow fullReset, so this may be a little unstable.
fast_run_mode = False


# This test checks if the current Appium server and Python client combination works well.
# You need to install command line Appium server preliminarily.
class BasicBehaviorTestBase(unittest.TestCase):
    server_process = None

    # reset Appium server per child class, since Appium server is unstable
    @classmethod
    def setUpClass(cls):
        cls._launch_appium_server()

    @classmethod
    def tearDownClass(cls):
        cls._kill_appium_server()

    def setUp(self):
        print("")  # tweak log output looks

    @classmethod
    def _launch_appium_server(cls):
        print("launch Appium server")
        log_path = "appium_server_{}.log".format(cls.__name__)
        cmd = ["appium", "--log", log_path, "--session-override", "--log-level", "debug", "--local-timezone"]
        cls.server_process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        # TODO smarter wait
        time.sleep(10)

    @classmethod
    def _kill_appium_server(cls):
        print("kill Appium server")
        if cls.server_process is not None:
            cls.server_process.kill()

    @staticmethod
    def _kill_all_existing_ios_related_processes():
        subprocess.Popen(['killall', 'iOS Simulator']).wait()
        subprocess.Popen(['killall', 'com.apple.CoreSimulator.CoreSimulatorService']).wait()
        subprocess.Popen(['killall', 'iproxy']).wait()

    @staticmethod
    def _standard_operation_check(caps):
        wd = webdriver.Remote('http://localhost:4723/wd/hub', caps)

        # check page source method works without error
        print("page source")
        src = wd.page_source
        assert src is not None and not src.isspace()

        # check taking screen shot works without error
        print("screenshot")
        capture = wd.get_screenshot_as_base64()
        assert capture is not None and not src.isspace()

        # try to click first element if clickable
        print("find and click")
        element = wd.find_element_by_xpath("//*[1]")
        if element.is_displayed() and element.is_enabled():
            element.click()

        # check TouchAction works
        print("touch action")
        action = TouchAction(wd)
        action.press(x=50, y=50).move_to(x=100, y=100).release().perform()

        # check rotation works
        # print("orientation")
        # wd.orientation = "LANDSCAPE"
        # wd.orientation = "PORTRAIT"

        # check page source method and taking screen shot again after several operations
        print("page source again")
        src = wd.page_source
        assert src is not None and not src.isspace()
        print("screenshot again")
        capture = wd.get_screenshot_as_base64()
        assert capture is not None and not src.isspace()

        wd.quit()


class IOSSimulator10BehaviorTest(BasicBehaviorTestBase):
    reset_called = False

    @parameterized.expand([
        ('app', test_app_dir + "/TestApp.app"),
        ('bundleId', 'com.apple.Health'),
        ('bundleId', 'com.apple.Maps'),
        ('bundleId', 'com.apple.Preferences')
    ], testcase_func_name=custom_name_func)
    def test(self, target_key, target_value):
        caps = {
            'platformName': 'iOS',
            'platformVersion': '10.3',
            'deviceName': 'iPhone 7',
            'automationName': 'XCUITest',
            'showXcodeLog': True,
            target_key: target_value
        }
        # rest only for first test with this capabilities
        if not IOSSimulator11BehaviorTest.reset_called and not fast_run_mode:
            print("clear state")
            self._kill_all_existing_ios_related_processes()
            caps["fullReset"] = True
            IOSSimulator11BehaviorTest.reset_called = True
        self._standard_operation_check(caps)


class IOSSimulator11BehaviorTest(BasicBehaviorTestBase):
    reset_called = False

    @parameterized.expand([
        ('app', test_app_dir + "/UICatalog.app"),
        ('app', test_app_dir + "/magic_pod_demo_app.app"),
        ('bundleId', 'com.apple.camera'),
        ('bundleId', 'com.apple.news'),
        ('bundleId', 'com.apple.mobileslideshow')
    ], testcase_func_name=custom_name_func)
    def test(self, target_key, target_value):
        caps = {
            'platformName': 'iOS',
            'platformVersion': '11.2',
            'deviceName': 'iPhone 8',
            'automationName': 'XCUITest',
            'showXcodeLog': True,
            target_key: target_value
        }
        # rest only for first test with this capabilities
        if not IOSSimulator10BehaviorTest.reset_called and not fast_run_mode:
            print("clear state")
            self._kill_all_existing_ios_related_processes()
            caps["fullReset"] = True
            IOSSimulator10BehaviorTest.reset_called = True
        self._standard_operation_check(caps)


# - iOS real device must be connected
# - APPLE_TEAM_ID_FOR_MAGIC_POD environment variable must be set
class IOSRealDeviceBehaviorTest(BasicBehaviorTestBase):
    reset_called = False

    @parameterized.expand([
        ('bundleId', 'com.apple.camera'),
        ('bundleId', 'com.apple.mobileslideshow')
    ], testcase_func_name=custom_name_func)
    def test(self, target_key, target_value):
        caps = {
            'platformName': 'iOS',
            'platformVersion': '10.3',  # dummy
            'deviceName': 'iPhone 5',  # dummy
            'udid': 'auto',
            'automationName': 'XCUITest',
            'showXcodeLog': True,
            'xcodeSigningId': 'iPhone Developer',
            'xcodeOrgId': os.environ["APPLE_TEAM_ID_FOR_MAGIC_POD"],
            target_key: target_value
        }
        # rest only for first test with this capabilities
        if not IOSRealDeviceBehaviorTest.reset_called and not fast_run_mode:
            print("clear state")
            self._kill_all_existing_ios_related_processes()
            caps["fullReset"] = True
            IOSRealDeviceBehaviorTest.reset_called = True
        self._standard_operation_check(caps)


# Android real device must be connected
class AndroidRealDeviceBehaviorTest(BasicBehaviorTestBase):
    reset_called = False

    @parameterized.expand([
        ('app', test_app_dir + "/ApiDemos-debug.apk", None, None),
        # assume following apps have been installed
        ('appPackage', 'com.android.chrome', 'appActivity', 'com.google.android.apps.chrome.Main'),
        ('appPackage', 'com.google.android.apps.maps', 'appActivity', 'com.google.android.maps.MapsActivity')
    ], testcase_func_name=custom_name_func)
    def test(self, target_key1, target_value1, target_key2, target_value2):
        caps = {
            'platformName': 'Android',
            'deviceName': 'Android',
            'automationName': 'uiautomator2',
            target_key1: target_value1
        }
        if target_key2 is not None:
            caps[target_key2] = target_value2
        # Rest only for first test with this capabilities
        # Since Android real device clear is not slow, clear is called even for fast_run_mode
        if not AndroidRealDeviceBehaviorTest.reset_called and target_key1 == "app":
            print("clear state")
            caps["fullReset"] = True
            AndroidRealDeviceBehaviorTest.reset_called = True
        self._standard_operation_check(caps)

