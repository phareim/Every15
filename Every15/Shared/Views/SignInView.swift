import AuthenticationServices
import SwiftUI

struct SignInView: View {
    @EnvironmentObject private var authService: AuthService

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

            SignInWithAppleButton(.signIn) { request in
                request.requestedScopes = [.email]
            } onCompletion: { result in
                Task { await authService.handleSignInWithApple(result: result) }
            }
            .signInWithAppleButtonStyle(.black)
            .frame(height: 50)
            .padding(.horizontal, 40)

            Spacer()
        }
    }
}
