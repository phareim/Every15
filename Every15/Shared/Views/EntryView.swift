import SwiftUI

struct EntryView: View {
    @EnvironmentObject private var syncService: SyncService
    @State private var text = ""
    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Text("What are you working on?")
                .font(.title2)
                .fontWeight(.semibold)

            Text(currentTimeString())
                .font(.caption)
                .foregroundStyle(.secondary)

            TextField("e.g. Writing API docs...", text: $text)
                .textFieldStyle(.roundedBorder)
                .font(.body)
                .focused($isFocused)
                .onSubmit { submit() }
                .padding(.horizontal)

            Button(action: submit) {
                Text("Log it")
                    .fontWeight(.medium)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(text.trimmingCharacters(in: .whitespaces).isEmpty)
            .padding(.horizontal)

            Spacer()

            // Recent entries
            if !syncService.todayEntries.isEmpty {
                Divider()
                VStack(alignment: .leading, spacing: 8) {
                    Text("Today")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    ForEach(syncService.todayEntries.suffix(5).reversed()) { entry in
                        HStack {
                            Text(entry.time)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .frame(width: 50, alignment: .leading)
                            Text(entry.text)
                                .font(.callout)
                                .lineLimit(1)
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.bottom)
            }
        }
        .onAppear { isFocused = true }
    }

    private func submit() {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        syncService.addEntry(text: trimmed)
        text = ""
    }

    private func currentTimeString() -> String {
        let fmt = DateFormatter()
        fmt.dateFormat = "EEEE, h:mm a"
        return fmt.string(from: Date())
    }
}
