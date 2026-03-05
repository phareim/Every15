import Foundation

struct AuthResponse: Codable {
    let token: String
    let user: AuthUser
}

struct AuthUser: Codable {
    let id: String
    let email: String?
    let subscriptionStatus: String
}
