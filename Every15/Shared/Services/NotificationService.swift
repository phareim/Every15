import Foundation
import UserNotifications

final class NotificationService {
    static let shared = NotificationService()

    func requestPermission() async -> Bool {
        do {
            return try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound, .badge])
        } catch {
            print("Notification permission error: \(error)")
            return false
        }
    }

    func scheduleNotifications(settings: UserSettings) async {
        let center = UNUserNotificationCenter.current()
        center.removeAllPendingNotificationRequests()

        guard settings.pauseUntil == nil else { return }

        let calendar = Calendar.current
        let dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

        var scheduled = 0
        let maxNotifications = 64

        // Schedule for the next 7 days
        for dayOffset in 0..<7 {
            guard scheduled < maxNotifications else { break }

            let date = calendar.date(byAdding: .day, value: dayOffset, to: Date())!
            let weekday = calendar.component(.weekday, from: date)
            let dayName = dayNames[weekday - 1]

            guard let daySchedule = settings.schedule[dayName] as? DaySchedule else { continue }

            let startComponents = parseTime(daySchedule.start)
            let endComponents = parseTime(daySchedule.end)

            var hour = startComponents.hour
            var minute = startComponents.minute

            while (hour < endComponents.hour || (hour == endComponents.hour && minute < endComponents.minute)),
                  scheduled < maxNotifications {

                var dateComponents = calendar.dateComponents([.year, .month, .day], from: date)
                dateComponents.hour = hour
                dateComponents.minute = minute

                let content = UNMutableNotificationContent()
                content.title = "What are you working on?"
                content.body = "Tap to log your current activity"
                content.sound = .default

                let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: false)
                let id = "every15-\(dateComponents.year!)-\(dateComponents.month!)-\(dateComponents.day!)-\(hour)-\(minute)"
                let request = UNNotificationRequest(identifier: id, content: content, trigger: trigger)

                try? await center.add(request)
                scheduled += 1

                // Advance by interval
                minute += settings.intervalMinutes
                if minute >= 60 {
                    hour += minute / 60
                    minute = minute % 60
                }
            }
        }
    }

    private func parseTime(_ time: String) -> (hour: Int, minute: Int) {
        let parts = time.split(separator: ":").compactMap { Int($0) }
        return (parts[0], parts.count > 1 ? parts[1] : 0)
    }
}
