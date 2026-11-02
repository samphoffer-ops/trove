// Makes the SDK 54 app build with Xcode 27 and launch on iOS 27.
//
// iOS 27 requires the UIScene lifecycle: an app without a scene manifest traps at
// launch in _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption. The
// SDK 54 AppDelegate that prebuild generates still uses a plain UIWindow, so this
// plugin adds a scene manifest and a SceneDelegate that adopts AppDelegate's window.
// Expo SDK 58 ships its own SceneDelegate; remove this plugin when we upgrade (#82).
const { withAppDelegate, withInfoPlist, withPodfile } = require('expo/config-plugins');

const MARKER_NAME = '@trove/ios-scene-lifecycle';
const MARKER = `// ${MARKER_NAME}`;
const PODFILE_MARKER = `# ${MARKER_NAME}`;

const SCENE_DELEGATE = `
${MARKER}
// Attaches the window AppDelegate already built to the scene, and forwards deep
// links and universal links, which UIKit sends to the scene instead of the app.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appWindow = (UIApplication.shared.delegate as? AppDelegate)?.window else { return }
    appWindow.windowScene = windowScene
    appWindow.frame = windowScene.coordinateSpace.bounds
    appWindow.makeKeyAndVisible()
    window = appWindow

    if let url = connectionOptions.urlContexts.first?.url {
      open(url)
    }
    if let userActivity = connectionOptions.userActivities.first {
      self.scene(scene, continue: userActivity)
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else { return }
    open(url)
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = UIApplication.shared.delegate?.application?(
      UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }

  private func open(_ url: URL) {
    _ = UIApplication.shared.delegate?.application?(UIApplication.shared, open: url, options: [:])
  }
}
`;

function withSceneManifest(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return config;
  });
}

function withSceneDelegate(config) {
  return withAppDelegate(config, (config) => {
    const { modResults } = config;
    if (modResults.language !== 'swift') {
      throw new Error('withIosSceneLifecycle expects a Swift AppDelegate');
    }
    if (!modResults.contents.includes(MARKER)) {
      modResults.contents = modResults.contents.trimEnd() + '\n' + SCENE_DELEGATE;
    }
    return config;
  });
}

// Xcode 27 refuses to build any target below iOS 15. expo-build-properties sets the
// Podfile platform, but some pod targets (SDWebImage, RNSVG and AsyncStorage resource
// bundles) keep their own older targets, so raise them after install.
const PODFILE_FIX = `
    ${PODFILE_MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        if build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < 15.1
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
        end
      end
    end`;

function withPodDeploymentTargets(config) {
  return withPodfile(config, (config) => {
    const { modResults } = config;
    if (!modResults.contents.includes(PODFILE_MARKER)) {
      const anchor = 'post_install do |installer|';
      if (!modResults.contents.includes(anchor)) {
        throw new Error('withIosSceneLifecycle could not find post_install in the Podfile');
      }
      modResults.contents = modResults.contents.replace(anchor, anchor + PODFILE_FIX);
    }
    return config;
  });
}

module.exports = function withIosSceneLifecycle(config) {
  return withPodDeploymentTargets(withSceneDelegate(withSceneManifest(config)));
};
