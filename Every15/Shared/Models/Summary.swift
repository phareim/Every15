import Foundation

struct Summary: Codable {
    let period: String
    let breakdown: [String: Double]
    let summary: String
    let generatedAt: String
}
