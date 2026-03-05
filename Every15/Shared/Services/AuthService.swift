import AuthenticationServices
import Foundation
import Security

@MainActor
final class AuthService: ObservableObject {
    static let shared = AuthService()

    @Published var isAuthenticated = false
    @Published var currentUser: AuthUser?
    @Published var authError: String?

    private let tokenKey = "com.every15.auth.token"

    var token: String? {
        get { KeychainHelper.read(key: tokenKey) }
        set {
            if let newValue {
                KeychainHelper.save(key: tokenKey, value: newValue)
            } else {
                KeychainHelper.delete(key: tokenKey)
            }
        }
    }

    init() {
        isAuthenticated = token != nil
        if let token {
            APIService.shared.token = token
        }
    }

    func handleSignInWithApple(result: Result<ASAuthorization, Error>) async {
        switch result {
        case .success(let authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let identityTokenData = credential.identityToken,
                  let identityToken = String(data: identityTokenData, encoding: .utf8) else {
                return
            }

            do {
                let api = APIService.shared
                let response = try await api.authenticate(identityToken: identityToken)
                api.token = response.token
                token = response.token
                currentUser = response.user
                isAuthenticated = true
            } catch let apiError as APIError {
                print("Auth API error: \(apiError.errorDescription ?? "unknown")")
                self.authError = apiError.errorDescription
            } catch {
                print("Auth error: \(error)")
                self.authError = error.localizedDescription
            }

        case .failure(let error):
            print("Sign in with Apple failed: \(error)")
        }
    }

    func signOut() {
        token = nil
        APIService.shared.token = nil
        currentUser = nil
        isAuthenticated = false
    }
}

// MARK: - Keychain Helper

private enum KeychainHelper {
    static func save(key: String, value: String) {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
        ]
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }

    static func read(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
