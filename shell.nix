with import <nixpkgs> { };

mkShell {
  name = "dotnet";

  # Packages available in the shell environment
  packages = [
    vulkan-tools
    vulkan-tools-lunarg
    shaderc
    nodejs
  ];

  buildInputs = [
    vulkan-headers
    vulkan-loader
    vulkan-validation-layers
  ];

  shellHook = ''
    # Set LD_LIBRARY_PATH for runtime linking
    export LD_LIBRARY_PATH="${
      pkgs.lib.makeLibraryPath [
        glfw
        freetype
        vulkan-loader
        vulkan-validation-layers
      ]
    }:$LD_LIBRARY_PATH"

    # Set VULKAN_SDK to point to vulkan-headers for includes
    export VULKAN_SDK="${vulkan-headers}"

    # Help CMake find Vulkan
    export CMAKE_PREFIX_PATH="${vulkan-headers}:${vulkan-loader}:${vulkan-validation-layers}:$CMAKE_PREFIX_PATH"
    export CMAKE_LIBRARY_PATH="${vulkan-loader}/lib:$CMAKE_LIBRARY_PATH"

    # Set VK_LAYER_PATH for Vulkan validation layers
    export VK_LAYER_PATH="${vulkan-validation-layers}/share/vulkan/explicit_layer.d"
  '';
}
