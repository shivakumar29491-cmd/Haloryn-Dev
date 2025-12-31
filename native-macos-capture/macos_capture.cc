#include <napi.h>
#include <ApplicationServices/ApplicationServices.h>

Napi::Value CaptureRegion(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 4) {
        Napi::TypeError::New(env, "Expected 4 numeric arguments").ThrowAsJavaScriptException();
        return env.Null();
    }

    int x = info[0].As<Napi::Number>().Int32Value();
    int y = info[1].As<Napi::Number>().Int32Value();
    int w = info[2].As<Napi::Number>().Int32Value();
    int h = info[3].As<Napi::Number>().Int32Value();

    CGRect rect = CGRectMake(x, y, w, h);
    CGImageRef image = CGWindowListCreateImage(
        rect,
        kCGWindowListOptionOnScreenOnly,
        kCGNullWindowID,
        kCGWindowImageDefault
    );

    if (!image) {
        Napi::Error::New(env, "Failed to capture region").ThrowAsJavaScriptException();
        return env.Null();
    }

    // Convert CGImage → PNG data
    CFMutableDataRef pngData = CFDataCreateMutable(nullptr, 0);
    CGImageDestinationRef dest = CGImageDestinationCreateWithData(
        pngData,
        kUTTypePNG,
        1,
        nullptr
    );

    if (!dest) {
        CGImageRelease(image);
        Napi::Error::New(env, "Failed to create PNG encoder").ThrowAsJavaScriptException();
        return env.Null();
    }

    CGImageDestinationAddImage(dest, image, nullptr);
    CGImageDestinationFinalize(dest);

    const UInt8* bytes = CFDataGetBytePtr(pngData);
    CFIndex length = CFDataGetLength(pngData);

    // Copy into Node.js Buffer
    Napi::Buffer<uint8_t> output = Napi::Buffer<uint8_t>::Copy(env, bytes, length);

    // Cleanup
    CFRelease(dest);
    CGImageRelease(image);
    CFRelease(pngData);

    return output;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("captureRegion", Napi::Function::New(env, CaptureRegion));
  return exports;
}

NODE_API_MODULE(macos_capture, Init);
