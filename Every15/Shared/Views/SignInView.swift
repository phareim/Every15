import AuthenticationServices
import SwiftUI

struct SignInView: View {
    @EnvironmentObject private var authService: AuthService
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            Image(systemName: "clock.badge.checkmark")
                .font(.system(size: 64))
                .foregroundStyle(.tint)

            VStack(spacing: 8) {
                Text("Every15")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                Text("Track what you do, every 15 minutes")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Button(action: signIn) {
                HStack {
                    Image(systemName: "apple.logo")
                    Text("Sign in with Apple")
                }
                .fontWeight(.medium)
                .frame(maxWidth: 280)
                .frame(height: 44)
            }
            .buttonStyle(.borderedProminent)
            .tint(.primary)

            if let error = authService.authError {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .padding(.horizontal)
            }

            Spacer()
        }
        .frame(minWidth: 300, minHeight: 400)
    }

    private func signIn() {
        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()
        request.requestedScopes = [.email]

        let delegate = SignInDelegate(authService: authService)
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = delegate
        // Keep delegate alive
        SignInDelegate.current = delegate

        #if os(macOS)
        controller.performRequests()
        #else
        controller.performRequests()
        #endif
    }
}

private class SignInDelegate: NSObject, ASAuthorizationControllerDelegate {
    static var current: SignInDelegate?
    let authService: AuthService

    init(authService: AuthService) {
        self.authService = authService
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        Task { @MainActor in
            await authService.handleSignInWithApple(result: .success(authorization))
            SignInDelegate.current = nil
        }
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        print("Sign in with Apple error: \(error)")
        Task { @MainActor in
            await authService.handleSignInWithApple(result: .failure(error))
            SignInDelegate.current = nil
        }
    }
}
