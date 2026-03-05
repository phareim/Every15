import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var authService: AuthService
    @EnvironmentObject private var storeService: StoreService
    @State private var settings = UserSettings.default
    @State private var isSaving = false

    private let days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

    var body: some View {
        Form {
            Section("Work Schedule") {
                ForEach(days, id: \.self) { day in
                    let schedule = settings.schedule[day] ?? nil
                    Toggle(day.capitalized, isOn: Binding(
                        get: { schedule != nil },
                        set: { enabled in
                            settings.schedule[day] = enabled ? DaySchedule(start: "09:00", end: "17:00") : nil
                        }
                    ))
                }
            }

            Section("Interval") {
                Picker("Check-in every", selection: $settings.intervalMinutes) {
                    Text("15 minutes").tag(15)
                    Text("30 minutes").tag(30)
                    Text("60 minutes").tag(60)
                }
            }

            Section("Subscription") {
                if storeService.isSubscribed {
                    Label("Active", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                } else {
                    Button("Subscribe — $1.99/month") {
                        Task { try? await storeService.purchase() }
                    }
                    Button("Restore Purchases") {
                        Task { await storeService.restorePurchases() }
                    }
                }
            }

            Section {
                Button("Save Settings") {
                    Task { await saveSettings() }
                }
                .disabled(isSaving)
            }

            Section {
                Button("Sign Out", role: .destructive) {
                    authService.signOut()
                }
            }
        }
        .navigationTitle("Settings")
        .task { await loadSettings() }
    }

    private func loadSettings() async {
        do {
            settings = try await APIService.shared.getSettings()
        } catch {
            // Use defaults
        }
    }

    private func saveSettings() async {
        isSaving = true
        defer { isSaving = false }
        do {
            settings = try await APIService.shared.putSettings(settings)
            await NotificationService.shared.scheduleNotifications(settings: settings)
        } catch {
            print("Save settings error: \(error)")
        }
    }
}
