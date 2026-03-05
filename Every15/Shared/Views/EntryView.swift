import SwiftUI

struct EntryView: View {
    @EnvironmentObject private var syncService: SyncService
    @State private var text = ""
    @State private var entryTime = Date()
    @State private var showTimePicker = false
    @FocusState private var isFocused: Bool

    private var isNow: Bool {
        abs(entryTime.timeIntervalSinceNow) < 60
    }

    var body: some View {
        VStack(spacing: 20) {
            Spacer()

            Text("What's up?")
                .font(.largeTitle)
                .fontWeight(.bold)

            TextEditor(text: $text)
                .font(.title3)
                .scrollContentBackground(.hidden)
                .padding(12)
                .background(
                    RoundedRectangle(cornerRadius: 10)
                        .fill(.background)
                        .shadow(color: .primary.opacity(0.1), radius: 4, y: 2)
                )
                .overlay(alignment: .topLeading) {
                    if text.isEmpty {
                        Text("e.g. writing a novel...")
                            .font(.title3)
                            .foregroundStyle(.tertiary)
                            .padding(16)
                            .allowsHitTesting(false)
                    }
                }
                .focused($isFocused)
                .frame(minHeight: 100, maxHeight: 150)
                .padding(.horizontal)

            HStack(spacing: 12) {
                Button(action: submit) {
                    Text("Log it")
                        .font(.title3)
                        .fontWeight(.medium)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                }
                .buttonStyle(.borderedProminent)
                .disabled(text.trimmingCharacters(in: .whitespaces).isEmpty)

                Button {
                    showTimePicker.toggle()
                } label: {
                    Text(isNow ? "Now" : shortTime(entryTime))
                        .font(.title3)
                        .fontWeight(.medium)
                        .frame(height: 44)
                        .padding(.horizontal, 16)
                }
                .buttonStyle(.bordered)
                .popover(isPresented: $showTimePicker) {
                    VStack(spacing: 12) {
                        DatePicker("Time", selection: $entryTime, displayedComponents: .hourAndMinute)
                            .labelsHidden()

                        Button("Reset to now") {
                            entryTime = Date()
                            showTimePicker = false
                        }
                        .buttonStyle(.borderless)
                    }
                    .padding()
                }
            }
            .padding(.horizontal)

            Spacer()

            if !syncService.todayEntries.isEmpty {
                Divider()
                VStack(alignment: .leading, spacing: 10) {
                    Text("Today")
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundStyle(.secondary)

                    ForEach(syncService.todayEntries.suffix(5).reversed()) { entry in
                        HStack {
                            Text(entry.time)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .frame(width: 50, alignment: .leading)
                            Text(entry.text)
                                .font(.body)
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
        syncService.addEntry(text: trimmed, at: entryTime)
        text = ""
        entryTime = Date()
    }

    private func shortTime(_ date: Date) -> String {
        let fmt = DateFormatter()
        fmt.dateFormat = "HH:mm"
        return fmt.string(from: date)
    }
}
