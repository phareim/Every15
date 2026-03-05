import Foundation

struct Entry: Identifiable, Codable, Equatable {
    let id: String
    var time: String
    var text: String
    var tags: [String]

    init(id: String = UUID().uuidString, time: String, text: String, tags: [String] = []) {
        self.id = id
        self.time = time
        self.text = text
        self.tags = tags
    }
}

struct DayEntries: Codable {
    let date: String
    var entries: [Entry]
}
