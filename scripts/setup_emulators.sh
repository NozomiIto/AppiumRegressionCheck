avdmanager create avd --force -n magic_pod_emulator29 -k 'system-images;android-29;google_apis;x86' -d 'Nexus 5X'
avdmanager create avd --force -n magic_pod_emulator30 -k 'system-images;android-30;google_apis;x86' -d pixel
emulator -avd magic_pod_emulator29 &
emulator -avd magic_pod_emulator30 &
