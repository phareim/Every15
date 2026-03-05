import SwiftUI

struct EntryView: View {
    @EnvironmentObject private var syncService: SyncService
    @State private var text = ""
    @State private var entryTime = Date()
    @State private var isBackfilling = false
    @State private var showTimePicker = false
    @FocusState private var isFocused: Bool

    private var displayTime: String {
        let snapped = SyncService.floorToQuarter(entryTime)
        let fmt = DateFormatter()
        fmt.dateFormat = "HH:mm"
        return fmt.string(from: snapped)
    }

    private var isNow: Bool {
        abs(entryTime.timeIntervalSinceNow) < 60
    }

    private var canExtend: Bool {
        syncService.previousQuarterEntry != nil
    }

    var body: some View {
        VStack(spacing: 20) {
            Spacer()

            Text("What's up?")
                .font(.largeTitle)
                .fontWeight(.bold)

            Text(isBackfilling ? "Backfilling \(displayTime)" : displayTime)
                .font(.title3)
                .foregroundStyle(isBackfilling ? .orange : .secondary)

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
                .onKeyPress(.return, phases: .down) { press in
                    if press.modifiers.contains(.command) {
                        submit()
                        return .handled
                    }
                    if press.modifiers.contains(.option) && canExtend {
                        extend()
                        return .handled
                    }
                    return .ignored
                }
                .onKeyPress(.leftArrow, phases: .down) { press in
                    guard press.modifiers.contains(.option) else { return .ignored }
                    entryTime = entryTime.addingTimeInterval(-15 * 60)
                    isBackfilling = SyncService.floorToQuarter(entryTime) < SyncService.floorToQuarter(Date())
                    return .handled
                }
                .onKeyPress(.rightArrow, phases: .down) { press in
                    guard press.modifiers.contains(.option) else { return .ignored }
                    let next = entryTime.addingTimeInterval(15 * 60)
                    let now = Date()
                    if SyncService.floorToQuarter(next) <= SyncService.floorToQuarter(now) {
                        entryTime = next
                    } else {
                        entryTime = now
                    }
                    isBackfilling = SyncService.floorToQuarter(entryTime) < SyncService.floorToQuarter(now)
                    return .handled
                }

            HStack(spacing: 12) {
                Button(action: submit) {
                    Text("Log it")
                        .font(.title3)
                        .fontWeight(.medium)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                }
                .buttonStyle(.borderedProminent)
                .keyboardShortcut(.return, modifiers: .command)
                .disabled(text.trimmingCharacters(in: .whitespaces).isEmpty)

                Button(action: extend) {
                    Text("Extend")
                        .font(.title3)
                        .fontWeight(.medium)
                        .frame(height: 44)
                        .padding(.horizontal, 16)
                }
                .buttonStyle(.bordered)
                .keyboardShortcut(.return, modifiers: .option)
                .disabled(!canExtend)

                Button {
                    showTimePicker.toggle()
                } label: {
                    Text(isNow && !isBackfilling ? "Now" : displayTime)
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
                            isBackfilling = false
                            showTimePicker = false
                        }
                        .buttonStyle(.borderless)
                    }
                    .padding()
                }
                .onChange(of: entryTime) { _, newValue in
                    isBackfilling = SyncService.floorToQuarter(newValue) < SyncService.floorToQuarter(Date())
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
                            VStack(alignment: .leading, spacing: 2) {
                                Text(entry.text)
                                    .font(.body)
                                    .lineLimit(1)
                                if entry.extended {
                                    Text("↳ extended")
                                        .font(.caption2)
                                        .foregroundStyle(.tertiary)
                                }
                            }
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

        if isBackfilling {
            entryTime = syncService.nextEmptyQuarter(after: entryTime)
            if SyncService.floorToQuarter(entryTime) >= SyncService.floorToQuarter(Date()) {
                entryTime = Date()
                isBackfilling = false
            }
        } else {
            entryTime = Date()
        }

        isFocused = true
    }

    private func extend() {
        syncService.extendPreviousQuarter()
    }
}
