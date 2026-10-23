import Cocoa
import Darwin
import Foundation
import Security
import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate {
    private var webPort = 3080
    private var window: NSWindow!
    private var webView: WKWebView!
    private var oauthWebView: WKWebView?
    private var dshProcess: Process?
    private var logHandle: FileHandle?
    private var stopping = false
    private var readyURL: URL?
    private var localAuthToken: String?
    private var logPipe: Pipe?
    private var runtimeRestartAttempts = 0
    private var runtimePollGeneration = 0
    private let maxRuntimeRestartAttempts = 5
    private let runtimeStopGraceSeconds = 3.0

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        createWindow()
        startDockyardRuntime()
    }

    func applicationWillTerminate(_ notification: Notification) {
        stopping = true
        stopDockyardRuntime()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
        }
        return true
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        NSApp.hide(nil)
        return false
    }

    private func createWindow() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        configuration.userContentController.addUserScript(WKUserScript(
            source: """
            (() => {
              document.addEventListener(\"mousedown\", (event) => {
                const element = event.target instanceof Element ? event.target.closest('[role=\"menuitem\"], [role=\"menuitemradio\"]') : null;
                if (element) event.preventDefault();
              }, true);
            })();
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        ))
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.autoresizingMask = [.width, .height]

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1280, height: 820),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Dockyard DSH"
        window.minSize = NSSize(width: 900, height: 620)
        window.contentView = webView
        window.delegate = self
        window.center()
        installApplicationMenu()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        showLoading(message: "Starting Dockyard DSH…")
    }

    private func installApplicationMenu() {
        let mainMenu = NSMenu()
        let appMenuItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "退出 Dockyard DSH", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appMenuItem.submenu = appMenu
        mainMenu.addItem(appMenuItem)

        let editMenuItem = NSMenuItem()
        let editMenu = NSMenu(title: "编辑")
        editMenu.addItem(withTitle: "剪切", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "复制", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "粘贴", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "全选", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editMenuItem.submenu = editMenu
        mainMenu.addItem(editMenuItem)
        NSApp.mainMenu = mainMenu
    }

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        guard let url = navigationAction.request.url else { return nil }
        if url.scheme?.lowercased() != "about" {
            openAuthorizationURL(url)
            return nil
        }

        let popup = WKWebView(frame: .zero, configuration: configuration)
        popup.navigationDelegate = self
        popup.uiDelegate = self
        popup.autoresizingMask = [.width, .height]

        // Keep the popup WebView off-screen. The authorization URL is handed to
        // the system browser in the navigation delegate below; creating and
        // destroying a second AppKit window during WebKit navigation can crash
        // macOS 27's WebKit bridge.
        oauthWebView = popup
        return popup
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        if webView === oauthWebView,
           let url = navigationAction.request.url,
           url.scheme?.lowercased() == "http" || url.scheme?.lowercased() == "https" {
            let popupWebView = oauthWebView
            oauthWebView = nil
            decisionHandler(.cancel)
            DispatchQueue.main.async { [weak self, popupWebView] in
                self?.openAuthorizationURL(url)
                _ = popupWebView
            }
            return
        }
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        let scheme = url.scheme?.lowercased()
        let isMainFrame = navigationAction.targetFrame?.isMainFrame ?? false

        if isMainFrame {
            // Only the exact embedded local service origin may render inside the
            // app window. External web pages open in the system browser instead,
            // and every other scheme (file:, javascript:, custom schemes…) is
            // blocked outright.
            if isLocalServiceOrigin(url) {
                decisionHandler(.allow)
            } else if scheme == "http" || scheme == "https" {
                decisionHandler(.cancel)
                let externalURL = url
                DispatchQueue.main.async { [weak self] in
                    self?.openAuthorizationURL(externalURL)
                }
            } else if scheme == "about" {
                // The loading/error screens are installed via loadHTMLString,
                // which surfaces as about:blank and carries no external content.
                decisionHandler(.allow)
            } else {
                decisionHandler(.cancel)
            }
            return
        }

        // Subframe and subresource loads: ordinary web content stays allowed so
        // the bundled UI keeps working, but file: and custom schemes never load.
        decisionHandler((scheme == "http" || scheme == "https") ? .allow : .cancel)
    }

    private func isLocalServiceOrigin(_ url: URL) -> Bool {
        guard url.scheme?.lowercased() == "http",
              url.host?.lowercased() == "127.0.0.1" else { return false }
        return (url.port ?? 80) == webPort
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptAlertPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping () -> Void
    ) {
        let alert = NSAlert()
        alert.messageText = "Dockyard DSH"
        alert.informativeText = message
        alert.addButton(withTitle: "确定")
        presentJavaScriptAlert(alert, on: webView) { _ in
            completionHandler()
        }
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (Bool) -> Void
    ) {
        let alert = NSAlert()
        alert.messageText = "Dockyard DSH"
        alert.informativeText = message
        alert.addButton(withTitle: "确认")
        alert.addButton(withTitle: "取消")
        presentJavaScriptAlert(alert, on: webView) { response in
            completionHandler(response == .alertFirstButtonReturn)
        }
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptTextInputPanelWithPrompt prompt: String,
        defaultText: String?,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (String?) -> Void
    ) {
        let alert = NSAlert()
        alert.messageText = "Dockyard DSH"
        alert.informativeText = prompt
        let input = NSTextField(string: defaultText ?? "")
        input.frame = NSRect(x: 0, y: 0, width: 280, height: 24)
        alert.accessoryView = input
        alert.addButton(withTitle: "确定")
        alert.addButton(withTitle: "取消")
        presentJavaScriptAlert(alert, on: webView) { response in
            completionHandler(response == .alertFirstButtonReturn ? input.stringValue : nil)
        }
    }

    private func presentJavaScriptAlert(
        _ alert: NSAlert,
        on webView: WKWebView,
        completionHandler: @escaping (NSApplication.ModalResponse) -> Void
    ) {
        if let parent = webView.window ?? window {
            alert.beginSheetModal(for: parent) { response in
                completionHandler(response)
            }
        } else {
            completionHandler(alert.runModal())
        }
    }

    private func openAuthorizationURL(_ url: URL) {
        guard ["http", "https"].contains(url.scheme?.lowercased()) else { return }
        if !NSWorkspace.shared.open(url) {
            appendLog(Data("[Dockyard DSH] Could not open authorization URL: \(url.absoluteString)\\n".utf8))
        }
    }

    private func resolveWebPort() throws -> Int {
        let environment = ProcessInfo.processInfo.environment
        let override = environment["DOCKYARD_DSH_PORT"]?.trimmingCharacters(in: .whitespacesAndNewlines)
        let requested = Int(override ?? "3080") ?? 3080
        let preferred = requested > 0 ? requested : 3080
        if portIsAvailable(preferred) { return preferred }
        if override != nil {
            throw AppError.portUnavailable(preferred)
        }
        if preferred < 65535 {
            for candidate in (preferred + 1)...min(preferred + 100, 65535) where portIsAvailable(candidate) {
                return candidate
            }
        }
        throw AppError.portUnavailable(preferred)
    }

    private func portIsAvailable(_ port: Int) -> Bool {
        guard (1...65535).contains(port) else { return false }
        let descriptor = socket(AF_INET, SOCK_STREAM, 0)
        guard descriptor >= 0 else { return false }
        defer { close(descriptor) }
        var reuseAddress: Int32 = 1
        withUnsafePointer(to: &reuseAddress) {
            _ = Darwin.setsockopt(
                descriptor,
                SOL_SOCKET,
                SO_REUSEADDR,
                $0,
                socklen_t(MemoryLayout<Int32>.size)
            )
        }
        var address = sockaddr_in()
        address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
        address.sin_family = sa_family_t(AF_INET)
        address.sin_port = in_port_t(port).bigEndian
        inet_pton(AF_INET, "127.0.0.1", &address.sin_addr)
        let result = withUnsafePointer(to: &address) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                Darwin.bind(descriptor, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
            }
        }
        return result == 0
    }

    private func runtimeArchitecture() -> String {
        #if arch(arm64)
        return "arm64"
        #elseif arch(x86_64)
        return "x64"
        #else
        return "unsupported"
        #endif
    }

    private func makeLocalAuthToken() throws -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        let status = bytes.withUnsafeMutableBytes { buffer in
            SecRandomCopyBytes(kSecRandomDefault, buffer.count, buffer.baseAddress!)
        }
        guard status == errSecSuccess else {
            throw AppError.runtimeFailure("Could not create the local DSH authentication token.")
        }
        return Data(bytes).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private func loadWebViewWithAuth(at url: URL) {
        guard let token = localAuthToken else {
            webView.load(URLRequest(url: url))
            return
        }
        let properties: [HTTPCookiePropertyKey: Any] = [
            .domain: "127.0.0.1",
            .path: "/api",
            .name: "DockyardDSHLocalAuth",
            .value: token,
            HTTPCookiePropertyKey("HttpOnly"): "TRUE",
            HTTPCookiePropertyKey("SameSite"): "Strict",
        ]
        guard let cookie = HTTPCookie(properties: properties) else {
            webView.load(URLRequest(url: url))
            return
        }
        webView.configuration.websiteDataStore.httpCookieStore.setCookie(cookie) { [weak self] in
            DispatchQueue.main.async {
                guard let self, !self.stopping else { return }
                self.webView.load(URLRequest(url: url))
            }
        }
    }

    private func startDockyardRuntime() {
        do {
            runtimePollGeneration += 1
            webPort = try resolveWebPort()
            let home = try prepareUserHome()
            let authToken = try makeLocalAuthToken()
            localAuthToken = authToken
            let resources = try resourceDirectory()
            let runtime = resources.appendingPathComponent("runtime", isDirectory: true)
            let node = runtime.appendingPathComponent("node-\(runtimeArchitecture())")
            let dshEntry = runtime
                .appendingPathComponent("dsh", isDirectory: true)
                .appendingPathComponent("node_modules", isDirectory: true)
                .appendingPathComponent("@deepseek-ai", isDirectory: true)
                .appendingPathComponent("dsh", isDirectory: true)
                .appendingPathComponent("lib", isDirectory: true)
                .appendingPathComponent("bin.js")

            guard FileManager.default.isExecutableFile(atPath: node.path) else {
                throw AppError.missingResource("Embedded Node runtime")
            }
            guard FileManager.default.fileExists(atPath: dshEntry.path) else {
                throw AppError.missingResource("Embedded DSH runtime")
            }

            let logURL = home.deletingLastPathComponent().appendingPathComponent("Logs", isDirectory: true)
                .appendingPathComponent("dockyard-dsh.log")
            try FileManager.default.createDirectory(at: logURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            FileManager.default.createFile(
                atPath: logURL.path,
                contents: nil,
                attributes: [.posixPermissions: 0o600]
            )
            try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: logURL.path)
            logHandle = try FileHandle(forWritingTo: logURL)
            try logHandle?.seekToEnd()

            let pipe = Pipe()
            logPipe = pipe
            pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
                let data = handle.availableData
                guard !data.isEmpty else { return }
                self?.appendLog(data)
            }

            let process = Process()
            process.executableURL = node
            process.arguments = [dshEntry.path, "--profile", "web", "--host", "127.0.0.1", "--port", String(webPort)]
            process.currentDirectoryURL = runtime
            setenv("DSH_LOCAL_AUTH_TOKEN", authToken, 1)
            var environment = ProcessInfo.processInfo.environment
            environment["DSH_HOME"] = home.path
            environment["DSH_LOCAL_AUTH_TOKEN"] = authToken
            let userHome = FileManager.default.homeDirectoryForCurrentUser.path
            environment["PATH"] = [
                runtime.appendingPathComponent("bin").path,
                "\(userHome)/.local/bin",
                "\(userHome)/.npm-global/bin",
                "\(userHome)/.npm/bin",
                "\(userHome)/.bun/bin",
                "/opt/homebrew/bin",
                "/opt/homebrew/sbin",
                "/usr/local/bin",
                "/usr/local/sbin",
                environment["PATH"] ?? "",
                "/usr/bin",
                "/bin",
                "/usr/sbin",
                "/sbin"
            ].joined(separator: ":")
            environment["NODE_NO_WARNINGS"] = "1"
            process.environment = environment
            process.standardOutput = pipe
            process.standardError = pipe
            process.terminationHandler = { [weak self] terminatedProcess in
                DispatchQueue.main.async {
                    guard let self, !self.stopping else { return }
                    // Reaching the termination handler without `stopping` means
                    // the runtime crashed or was killed from outside: restart it.
                    self.handleRuntimeUnexpectedExit(terminatedProcess)
                }
            }
            dshProcess = process
            try process.run()
            pollForWebServer(attempt: 0, generation: runtimePollGeneration)
        } catch {
            handleRuntimeStartFailure(error)
        }
    }

    private func stopDockyardRuntime() {
        guard let process = dshProcess, process.isRunning else {
            logHandle?.closeFile()
            logHandle = nil
            return
        }
        // Synchronous teardown: the log handle is closed afterwards so the final
        // shutdown messages still reach the log file.
        terminateProcessTree(process)
        dshProcess = nil
        logPipe = nil
        logHandle?.closeFile()
        logHandle = nil
    }

    /// Terminates `process` and every descendant it spawned. DSH launches tool
    /// processes of its own; killing only the Node root would orphan them.
    private func terminateProcessTree(_ process: Process) {
        let rootPID = process.processIdentifier
        guard rootPID > 0 else {
            process.waitUntilExit()
            return
        }
        appendLog(Data("[Dockyard DSH] Stopping DSH runtime tree rooted at pid \(rootPID)\n".utf8))

        signalDescendantTree(rootPID, with: SIGTERM)

        // Synchronously wait for the root to exit (bounded by the grace period)
        // instead of sleeping or racing an async SIGKILL that may never run.
        let exited = DispatchSemaphore(value: 0)
        process.terminationHandler = { _ in exited.signal() }
        let deadline = Date().addingTimeInterval(runtimeStopGraceSeconds)
        while process.isRunning && Date() < deadline {
            _ = exited.wait(timeout: .now() + 0.25)
        }

        if process.isRunning {
            kill(rootPID, SIGKILL)
            // Re-enumerate: descendants may have appeared or ignored SIGTERM.
            for pid in descendantPIDs(of: rootPID) {
                kill(pid, SIGKILL)
            }
        }
        process.waitUntilExit()
        appendLog(Data("[Dockyard DSH] DSH runtime tree stopped\n".utf8))
    }

    private func signalDescendantTree(_ rootPID: pid_t, with signal: Int32) {
        kill(rootPID, signal)
        for pid in descendantPIDs(of: rootPID) {
            kill(pid, signal)
        }
    }

    /// Collects every live descendant PID below `ancestor`. Foundation has no
    /// process-group API, so walk the kernel process table via sysctl and match
    /// parent links transitively.
    private func descendantPIDs(of ancestor: pid_t) -> [pid_t] {
        let entries = currentProcessList()
        var descendants = Set<pid_t>()
        var frontier: Set<pid_t> = [ancestor]
        var changed = true
        while changed {
            changed = false
            for entry in entries where !descendants.contains(entry.p_pid) && frontier.contains(entry.p_ppid) {
                descendants.insert(entry.p_pid)
                frontier.insert(entry.p_pid)
                changed = true
            }
        }
        descendants.remove(ancestor)
        return descendants.sorted()
    }

    private func currentProcessList() -> [kinfo_proc] {
        var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_ALL]
        var size = 0
        guard sysctl(&mib, u_int(mib.count), nil, &size, nil, 0) == 0, size > 0 else { return [] }
        // The process table can change between the sizing call and the data call;
        // retry with padding when sysctl reports ENOMEM.
        for _ in 0..<4 {
            let paddedSize = size + size / 8 + 4096
            var entries = [kinfo_proc](repeating: kinfo_proc(), count: paddedSize / MemoryLayout<kinfo_proc>.stride)
            var returnedSize = paddedSize
            if sysctl(&mib, u_int(mib.count), &entries, &returnedSize, nil, 0) == 0 {
                let count = returnedSize / MemoryLayout<kinfo_proc>.stride
                return Array(entries.prefix(max(count, 0)))
            }
            guard errno == ENOMEM else { return [] }
            size = paddedSize
        }
        return []
    }

    private func handleRuntimeUnexpectedExit(_ process: Process) {
        dshProcess = nil
        logPipe?.fileHandleForReading.readabilityHandler = nil
        logPipe = nil
        let exitCode = process.terminationStatus
        guard runtimeRestartAttempts < maxRuntimeRestartAttempts else {
            showError("The Dockyard DSH service exited unexpectedly (exit code \(exitCode)) and did not come back after \(maxRuntimeRestartAttempts) automatic restarts. Check the log at ~/Library/Application Support/Dockyard DSH/Logs/dockyard-dsh.log.")
            return
        }
        scheduleRuntimeRestart(reason: "previous instance exited with code \(exitCode)")
    }

    private func handleRuntimeStartFailure(_ error: Error) {
        guard !stopping else { return }
        // Configuration problems cannot heal on their own; only transient
        // failures participate in the automatic restart backoff.
        if case AppError.missingResource = error {
            showError(error.localizedDescription)
            return
        }
        if case AppError.portUnavailable = error {
            showError(error.localizedDescription)
            return
        }
        guard runtimeRestartAttempts < maxRuntimeRestartAttempts else {
            showError(error.localizedDescription)
            return
        }
        scheduleRuntimeRestart(reason: "startup failed: \(error.localizedDescription)")
    }

    private func scheduleRuntimeRestart(reason: String) {
        let delay = min(pow(2.0, Double(runtimeRestartAttempts)), 16.0)
        runtimeRestartAttempts += 1
        appendLog(Data("[Dockyard DSH] \(reason); restarting in \(Int(delay))s (attempt \(runtimeRestartAttempts)/\(maxRuntimeRestartAttempts)).\n".utf8))
        showLoading(message: "Dockyard DSH stopped unexpectedly. Restarting… (\(runtimeRestartAttempts)/\(maxRuntimeRestartAttempts))")
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            guard let self, !self.stopping else { return }
            self.startDockyardRuntime()
        }
    }

    private func pollForWebServer(attempt: Int, generation: Int) {
        guard !stopping else { return }
        let url = URL(string: "http://127.0.0.1:\(webPort)/")!
        URLSession.shared.dataTask(with: url) { [weak self] _, response, error in
            DispatchQueue.main.async {
                guard let self, !self.stopping else { return }
                // A newer runtime start superseded this poll (restart path).
                guard generation == self.runtimePollGeneration else { return }
                if let http = response as? HTTPURLResponse, (200..<500).contains(http.statusCode) {
                    // The service came up cleanly: give future unexpected exits
                    // a fresh run of restart attempts.
                    self.runtimeRestartAttempts = 0
                    self.readyURL = url
                    self.loadWebViewWithAuth(at: url)
                    return
                }
                if attempt >= 120 {
                    self.showError("The local DSH Web service did not become ready. Check the log at ~/Library/Application Support/Dockyard DSH/Logs/dockyard-dsh.log.")
                    return
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    self.pollForWebServer(attempt: attempt + 1, generation: generation)
                }
            }
        }.resume()
    }

    private func prepareUserHome() throws -> URL {
        let appSupport: URL
        if let override = ProcessInfo.processInfo.environment["DOCKYARD_DSH_HOME"], !override.isEmpty {
            appSupport = URL(fileURLWithPath: override, isDirectory: true)
        } else {
            appSupport = try FileManager.default.url(
                for: .applicationSupportDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
            ).appendingPathComponent("Dockyard DSH", isDirectory: true)
        }
        let home = appSupport.appendingPathComponent("dsh-home", isDirectory: true)
        try FileManager.default.createDirectory(at: appSupport, withIntermediateDirectories: true)
        let profile = home.appendingPathComponent("profiles", isDirectory: true)
            .appendingPathComponent("web", isDirectory: true)
        let resources = try resourceDirectory()
        let bundledHome = resources.appendingPathComponent("dsh-home", isDirectory: true)
        let bundledProfile = bundledHome.appendingPathComponent("profiles", isDirectory: true)
            .appendingPathComponent("web", isDirectory: true)
        guard FileManager.default.fileExists(atPath: bundledProfile.path) else {
            throw AppError.missingResource("Bundled Web profile")
        }
        if !FileManager.default.fileExists(atPath: profile.path) {
            if FileManager.default.fileExists(atPath: home.path) {
                try FileManager.default.createDirectory(at: home.appendingPathComponent("profiles", isDirectory: true), withIntermediateDirectories: true)
                try FileManager.default.copyItem(at: bundledProfile, to: profile)
            } else {
                try FileManager.default.copyItem(at: bundledHome, to: home)
            }
        }
        try synchronizeBundledProfileIfNeeded(from: bundledHome, to: home, profile: profile)
        try synchronizeBundledFiles(from: bundledProfile, to: profile)
        return home
    }

    private func synchronizeBundledProfileIfNeeded(from bundledHome: URL, to home: URL, profile: URL) throws {
        let markerName = "dockyard-dsh-runtime-version"
        let bundledMarker = bundledHome.appendingPathComponent(markerName)
        guard let bundledVersion = try? String(contentsOf: bundledMarker, encoding: .utf8)
            .trimmingCharacters(in: .whitespacesAndNewlines), !bundledVersion.isEmpty else {
            throw AppError.missingResource("Bundled DSH runtime version")
        }

        let installedMarker = home.appendingPathComponent(markerName)
        let installedVersion = try? String(contentsOf: installedMarker, encoding: .utf8)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard installedVersion != bundledVersion else { return }

        let patchFile = profile.appendingPathComponent("cordis.patch.yml")
        let patchData = try? Data(contentsOf: patchFile)
        if FileManager.default.fileExists(atPath: profile.path) {
            let backupRoot = home.deletingLastPathComponent().appendingPathComponent("backups", isDirectory: true)
            try FileManager.default.createDirectory(at: backupRoot, withIntermediateDirectories: true)
            let oldLabel = (installedVersion ?? "unknown")
                .replacingOccurrences(of: "/", with: "-")
                .replacingOccurrences(of: " ", with: "-")
            let backup = backupRoot.appendingPathComponent(
                "dsh-profile-web-before-\(oldLabel)-\(Int(Date().timeIntervalSince1970))",
                isDirectory: true
            )
            try FileManager.default.moveItem(at: profile, to: backup)
        }

        let bundledProfile = bundledHome.appendingPathComponent("profiles", isDirectory: true)
            .appendingPathComponent("web", isDirectory: true)
        try FileManager.default.createDirectory(at: profile.deletingLastPathComponent(), withIntermediateDirectories: true)
        try FileManager.default.copyItem(at: bundledProfile, to: profile)
        if let patchData {
            try patchData.write(to: profile.appendingPathComponent("cordis.patch.yml"), options: .atomic)
        }
        try bundledVersion.write(to: installedMarker, atomically: true, encoding: .utf8)
    }

    private func synchronizeBundledFiles(from bundledProfile: URL, to profile: URL) throws {
        let files = [
            ("node_modules/@dockyard-dsh/plugin/packages/dsh-plugin/dist/macos-keychain-helper.swift", "Bundled macOS Keychain helper"),
            ("node_modules/@dockyard-dsh/plugin/packages/dsh-plugin/dist/index.mjs", "Bundled Dockyard runtime"),
            ("node_modules/@deepseek-ai/dsh-client-ui-model-selection/lib/client.js", "Bundled model selector"),
            ("node_modules/@dockyard-dsh/plugin/packages/dsh-plugin/lib/client.js", "Bundled Dockyard account client")
        ]
        for (relativePath, resourceName) in files {
            let bundledFile = bundledProfile.appendingPathComponent(relativePath)
            let installedFile = profile.appendingPathComponent(relativePath)
            guard FileManager.default.fileExists(atPath: bundledFile.path) else {
                throw AppError.missingResource(resourceName)
            }
            try FileManager.default.createDirectory(at: installedFile.deletingLastPathComponent(), withIntermediateDirectories: true)
            let bundledData = try Data(contentsOf: bundledFile)
            if let installedData = try? Data(contentsOf: installedFile), installedData == bundledData {
                continue
            }
            if FileManager.default.fileExists(atPath: installedFile.path) {
                try FileManager.default.removeItem(at: installedFile)
            }
            try FileManager.default.copyItem(at: bundledFile, to: installedFile)
        }
    }

    private func resourceDirectory() throws -> URL {
        guard let url = Bundle.main.resourceURL else {
            throw AppError.missingResource("Application resources")
        }
        return url
    }

    private func appendLog(_ data: Data) {
        try? logHandle?.write(contentsOf: data)
        if let text = String(data: data, encoding: .utf8) {
            FileHandle.standardError.write(Data("[Dockyard DSH] \(text)".utf8))
        }
    }

    private func showLoading(message: String) {
        let html = """
        <!doctype html><html><head><meta charset=\"utf-8\"><style>
        body{margin:0;background:#101010;color:#f5f5f5;font:16px -apple-system,BlinkMacSystemFont,sans-serif;display:grid;place-items:center;height:100vh}
        main{text-align:center;max-width:520px;padding:32px} .spinner{margin:0 auto 20px;width:28px;height:28px;border:3px solid #444;border-top-color:#4b6bff;border-radius:50%;animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
        </style></head><body><main><div class=\"spinner\"></div><div>\(message)</div></main></body></html>
        """
        webView.loadHTMLString(html, baseURL: nil)
    }

    private func showError(_ message: String) {
        let escaped = message
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
        let html = """
        <!doctype html><html><head><meta charset=\"utf-8\"><style>
        body{margin:0;background:#101010;color:#f5f5f5;font:16px -apple-system,BlinkMacSystemFont,sans-serif;display:grid;place-items:center;height:100vh}
        main{max-width:650px;padding:36px}h1{font-size:22px}p{color:#bbb;line-height:1.6}code{color:#9db0ff}
        </style></head><body><main><h1>Dockyard DSH could not start</h1><p>\(escaped)</p><p>Quit and try again, or inspect the application log in <code>~/Library/Application Support/Dockyard DSH/Logs</code>.</p></main></body></html>
        """
        webView.loadHTMLString(html, baseURL: nil)
    }
}

enum AppError: LocalizedError {
    case missingResource(String)
    case portUnavailable(Int)
    case runtimeFailure(String)

    var errorDescription: String? {
        switch self {
        case .missingResource(let name): return "Missing \(name) in the application bundle. Reinstall Dockyard DSH."
        case .portUnavailable(let port): return "Port \(port) is already in use. Quit the other local Web service and try again."
        case .runtimeFailure(let message): return message
        }
    }
}

let application = NSApplication.shared
let delegate = AppDelegate()
application.delegate = delegate
application.run()
