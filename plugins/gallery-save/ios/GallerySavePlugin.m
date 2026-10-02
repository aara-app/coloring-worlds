#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Defines the plugin and its methods for the Capacitor iOS bridge.
CAP_PLUGIN(GallerySavePlugin, "GallerySave",
           CAP_PLUGIN_METHOD(saveImage, CAPPluginReturnPromise);
)
