import StoreKit

@MainActor
final class StoreService: ObservableObject {
    static let shared = StoreService()

    @Published var isSubscribed = false
    @Published var products: [Product] = []

    private let productID = "com.every15.monthly"
    private var updateTask: Task<Void, Never>?

    init() {
        updateTask = Task { await listenForTransactions() }
        Task { await checkEntitlements() }
    }

    deinit {
        updateTask?.cancel()
    }

    func loadProducts() async {
        do {
            products = try await Product.products(for: [productID])
        } catch {
            print("Failed to load products: \(error)")
        }
    }

    func purchase() async throws {
        guard let product = products.first else { return }

        let result = try await product.purchase()

        switch result {
        case .success(let verification):
            let transaction = try checkVerified(verification)
            await transaction.finish()
            await checkEntitlements()
        case .userCancelled:
            break
        case .pending:
            break
        @unknown default:
            break
        }
    }

    func checkEntitlements() async {
        for await result in Transaction.currentEntitlements {
            if let transaction = try? checkVerified(result) {
                if transaction.productID == productID {
                    isSubscribed = true
                    return
                }
            }
        }
        isSubscribed = false
    }

    func restorePurchases() async {
        try? await AppStore.sync()
        await checkEntitlements()
    }

    private func listenForTransactions() async {
        for await result in Transaction.updates {
            if let transaction = try? checkVerified(result) {
                await transaction.finish()
                await checkEntitlements()
            }
        }
    }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified:
            throw StoreError.failedVerification
        case .verified(let safe):
            return safe
        }
    }
}

enum StoreError: Error {
    case failedVerification
}
