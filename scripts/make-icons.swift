#!/usr/bin/env swift

// Generates the two app icon rasters from public/icon.svg.
//
// WHY TWO. The platforms disagree about what an app icon IS. Windows and Linux want
// full-bleed square artwork and apply nothing to it. macOS expects the file to already
// contain Apple's grid — a 1024×1024 canvas whose visible body is an 824×824 rounded
// rect with a 185.4pt corner radius, leaving 100pt of transparent margin on every side —
// and does NOT apply that mask for you. Hand macOS the square and the app renders as a
// hard-edged tile visibly larger than every neighbour in the Dock and Launchpad, which
// reads as an app that was ported rather than built for the machine.
//
// The margin is not padding to taste: the OS sizes icons against the full canvas, so
// shrinking the body is precisely what makes this icon the same visual size as its
// neighbours.
//
// Swift rather than a Node dependency because AppKit rasterises the SVG and draws the
// rounded body without either being installed, and this runs on a Mac by definition —
// it is the Mac icon.
//
//   swift scripts/make-icons.swift public/icon.svg resources

import AppKit

let arguments = CommandLine.arguments
guard arguments.count == 3 else {
    FileHandle.standardError.write("usage: make-icons <source.svg> <output-dir>\n".data(using: .utf8)!)
    exit(2)
}

let sourceURL = URL(fileURLWithPath: arguments[1])
let outputDirectory = URL(fileURLWithPath: arguments[2])

guard let source = NSImage(contentsOf: sourceURL) else {
    FileHandle.standardError.write("could not read \(sourceURL.path)\n".data(using: .utf8)!)
    exit(1)
}

let canvas: CGFloat = 1024

func context(_ size: CGFloat) -> CGContext {
    guard let context = CGContext(
        data: nil, width: Int(size), height: Int(size), bitsPerComponent: 8, bytesPerRow: 0,
        space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else {
        FileHandle.standardError.write("could not create a drawing context\n".data(using: .utf8)!)
        exit(1)
    }
    context.clear(CGRect(x: 0, y: 0, width: size, height: size))
    context.interpolationQuality = .high
    return context
}

// Rasterise the vector at full canvas size once; both outputs draw from it.
let squareContext = context(canvas)
let squareRect = CGRect(x: 0, y: 0, width: canvas, height: canvas)
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(cgContext: squareContext, flipped: false)
source.draw(in: squareRect, from: .zero, operation: .copy, fraction: 1)
NSGraphicsContext.restoreGraphicsState()

guard let square = squareContext.makeImage() else {
    FileHandle.standardError.write("could not rasterise the source\n".data(using: .utf8)!)
    exit(1)
}

func write(_ image: CGImage, to name: String) {
    let url = outputDirectory.appendingPathComponent(name)
    let bitmap = NSBitmapImageRep(cgImage: image)
    guard let data = bitmap.representation(using: .png, properties: [:]) else {
        FileHandle.standardError.write("could not encode \(name)\n".data(using: .utf8)!)
        exit(1)
    }
    do { try data.write(to: url) } catch {
        FileHandle.standardError.write("could not write \(url.path): \(error)\n".data(using: .utf8)!)
        exit(1)
    }
    print("wrote \(url.path)")
}

write(square, to: "icon.png")

// The macOS variant: the same artwork, inset into Apple's rounded body. Transparent
// everywhere outside it — a white or black plate would show on the opposite desktop theme.
let body: CGFloat = 824
let cornerRadius: CGFloat = 185.4
let margin = (canvas - body) / 2

let macContext = context(canvas)
let bodyRect = CGRect(x: margin, y: margin, width: body, height: body)
macContext.addPath(CGPath(roundedRect: bodyRect, cornerWidth: cornerRadius, cornerHeight: cornerRadius, transform: nil))
macContext.clip()
macContext.draw(square, in: bodyRect)

guard let macIcon = macContext.makeImage() else {
    FileHandle.standardError.write("could not compose the macOS icon\n".data(using: .utf8)!)
    exit(1)
}
write(macIcon, to: "icon-mac.png")
