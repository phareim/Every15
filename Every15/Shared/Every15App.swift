import SwiftUI

@main
struct Every15App: App {
    @StateObject private var authService = AuthService.shared
    @StateObject private var syncService = SyncService.shared
    @StateObject private var storeService = StoreService.shared

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
