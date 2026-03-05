import SwiftUI

struct SummaryView: View {
    @State private var fromDate = Calendar.current.date(byAdding: .day, value: -7, to: Date())!
    @State private var toDate = Date()
    @State private var summary: Summary?
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack {
                    DatePicker("From", selection: $fromDate, displayedComponents: .date)
                    DatePicker("To", selection: $toDate, displayedComponents: .date)
                }
                .labelsHidden()

                Button("Generate Summary") {
                    Task { await generate() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(isLoading)

                if isLoading {
                    ProgressView("Generating summary...")
                }

                if let error {
                    Text(error)
                        .foregroundStyle(.red)
                }

                if let summary {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Time Breakdown")
                            .font(.headline)

                        ForEach(summary.breakdown.sorted(by: { $0.value > $1.value }), id: \.key) { category, hours in
                            HStack {
                                Text(category)
                                Spacer()
                                Text(String(format: "%.1fh", hours))
                                    .foregroundStyle(.secondary)
                            }
                        }

                        Divider()

                        Text("Summary")
                            .font(.headline)
                        Text(summary.summary)
                            .font(.body)
                    }
                    .padding()
                    .background(.regularMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
            .padding()
        }
        .navigationTitle("AI Summary")
    }

    private func generate() async {
        isLoading = true
        error = nil
        defer { isLoading = false }

        let from = SyncService.dateString(for: fromDate)
        let to = SyncService.dateString(for: toDate)

        do {
            summary = try await APIService.shared.generateSummary(from: from, to: to)
        } catch {
            self.error = error.localizedDescription
        }
    }
}
