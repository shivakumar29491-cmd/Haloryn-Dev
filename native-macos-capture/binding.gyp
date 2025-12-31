{
  "targets": [
    {
      "target_name": "macos_capture",
      "sources": [ "macos_capture.cc" ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "libraries": [
        "-framework ApplicationServices",
        "-framework CoreGraphics"
      ],
      "include_dirs": [
  "<!(node -p \"require('node-addon-api').include\")",
  "node_modules/node-addon-api"
],
"defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ]

    }
  ]
}
