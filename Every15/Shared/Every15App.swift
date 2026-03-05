import SwiftUI

@main
struct Every15App: App {
    @StateObject private var authService = AuthService.shared
    @StateObject private var syncService = SyncService.shared
    @StateObject private var storeService = StoreService.shared

    #if os(macOS)
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    #endif

    var body: some Scene {
        WindowGroup {
            Group {
                if authService.isAuthenticated {
                    ContentView()
                } else {
                    SignInView()
                }
            }
            .environmentObject(authService)
            .environmentObject(syncService)
            .environmentObject(storeService)
            .task {
                _ = await NotificationService.shared.requestPermission()
                await storeService.loadProducts()
            }
        }

        #if os(macOS)
        MenuBarExtra("Every15", image: "MenuBarIcon") {
            MenuBarView()
                .environmentObject(authService)
                .environmentObject(syncService)
        }
        #endif
    }
}

struct ContentView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                EntryView()
            }
            .tabItem {
                Label("Log", systemImage: "square.and.pencil")
            }
            .tag(0)

            NavigationStack {
                TimelineView()
            }
            .tabItem {
                Label("Timeline", systemImage: "clock")
            }
            .tag(1)

            NavigationStack {
                SummaryView()
            }
            .tabItem {
                Label("Summary", systemImage: "chart.bar")
            }
            .tag(2)

            NavigationStack {
                SettingsView()
            }
            .tabItem {
                Label("Settings", systemImage: "gear")
            }
            .tag(3)
        }
    }
}

#if os(macOS)
class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        // Keep running in menu bar when window is closed
        false
    }
}

struct MenuBarView: View {
    @EnvironmentObject private var authService: AuthService
    @EnvironmentObject private var syncService: SyncService
    @State private var quickText = ""

    var body: some View {
        VStack(spacing: 8) {
            if authService.isAuthenticated {
                TextField("What's up?", text: $quickText)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit {
                        guard !quickText.trimmingCharacters(in: .whitespaces).isEmpty else { return }
                        syncService.addEntry(text: quickText.trimmingCharacters(in: .whitespaces))
                        quickText = ""
                    }

                if let last = syncService.todayEntries.last {
                    Divider()
                    HStack {
                        Text(last.time)
                            .foregroundStyle(.secondary)
                        Text(last.text)
                            .lineLimit(1)
                    }
                    .font(.caption)
                }

                Divider()
            }

            Button("Open Every15") {
                NSApplication.shared.activate(ignoringOtherApps: true)
                if let window = NSApplication.shared.windows.first {
                    window.makeKeyAndOrderFront(nil)
                }
            }
            .keyboardShortcut("o")

            Divider()

            Button("Quit") {
                NSApplication.shared.terminate(nil)
            }
            .keyboardShortcut("q")
        }
        .padding(12)
        .frame(width: 260)
    }
}
#endif
