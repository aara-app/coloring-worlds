import Foundation
import Capacitor
import Photos
import UIKit

/**
 * Saves a base64 PNG straight to the iOS photo library (camera roll).
 * Call: GallerySave.saveImage({ base64, filename, album })
 * Requires NSPhotoLibraryAddUsageDescription in Info.plist.
 */
@objc(GallerySavePlugin)
public class GallerySavePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GallerySavePlugin"
    public let jsName = "GallerySave"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "saveImage", returnType: CAPPluginReturnPromise)
    ]

    @objc func saveImage(_ call: CAPPluginCall) {
        guard var base64 = call.getString("base64") else {
            call.reject("Missing base64 image data")
            return
        }
        if let comma = base64.firstIndex(of: ",") {
            base64 = String(base64[base64.index(after: comma)...])
        }
        guard let data = Data(base64Encoded: base64, options: .ignoreUnknownCharacters),
              let image = UIImage(data: data) else {
            call.reject("Could not decode image")
            return
        }

        func doSave() {
            PHPhotoLibrary.shared().performChanges({
                PHAssetChangeRequest.creationRequestForAsset(from: image)
            }) { success, error in
                if success {
                    call.resolve(["saved": true])
                } else {
                    call.reject("Save failed: \(error?.localizedDescription ?? "unknown error")")
                }
            }
        }

        let status = PHPhotoLibrary.authorizationStatus(for: .addOnly)
        if status == .authorized || status == .limited {
            doSave()
        } else {
            PHPhotoLibrary.requestAuthorization(for: .addOnly) { newStatus in
                if newStatus == .authorized || newStatus == .limited {
                    doSave()
                } else {
                    call.reject("Photo library access denied")
                }
            }
        }
    }
}
