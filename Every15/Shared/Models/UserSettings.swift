import Foundation

struct DaySchedule: Codable, Equatable {
    var start: String
    var end: String
}

struct UserSettings: Codable {
    var schedule: [String: DaySchedule?]
    var pauseUntil: String?
    var timezone: String
    var intervalMinutes: Int

    static let `default` = UserSettings(
        schedule: [
            "monday": DaySchedule(start: "09:00", end: "17:00"),
            "tuesday": DaySchedule(start: "09:00", end: "17:00"),
            "wednesday": DaySchedule(start: "09:00", end: "17:00"),
            "thursday": DaySchedule(start: "09:00", end: "17:00"),
            "friday": DaySchedule(start: "09:00", end: "17:00"),
        ],
        pauseUntil: nil,
        timezone: TimeZone.current.identifier,
        intervalMinutes: 15
    )
}
