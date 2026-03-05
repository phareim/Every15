import Foundation

@MainActor
final class SyncService: ObservableObject {
    static let shared = SyncService()

    @Published var todayEntries: [Entry] = []
    @Published var isSyncing = false

    private let localStorageKey = "com.every15.local.entries"

    init() {
        loadLocal()
    }

    // MARK: - Local Storage

    private var localEntries: [String: DayEntries] {
        get {
            guard let data = UserDefaults.standard.data(forKey: localStorageKey) else { return [:] }
            return (try? JSONDecoder().decode([String: DayEntries].self, from: data)) ?? [:]
        }
        set {
            if let data = try? JSONEncoder().encode(newValue) {
                UserDefaults.standard.set(data, forKey: localStorageKey)
            }
        }
    }

    private func loadLocal() {
        let today = Self.dateString(for: Date())
        todayEntries = localEntries[today]?.entries ?? []
    }

    // MARK: - Add Entry

    func addEntry(text: String, at date: Date = Date()) {
        let today = Self.dateString(for: date)
        let timeStr = Self.timeString(for: date)

        let entry = Entry(time: timeStr, text: text)

        var local = localEntries
        var dayData = local[today] ?? DayEntries(date: today, entries: [])
        dayData.entries.append(entry)
        dayData.entries.sort { $0.time < $1.time }
        local[today] = dayData
        localEntries = local

        todayEntries = dayData.entries

        Task { await syncDay(today) }
    }

    // MARK: - Sync

    func syncToday() async {
        let today = Self.dateString(for: Date())
        await syncDay(today)
    }

    func syncDay(_ date: String) async {
        guard AuthService.shared.isAuthenticated else { return }
        guard let dayData = localEntries[date] else { return }

        isSyncing = true
        defer { isSyncing = false }

        do {
            let merged = try await APIService.shared.putEntries(date: date, dayEntries: dayData)
            var local = localEntries
            local[date] = merged
            localEntries = local
            if date == Self.dateString(for: Date()) {
                todayEntries = merged.entries
            }
        } catch {
            print("Sync error: \(error)")
        }
    }

    func fetchDay(_ date: String) async -> DayEntries? {
        do {
            let results = try await APIService.shared.getEntries(from: date, to: date)
            if let day = results.first {
                var local = localEntries
                local[date] = day
                localEntries = local
                return day
            }
        } catch {
            print("Fetch error: \(error)")
        }
        return localEntries[date]
    }

    // MARK: - Helpers

    static func dateString(for date: Date) -> String {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.string(from: date)
    }

    static func timeString(for date: Date) -> String {
        let fmt = DateFormatter()
        fmt.dateFormat = "HH:mm"
        return fmt.string(from: date)
    }
}
