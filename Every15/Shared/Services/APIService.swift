import Foundation

final class APIService {
    static let shared = APIService()

    // TODO: Replace with actual deployed worker URL
    private let baseURL = "https://every15-worker.aiwdm.workers.dev"

    var token: String?

    private func request(_ path: String, method: String = "GET", body: Data? = nil) async throws -> Data {
        guard let url = URL(string: "\(baseURL)\(path)") else {
            throw APIError.invalidURL
        }

        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            req.httpBody = body
        }

        let (data, response) = try await URLSession.shared.data(for: req)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? ""
            print("HTTP \(httpResponse.statusCode): \(body)")
            throw APIError.httpError(httpResponse.statusCode, body)
        }

        return data
    }

    // MARK: - Auth

    func authenticate(identityToken: String) async throws -> AuthResponse {
        let body = try JSONEncoder().encode(["identityToken": identityToken])
        let data = try await request("/auth/apple", method: "POST", body: body)
        return try JSONDecoder().decode(AuthResponse.self, from: data)
    }

    // MARK: - Entries

    func getEntries(from: String, to: String) async throws -> [DayEntries] {
        let data = try await request("/entries?from=\(from)&to=\(to)")
        return try JSONDecoder().decode([DayEntries].self, from: data)
    }

    func putEntries(date: String, dayEntries: DayEntries) async throws -> DayEntries {
        let body = try JSONEncoder().encode(dayEntries)
        let data = try await request("/entries/\(date)", method: "PUT", body: body)
        return try JSONDecoder().decode(DayEntries.self, from: data)
    }

    // MARK: - Settings

    func getSettings() async throws -> UserSettings {
        let data = try await request("/settings")
        return try JSONDecoder().decode(UserSettings.self, from: data)
    }

    func putSettings(_ settings: UserSettings) async throws -> UserSettings {
        let body = try JSONEncoder().encode(settings)
        let data = try await request("/settings", method: "PUT", body: body)
        return try JSONDecoder().decode(UserSettings.self, from: data)
    }

    // MARK: - Summary

    func generateSummary(from: String, to: String) async throws -> Summary {
        let body = try JSONEncoder().encode(["from": from, "to": to])
        let data = try await request("/summary", method: "POST", body: body)
        return try JSONDecoder().decode(Summary.self, from: data)
    }

    // MARK: - Export

    func exportCSV(from: String, to: String) async throws -> Data {
        return try await request("/export?from=\(from)&to=\(to)&format=csv")
    }
}

enum APIError: Error, LocalizedError {
    case invalidURL
    case invalidResponse
    case httpError(Int, String)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case .invalidResponse: return "Invalid response"
        case .httpError(let code, let body): return "HTTP \(code): \(body)"
        }
    }
}
