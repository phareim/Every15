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
        let snapped = Self.floorToQuarter(date)
        let today = Self.dateString(for: snapped)
        let timeStr = Self.timeString(for: snapped)

        var local = localEntries
        var dayData = local[today] ?? DayEntries(date: today, entries: [])

        // If there's already an entry at this quarter, append text
        if let idx = dayData.entries.firstIndex(where: { $0.time == timeStr }) {
            dayData.entries[idx].text += ". \(text)"
        } else {
            dayData.entries.append(Entry(time: timeStr, text: text))
            dayData.entries.sort { $0.time < $1.time }
        }

        local[today] = dayData
        localEntries = local
        todayEntries = dayData.entries

        Task { await syncDay(today) }
    }

    /// The previous quarter's entry (relative to the current quarter), if one exists.
    var previousQuarterEntry: Entry? {
        let now = Self.floorToQuarter(Date())
        let prev = now.addingTimeInterval(-15 * 60)
        let prevTime = Self.timeString(for: prev)
        return todayEntries.first(where: { $0.time == prevTime })
    }

    /// Extend the previous quarter into the current one by copying its text as an extension entry.
    func extendPreviousQuarter() {
        guard let prev = previousQuarterEntry else { return }

        let now = Self.floorToQuarter(Date())
        let today = Self.dateString(for: now)
        let timeStr = Self.timeString(for: now)

        var local = localEntries
        var dayData = local[today] ?? DayEntries(date: today, entries: [])

        if let idx = dayData.entries.firstIndex(where: { $0.time == timeStr }) {
            dayData.entries[idx].text += ". \(prev.text)"
        } else {
            dayData.entries.append(Entry(time: timeStr, text: prev.text, extended: true))
            dayData.entries.sort { $0.time < $1.time }
        }

        local[today] = dayData
        localEntries = local
        todayEntries = dayData.entries

        Task { await syncDay(today) }
    }

    /// Returns the next quarter-hour after `date` that has no entry logged today.
    func nextEmptyQuarter(after date: Date) -> Date {
        let today = Self.dateString(for: Date())
        let entries = localEntries[today]?.entries ?? []
        let loggedTimes = Set(entries.map(\.time))

        var candidate = Self.floorToQuarter(date)
        // Advance by 15 min, skipping quarters that already have entries
        for _ in 0..<96 { // safety bound: 24h of quarters
            candidate = candidate.addingTimeInterval(15 * 60)
            let timeStr = Self.timeString(for: candidate)
            if !loggedTimes.contains(timeStr) {
                return candidate
            }
        }
        return candidate
    }

    static func floorToQuarter(_ date: Date) -> Date {
        let cal = Calendar.current
        let minute = cal.component(.minute, from: date)
        let floored = minute - (minute % 15)
        return cal.date(bySettingHour: cal.component(.hour, from: date),
                        minute: floored, second: 0, of: date)!
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
