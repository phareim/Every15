import SwiftUI

struct TimelineView: View {
    @EnvironmentObject private var syncService: SyncService
    @State private var selectedDate = Date()
    @State private var entries: [Entry] = []
    @State private var isLoading = false

    var body: some View {
        VStack {
            DatePicker("Date", selection: $selectedDate, displayedComponents: .date)
                .datePickerStyle(.compact)
                .labelsHidden()
                .padding()

            if isLoading {
                ProgressView()
                    .frame(maxHeight: .infinity)
            } else if entries.isEmpty {
                ContentUnavailableView(
                    "No entries",
                    systemImage: "clock",
                    description: Text("No entries logged for this day")
                )
            } else {
                List(entries) { entry in
                    HStack(alignment: .top) {
                        Text(entry.time)
                            .font(.callout)
                            .foregroundStyle(.secondary)
                            .frame(width: 55, alignment: .leading)
                        VStack(alignment: .leading) {
                            Text(entry.text)
                                .font(.body)
                            if !entry.tags.isEmpty {
                                Text(entry.tags.joined(separator: ", "))
                                    .font(.caption)
                                    .foregroundStyle(.tertiary)
                            }
                        }
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Timeline")
        .onChange(of: selectedDate) { _, _ in
            Task { await loadEntries() }
        }
        .task { await loadEntries() }
    }

    private func loadEntries() async {
        isLoading = true
        defer { isLoading = false }

        let dateStr = SyncService.dateString(for: selectedDate)

        if Calendar.current.isDateInToday(selectedDate) {
            entries = syncService.todayEntries
        } else if let day = await syncService.fetchDay(dateStr) {
            entries = day.entries
        } else {
            entries = []
        }
    }
}
