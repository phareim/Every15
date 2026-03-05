// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "Every15",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        .library(name: "Every15Shared", targets: ["Every15Shared"]),
    ],
    targets: [
        .target(
            name: "Every15Shared",
            path: "Shared"
        ),
    ]
)
