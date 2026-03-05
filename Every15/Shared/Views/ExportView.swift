import SwiftUI
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
import UniformTypeIdentifiers
#endif

struct ExportView: View {
    @State private var fromDate = Calendar.current.date(byAdding: .day, value: -30, to: Date())!
    @State private var toDate = Date()
    @State private var isExporting = false
    @State private var exportData: Data?
    @State private var error: String?

    var body: some View {
        VStack(spacing: 20) {
            HStack {
                DatePicker("From", selection: $fromDate, displayedComponents: .date)
                DatePicker("To", selection: $toDate, displayedComponents: .date)
            }

            Button("Export CSV") {
                Task { await exportCSV() }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isExporting)

            if isExporting {
                ProgressView()
            }

            if let error {
                Text(error).foregroundStyle(.red)
            }

            Spacer()
        }
        .padding()
        .navigationTitle("Export")
    }

    private func exportCSV() async {
        isExporting = true
        error = nil
        defer { isExporting = false }

        let from = SyncService.dateString(for: fromDate)
        let to = SyncService.dateString(for: toDate)

        do {
            let data = try await APIService.shared.exportCSV(from: from, to: to)
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("every15-export.csv")
            try data.write(to: url)
            exportData = data

            #if os(iOS)
            let activityVC = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
               let rootVC = windowScene.windows.first?.rootViewController {
                rootVC.present(activityVC, animated: true)
            }
            #elseif os(macOS)
            let panel = NSSavePanel()
            panel.nameFieldStringValue = "every15-export.csv"
            panel.allowedContentTypes = [.commaSeparatedText]
            if panel.runModal() == .OK, let saveURL = panel.url {
                try data.write(to: saveURL)
            }
            #endif
        } catch {
            self.error = error.localizedDescription
        }
    }
}
