import Foundation

struct Entry: Identifiable, Codable, Equatable {
    let id: String
    var time: String
    var text: String
    var tags: [String]
    var extended: Bool

    init(id: String = UUID().uuidString, time: String, text: String, tags: [String] = [], extended: Bool = false) {
        self.id = id
        self.time = time
        self.text = text
        self.tags = tags
        self.extended = extended
    }

    enum CodingKeys: String, CodingKey {
        case id, time, text, tags, extended
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        time = try container.decode(String.self, forKey: .time)
        text = try container.decode(String.self, forKey: .text)
        tags = try container.decode([String].self, forKey: .tags)
        extended = try container.decodeIfPresent(Bool.self, forKey: .extended) ?? false
    }
}

struct DayEntries: Codable {
    let date: String
    var entries: [Entry]
}
